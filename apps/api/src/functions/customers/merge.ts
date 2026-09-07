import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import {
  Conversation,
  Customer,
  MergeCustomerDto,
  Message,
  Payment,
  RepairOrder,
  ServiceReminder,
  Vehicle,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

/**
 * POST /customers/{id}/merge  body { intoCustomerId }
 *
 * Merges customer {id} (the "loser") INTO `intoCustomerId` (the survivor —
 * the customer the owner is looking at). Irreversible; the UI confirms.
 *
 * Collections re-keyed from loser → survivor, in this order so a crash
 * mid-way leaves both records present and a retry finishes the job:
 *   vehicles, repairOrders, messages, payments, serviceReminders,
 *   conversations (merged when both exist), customers.possibleDuplicateOf.
 * Then the survivor absorbs the loser's identity (aliases[], phoneHistory,
 * notes, email if missing, opt-out if either opted out, taxExempt if either)
 * and the loser is deleted. Vehicles under the survivor that share a VIN
 * (the usual reason the duplicate was spotted) are collapsed into one.
 *
 * No multi-document transaction on purpose: every step is idempotent
 * against a re-run and the Lambda has no session plumbing today.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const loserId = event.pathParameters?.id;
    if (!loserId || !mongoose.isValidObjectId(loserId)) return badRequest("Missing customer id");
    const dto = await parseBody(event, MergeCustomerDto);
    if (dto.intoCustomerId === loserId) return badRequest("Pick a different customer to merge");

    const shopId = new mongoose.Types.ObjectId(user.shopId);
    const [loser, survivor] = await Promise.all([
      Customer.findOne({ _id: loserId, shopId }).lean(),
      Customer.findOne({ _id: dto.intoCustomerId, shopId }).lean(),
    ]);
    if (!loser) return notFound("Customer to merge not found");
    if (!survivor) return notFound("Customer to merge into not found");

    const now = new Date();
    const scope = { shopId, customerId: loser._id };
    const rekey = { $set: { customerId: survivor._id } };

    const [vehicles, repairOrders, messages, payments, serviceReminders] = await Promise.all([
      Vehicle.updateMany(scope, rekey),
      RepairOrder.updateMany(scope, rekey),
      Message.updateMany(scope, rekey),
      Payment.updateMany(scope, rekey),
      ServiceReminder.updateMany(scope, rekey),
    ]);

    await mergeConversations(shopId, loser._id, survivor._id);
    const vehiclesCollapsed = await collapseDuplicateVehicles(shopId, survivor._id);

    // Anyone flagged as a possible duplicate of the loser now points at the survivor.
    await Customer.updateMany(
      { shopId, possibleDuplicateOf: loser._id, _id: { $ne: survivor._id } },
      { $set: { possibleDuplicateOf: survivor._id } }
    );

    // Survivor absorbs the loser's identity.
    const loserName = [loser.firstName, loser.lastName].filter(Boolean).join(" ");
    const aliases = [
      ...(loser.aliases ?? []),
      {
        customerId: loser._id,
        firstName: loser.firstName,
        lastName: loser.lastName ?? undefined,
        phone: loser.phone,
        email: loser.email ?? undefined,
        mergedAt: now,
      },
    ];
    const phoneHistory = [
      ...(loser.phoneHistory ?? []),
      ...(loser.phone !== survivor.phone ? [{ phone: loser.phone, changedAt: now }] : []),
    ];
    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    if (!survivor.email && loser.email) set.email = loser.email;
    if (!survivor.smsOptOutAt && loser.smsOptOutAt) set.smsOptOutAt = loser.smsOptOutAt;
    if (!survivor.taxExempt && loser.taxExempt) set.taxExempt = true;
    if (!survivor.stripeCustomerId && loser.stripeCustomerId) {
      set.stripeCustomerId = loser.stripeCustomerId;
    }
    if (loser.notes?.trim()) {
      set.notes = [survivor.notes?.trim(), `Merged from ${loserName}: ${loser.notes.trim()}`]
        .filter(Boolean)
        .join("\n");
    }
    if (survivor.possibleDuplicateOf && String(survivor.possibleDuplicateOf) === String(loser._id)) {
      unset.possibleDuplicateOf = "";
    }
    await Customer.updateOne(
      { _id: survivor._id, shopId },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
        $push: {
          aliases: { $each: aliases },
          ...(phoneHistory.length ? { phoneHistory: { $each: phoneHistory } } : {}),
        },
      }
    );

    // Thread note so the survivor's conversation explains the extra history.
    try {
      await Message.create({
        shopId,
        customerId: survivor._id,
        direction: "out",
        kind: "system",
        body: `Merged customer ${loserName} (${prettyPhone(loser.phone)}) into this record. Their vehicles, repair orders, texts and payments now show here.`,
        sentAt: now,
      });
    } catch (err) {
      console.error("[customers/merge] system note failed", err);
    }

    await Customer.deleteOne({ _id: loser._id, shopId });

    return ok({
      survivorId: String(survivor._id),
      mergedId: String(loser._id),
      moved: {
        vehicles: vehicles.modifiedCount,
        repairOrders: repairOrders.modifiedCount,
        messages: messages.modifiedCount,
        payments: payments.modifiedCount,
        serviceReminders: serviceReminders.modifiedCount,
        vehiclesCollapsed,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});

/**
 * Both customers may have a Conversation row (unique per shop+customer).
 * Loser only → re-key. Both → fold the loser's counters into the survivor's
 * and drop the loser's row.
 */
async function mergeConversations(
  shopId: mongoose.Types.ObjectId,
  loserId: mongoose.Types.ObjectId,
  survivorId: mongoose.Types.ObjectId
) {
  const [a, b] = await Promise.all([
    Conversation.findOne({ shopId, customerId: loserId }).lean(),
    Conversation.findOne({ shopId, customerId: survivorId }).lean(),
  ]);
  if (!a) return;
  if (!b) {
    await Conversation.updateOne({ _id: a._id }, { $set: { customerId: survivorId } });
    return;
  }
  const later = (x?: Date | null, y?: Date | null) => {
    if (!x) return y ?? undefined;
    if (!y) return x;
    return x > y ? x : y;
  };
  const aNewer = (a.lastMessageAt?.getTime() ?? 0) > (b.lastMessageAt?.getTime() ?? 0);
  const newest = aNewer ? a : b;
  const set: Record<string, unknown> = {
    lastMessageAt: later(a.lastMessageAt, b.lastMessageAt),
    bumpedAt: later(a.bumpedAt, b.bumpedAt),
    lastInboundAt: later(a.lastInboundAt, b.lastInboundAt),
    lastOutboundAt: later(a.lastOutboundAt, b.lastOutboundAt),
    lastReadAt: later(a.lastReadAt, b.lastReadAt),
    unreadCount: (a.unreadCount ?? 0) + (b.unreadCount ?? 0),
    needsReply: !!(a.needsReply || b.needsReply),
    // Open if either side is open.
    archivedAt: a.archivedAt && b.archivedAt ? later(a.archivedAt, b.archivedAt) : null,
    lastMessagePreview: newest.lastMessagePreview,
    lastMessageId: newest.lastMessageId,
  };
  for (const k of Object.keys(set)) if (set[k] === undefined) delete set[k];
  await Conversation.updateOne({ _id: b._id }, { $set: set });
  await Conversation.deleteOne({ _id: a._id });
}

/**
 * After the move the survivor may own two records for the same VIN. Keep the
 * one with the most ROs (ties → oldest), point everything at it, fill in any
 * blanks from the other, and delete the other. Year/make/model alone is not
 * enough — a customer can own two identical trucks.
 */
async function collapseDuplicateVehicles(
  shopId: mongoose.Types.ObjectId,
  customerId: mongoose.Types.ObjectId
): Promise<number> {
  const vehicles = await Vehicle.find({ shopId, customerId, vin: { $type: "string", $ne: "" } })
    .sort({ createdAt: 1 })
    .lean();
  const byVin = new Map<string, typeof vehicles>();
  for (const v of vehicles) {
    const vin = (v.vin ?? "").toUpperCase();
    const group = byVin.get(vin) ?? [];
    group.push(v);
    byVin.set(vin, group);
  }
  let collapsed = 0;
  for (const group of byVin.values()) {
    if (group.length < 2) continue;
    const counts = await RepairOrder.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      { $match: { shopId, vehicleId: { $in: group.map((g) => g._id) } } },
      { $group: { _id: "$vehicleId", n: { $sum: 1 } } },
    ]);
    const roCount = new Map(counts.map((c) => [String(c._id), c.n]));
    const keeper = [...group].sort(
      (x, y) => (roCount.get(String(y._id)) ?? 0) - (roCount.get(String(x._id)) ?? 0)
    )[0]!;
    for (const other of group) {
      if (String(other._id) === String(keeper._id)) continue;
      const scope = { shopId, vehicleId: other._id };
      const rekey = { $set: { vehicleId: keeper._id } };
      await Promise.all([
        RepairOrder.updateMany(scope, rekey),
        Payment.updateMany(scope, rekey),
        ServiceReminder.updateMany(scope, rekey),
      ]);
      const fill: Record<string, unknown> = {};
      for (const k of ["year", "make", "model", "trim", "engine", "plate", "plateNormalized", "color", "notes"] as const) {
        if (keeper[k] == null && other[k] != null) fill[k] = other[k];
      }
      if ((other.mileage ?? 0) > (keeper.mileage ?? 0)) fill.mileage = other.mileage;
      // Active wins over archived.
      if (keeper.archivedAt && !other.archivedAt) fill.archivedAt = null;
      if (Object.keys(fill).length) await Vehicle.updateOne({ _id: keeper._id }, { $set: fill });
      await Vehicle.deleteOne({ _id: other._id });
      collapsed++;
    }
  }
  return collapsed;
}

function prettyPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
