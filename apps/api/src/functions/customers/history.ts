import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import { z } from "zod";
import { Customer, Payment, RepairOrder, Vehicle } from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { roPaymentSnapshot } from "../repairOrders/_payments.js";
import { resolveCustomerByIdOrAlias } from "./_resolve.js";

const RECENT_RO_LIMIT = 10;

/**
 * Activity is paged newest-first with an `_id` cursor (same shape as
 * vehicles/history). `since` scopes the page to a window — the customer page
 * sends the last 12 months and drops it for "Show older" — while the stats
 * facets stay all-time.
 */
const HistoryQuery = z.object({
  cursor: z
    .string()
    .regex(/^[a-f0-9]{24}$/i, "invalid cursor")
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(RECENT_RO_LIMIT),
  since: z.string().datetime().optional(),
});

// Spend sums Payment rows. ROs marked paid in round 1 have no row yet (until
// scripts/backfillPayments.ts runs) — for those only, fall back to what the
// RO itself says was collected. Once `collectedCents` exists the rows own it.
const LEGACY_COLLECTED_EXPR = {
  $cond: [
    { $isNumber: "$payment.collectedCents" },
    0,
    {
      $cond: [
        { $eq: ["$payment.status", "paid"] },
        { $ifNull: ["$payment.amountCents", "$total"] },
        0,
      ],
    },
  ],
};

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
  if (!user.shopId) return badRequest("No shop on session");
  const id = event.pathParameters?.id;
  if (!id || !mongoose.isValidObjectId(id)) return badRequest("Missing customer id");
  const { cursor, limit, since } = parseQuery(event, HistoryQuery);

  const resolved = await resolveCustomerByIdOrAlias(user.shopId, id);
  if (!resolved) return notFound("Customer not found");
  const { customer, redirectedFrom } = resolved;

  const shopOid = new mongoose.Types.ObjectId(user.shopId);
  const customerOid = new mongoose.Types.ObjectId(String(customer._id));

  // Activity page filter: the window (if any) plus the cursor.
  const pageMatch: Record<string, unknown> = {};
  if (since) pageMatch.createdAt = { $gte: new Date(since) };
  if (cursor) pageMatch._id = { $lt: new mongoose.Types.ObjectId(cursor) };

  // Single aggregation: customer-level stats + per-vehicle stats + recent ROs.
  // Faceting trims us to one MongoDB round-trip instead of N + 3.
  const [allVehicles, [agg], paymentsByVehicle, duplicateOf] = await Promise.all([
    // Archived (sold / totalled) cars come back too — they're split into
    // their own section below, not dropped.
    Vehicle.find({ shopId: user.shopId, customerId: customer._id })
      .sort({ updatedAt: -1 })
      .lean(),
    RepairOrder.aggregate<{
      customerStats: Array<{
        roCount: number;
        legacySpendCents: number;
        lifetimeBilledCents: number;
        firstVisitAt: Date | null;
        lastVisitAt: Date | null;
      }>;
      vehicleStats: Array<{
        _id: mongoose.Types.ObjectId;
        roCount: number;
        legacySpendCents: number;
        lastServicedAt: Date | null;
        lastConcern: string | null;
      }>;
      recentRepairOrders: Array<{
        _id: mongoose.Types.ObjectId;
        number: number;
        status: string;
        concern: string | null;
        total: number;
        vehicleId: mongoose.Types.ObjectId;
        payment: {
          status: string;
          amountCents?: number | null;
          collectedCents?: number | null;
        } | null;
        createdAt: Date;
        updatedAt: Date;
        completedAt: Date | null;
      }>;
    }>([
      { $match: { shopId: shopOid, customerId: customerOid } },
      {
        $facet: {
          customerStats: [
            {
              $group: {
                _id: null,
                roCount: { $sum: 1 },
                legacySpendCents: { $sum: LEGACY_COLLECTED_EXPR },
                lifetimeBilledCents: { $sum: "$total" },
                firstVisitAt: { $min: "$createdAt" },
                lastVisitAt: { $max: "$createdAt" },
              },
            },
            { $project: { _id: 0 } },
          ],
          vehicleStats: [
            {
              $sort: { createdAt: -1 },
            },
            {
              $group: {
                _id: "$vehicleId",
                roCount: { $sum: 1 },
                legacySpendCents: { $sum: LEGACY_COLLECTED_EXPR },
                lastServicedAt: { $max: "$createdAt" },
                lastConcern: { $first: "$concern" },
              },
            },
          ],
          recentRepairOrders: [
            ...(Object.keys(pageMatch).length ? [{ $match: pageMatch }] : []),
            { $sort: { createdAt: -1, _id: -1 } },
            // +1 row tells us whether an older page exists.
            { $limit: limit + 1 },
            {
              $project: {
                _id: 1,
                number: 1,
                status: 1,
                concern: 1,
                total: 1,
                vehicleId: 1,
                payment: 1,
                createdAt: 1,
                updatedAt: 1,
                completedAt: 1,
              },
            },
          ],
        },
      },
    ]),
    // What was actually collected, per vehicle. Rows with no vehicleId
    // (Stripe rows written before the backfill) land under `null` and still
    // count toward the customer total.
    Payment.aggregate<{ _id: mongoose.Types.ObjectId | null; cents: number }>([
      { $match: { shopId: shopOid, customerId: customerOid, status: "succeeded" } },
      { $group: { _id: "$vehicleId", cents: { $sum: "$amountCents" } } },
    ]),
    // Online booking flagged this record as maybe the same person as an
    // existing one (same name + same vehicle, different phone). Surfaces the
    // Merge banner on the customer page.
    customer.possibleDuplicateOf
      ? Customer.findOne({ _id: customer.possibleDuplicateOf, shopId: user.shopId })
          .select({ firstName: 1, lastName: 1, phone: 1, email: 1 })
          .lean()
      : Promise.resolve(null),
  ]);

  const customerStats = agg?.customerStats?.[0] ?? {
    roCount: 0,
    legacySpendCents: 0,
    lifetimeBilledCents: 0,
    firstVisitAt: null,
    lastVisitAt: null,
  };
  const paidByVehicle = new Map<string, number>();
  let paidTotalCents = 0;
  for (const p of paymentsByVehicle) {
    paidTotalCents += p.cents;
    if (p._id) paidByVehicle.set(String(p._id), p.cents);
  }
  const lifetimeSpendCents = paidTotalCents + customerStats.legacySpendCents;

  type VehicleStat = NonNullable<typeof agg>["vehicleStats"][number];
  const perVehicleMap = new Map<string, VehicleStat>();
  for (const v of agg?.vehicleStats ?? []) {
    perVehicleMap.set(String(v._id), v);
  }

  const vehicles = allVehicles.filter((v) => !v.archivedAt);
  const archivedVehicles = allVehicles.filter((v) => !!v.archivedAt);

  const roPage = agg?.recentRepairOrders ?? [];
  const hasMoreActivity = roPage.length > limit;
  const activity = hasMoreActivity ? roPage.slice(0, limit) : roPage;
  const nextActivityCursor = hasMoreActivity
    ? String(activity[activity.length - 1]?._id ?? "")
    : null;

  function serializeVehicle(v: (typeof allVehicles)[number]) {
    const s = perVehicleMap.get(String(v._id));
    return {
      id: String(v._id),
      vin: v.vin ?? null,
      year: v.year ?? null,
      make: v.make ?? null,
      model: v.model ?? null,
      trim: v.trim ?? null,
      engine: v.engine ?? null,
      mileage: v.mileage ?? null,
      plate: v.plate ?? null,
      color: v.color ?? null,
      notes: v.notes ?? null,
      archivedAt: v.archivedAt ?? null,
      roCount: s?.roCount ?? 0,
      lastServicedAt: s?.lastServicedAt ?? null,
      lastConcern: s?.lastConcern ?? null,
      lifetimeSpendCents: (paidByVehicle.get(String(v._id)) ?? 0) + (s?.legacySpendCents ?? 0),
    };
  }

  return ok({
    // Set when the requested id was a merged-away duplicate — the UI swaps
    // the URL for the survivor's.
    redirectedFrom,
    customer: {
      id: String(customer._id),
      firstName: customer.firstName,
      lastName: customer.lastName ?? null,
      phone: customer.phone,
      email: customer.email ?? null,
      notes: customer.notes ?? null,
      smsOptInAt: customer.smsOptInAt ?? null,
      smsOptOutAt: customer.smsOptOutAt ?? null,
      createdAt: customer.createdAt,
      // Names/phones of customers merged into this one — shown under the
      // header so "who was Dale Obrien?" has an answer.
      aliases: (customer.aliases ?? []).map((a) => ({
        firstName: a.firstName,
        lastName: a.lastName ?? null,
        phone: a.phone,
        mergedAt: a.mergedAt,
      })),
    },
    possibleDuplicate: duplicateOf
      ? {
          id: String(duplicateOf._id),
          firstName: duplicateOf.firstName,
          lastName: duplicateOf.lastName ?? null,
          phone: duplicateOf.phone,
          email: duplicateOf.email ?? null,
        }
      : null,
    stats: {
      vehicleCount: vehicles.length,
      roCount: customerStats.roCount,
      lifetimeSpendCents,
      lifetimeBilledCents: customerStats.lifetimeBilledCents,
      firstVisitAt: customerStats.firstVisitAt,
      lastVisitAt: customerStats.lastVisitAt,
    },
    vehicles: vehicles.map(serializeVehicle),
    archivedVehicles: archivedVehicles.map(serializeVehicle),
    hasMoreActivity,
    nextActivityCursor,
    recentRepairOrders: activity.map((r) => ({
      id: String(r._id),
      number: r.number,
      status: r.status,
      concern: r.concern ?? null,
      total: r.total,
      vehicleId: String(r.vehicleId),
      paymentStatus: roPaymentSnapshot(r).status,
      collectedCents: roPaymentSnapshot(r).collectedCents,
      balanceCents: roPaymentSnapshot(r).balanceCents,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      completedAt: r.completedAt ?? null,
    })),
  });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
