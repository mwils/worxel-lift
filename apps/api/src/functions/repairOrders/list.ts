import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { Customer, RepairOrder, RoStatusEnum, Vehicle } from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";
import { isEstimateDeclined } from "./_estimate.js";
import { roPaymentSnapshot } from "./_payments.js";
import { customerName, vehicleSummary } from "./_rows.js";

const ListQuery = z.object({
  // Single status or comma-separated list ("picked_up,voided") — the board's
  // closed section wants all three closed statuses in one call.
  status: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .pipe(z.array(RoStatusEnum).min(1))
    .optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const { status, q, limit } = parseQuery(event, ListQuery);

    const filter: Record<string, unknown> = { shopId: user.shopId };
    if (status) filter.status = status.length === 1 ? status[0] : { $in: status };

    // If q is numeric, match RO number. Otherwise filter post-hoc by customer
    // name / vehicle summary (cheaper than aggregation at this scale).
    if (q && /^\d+$/.test(q.trim())) {
      filter.number = Number(q.trim());
    }

    const ros = await RepairOrder.find(filter).sort({ updatedAt: -1 }).limit(limit).lean();

    // Parallel fetch customers + vehicles, then join in memory.
    const customerIds = Array.from(new Set(ros.map((r) => String(r.customerId))));
    const vehicleIds = Array.from(new Set(ros.map((r) => String(r.vehicleId))));
    const [customers, vehicles] = await Promise.all([
      Customer.find({ _id: { $in: customerIds }, shopId: user.shopId }).lean(),
      Vehicle.find({ _id: { $in: vehicleIds }, shopId: user.shopId }).lean(),
    ]);
    const customerById = new Map(customers.map((c) => [String(c._id), c]));
    const vehicleById = new Map(vehicles.map((v) => [String(v._id), v]));

    let board = ros.map((r) => {
      const c = customerById.get(String(r.customerId));
      const v = vehicleById.get(String(r.vehicleId));
      const pay = roPaymentSnapshot(r);
      return {
        id: String(r._id),
        number: r.number,
        status: r.status,
        customerName: customerName(c),
        vehicleSummary: vehicleSummary(v),
        total: r.total,
        paymentStatus: pay.status,
        collectedCents: pay.collectedCents,
        balanceCents: pay.balanceCents,
        updatedAt: r.updatedAt,
        // Board cards show the visit date for scheduled ROs.
        scheduledFor: r.scheduledFor ?? null,
        // Declined-estimate marker + "needs a reply" banner. Null unless the
        // customer declined and hasn't since approved.
        estimateDeclinedAt: isEstimateDeclined(r.estimate) ? r.estimate?.declinedAt ?? null : null,
        estimateDeclineFollowedUpAt: isEstimateDeclined(r.estimate)
          ? r.estimate?.declineFollowedUpAt ?? null
          : null,
      };
    });

    // Free-text q filter applied after the join so we can match name / vehicle text.
    if (q && q.trim().length > 0 && !/^\d+$/.test(q.trim())) {
      const rx = new RegExp(escapeRegex(q.trim()), "i");
      board = board.filter(
        (r) => rx.test(r.customerName) || rx.test(r.vehicleSummary) || rx.test(String(r.number))
      );
    }

    return ok({ ros: board });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
