import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MarkPaidDto, Payment, RepairOrder } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { roPaymentSnapshot, serializePaymentRow, serializeRoPayment, syncRoPayment } from "./_payments.js";
import { applyRoTotals } from "./_totals.js";

export const WRITE_OFF_DESCRIPTION = "Discount";

/**
 * POST /repair-orders/:id/mark-paid
 *
 * Owner records a payment that didn't go through Stripe — cash at the
 * counter, their own card terminal, a check. Appends a Payment row and
 * re-derives the RO's settlement state from the rows: a short amount leaves
 * the RO `partial` with the difference due (a second mark-paid settles it);
 * `writeOffRemainder` adds a negative "Discount" fee line for exactly that
 * difference so total and collected agree and the RO closes as `paid`.
 *
 * Undo / refund live on POST /repair-orders/:id/payments/:paymentId/void.
 *
 * The RO number ("RO-0142") doubles as the invoice reference; there's no
 * separate invoice counter.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing repair order id");

    const dto = await parseBody(event, MarkPaidDto);

    const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    // Bring a legacy round-1 RO onto the rows model before adding to it, so
    // the first partial against it doesn't double count what's on ro.payment.
    await adoptLegacyPayment(ro, user.userId);

    const before = await syncRoPayment(ro);
    if ((ro.total ?? 0) <= 0) return badRequest("Nothing to collect — this RO has no total");
    if (before.balanceCents <= 0) return badRequest("This RO is already paid in full");

    const amountCents = dto.amountCents ?? before.balanceCents;
    if (amountCents <= 0) return badRequest("Amount has to be more than $0");
    if (amountCents > before.balanceCents) {
      return badRequest(`That's more than the balance due — enter up to $${(before.balanceCents / 100).toFixed(2)}`);
    }

    const shortBy = before.balanceCents - amountCents;
    if (shortBy > 0 && dto.writeOffRemainder) {
      ro.lineItems.push({
        kind: "fee",
        description: WRITE_OFF_DESCRIPTION,
        total: -shortBy,
      } as (typeof ro.lineItems)[number]);
      await applyRoTotals(ro, user.shopId);
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const row = await Payment.create({
      shopId: ro.shopId,
      repairOrderId: ro._id,
      customerId: ro.customerId,
      vehicleId: ro.vehicleId,
      amountCents,
      status: "succeeded",
      method: dto.method,
      note: dto.note?.trim() || undefined,
      recordedByUserId: user.userId,
      paidAt,
      completedAt: paidAt,
    });

    const after = await syncRoPayment(ro);
    await ro.save();

    return ok({
      payment: serializeRoPayment(ro, after.rows),
      payments: after.rows.map((r) => serializePaymentRow(r)),
      recorded: serializePaymentRow(row.toObject()),
      collectedCents: after.collectedCents,
      balanceCents: after.balanceCents,
      totals: {
        laborTotal: ro.laborTotal ?? 0,
        partsTotal: ro.partsTotal ?? 0,
        taxTotal: ro.taxTotal ?? 0,
        total: ro.total ?? 0,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});

/**
 * Round-1 mark-paid wrote `ro.payment` only (no Payment row, no
 * collectedCents). If that's what we're looking at, materialize the row now —
 * same thing scripts/backfillPayments.ts does in bulk.
 */
export async function adoptLegacyPayment(
  ro: InstanceType<typeof RepairOrder>,
  recordedByUserId?: string
): Promise<boolean> {
  const p = ro.payment;
  if (!p || p.status !== "paid" || typeof p.collectedCents === "number") return false;
  if (p.stripePaymentIntentId) return false; // Stripe paths always wrote their row
  const existing = await Payment.countDocuments({ shopId: ro.shopId, repairOrderId: ro._id });
  if (existing > 0) return false;
  const snap = roPaymentSnapshot(ro);
  if (snap.collectedCents <= 0) return false;
  await Payment.create({
    shopId: ro.shopId,
    repairOrderId: ro._id,
    customerId: ro.customerId,
    vehicleId: ro.vehicleId,
    amountCents: snap.collectedCents,
    status: "succeeded",
    method: p.method === "card" ? "card_in_person" : (p.method ?? "other"),
    note: p.note ?? undefined,
    recordedByUserId,
    paidAt: p.paidAt ?? ro.updatedAt ?? new Date(),
    completedAt: p.paidAt ?? ro.updatedAt ?? new Date(),
  });
  return true;
}
