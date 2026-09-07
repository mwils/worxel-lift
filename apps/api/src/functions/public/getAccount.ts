import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import { Customer, RepairOrder, Shop, Vehicle } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound } from "../../lib/response.js";
import { bookingManageUrl, formatVisitTime } from "../../lib/visitTime.js";
import { roPaymentSnapshot } from "../repairOrders/_payments.js";

/** Never show the customer a voided RO or a booking they cancelled. */
const HIDDEN_STATUSES = new Set(["voided", "cancelled_by_customer"]);
/** How many line-item descriptions make up the "what we did" summary. */
const SUMMARY_LINES = 3;

/** The slice of a lean RO this page reads. */
interface RoLike {
  _id: unknown;
  number: number;
  status: string;
  concern?: string | null;
  lineItems?: Array<{ description: string; total: number }>;
  total?: number | null;
  payment?: { status?: string | null; amountCents?: number | null; collectedCents?: number | null } | null;
  receiptToken?: string | null;
  inspection?: { status?: string | null; publicToken?: string | null; sentAt?: Date | null } | null;
  vehicleId: unknown;
  scheduledFor?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date | null;
  // Landing from the vehicle-service-history work; read if present, never required.
  mileageIn?: number | null;
  mileageOut?: number | null;
}

function hasWork(ro: RoLike): boolean {
  return (ro.total ?? 0) > 0 || (ro.lineItems?.length ?? 0) > 0;
}

/** Customer-facing stage: what they care about is "is it done / can I get it / still in". */
function stageOf(status: string): "done" | "ready" | "active" {
  if (status === "picked_up") return "done";
  if (status === "ready") return "ready";
  return "active";
}

/**
 * GET /public/account/:token
 *
 * Token-scoped, unauthenticated, read-only. The customer's whole relationship
 * with one shop on one page: the shop's contact block, an upcoming booking
 * (with its manage link), and every vehicle with its past visits — date, what
 * was done, total, paid state — each linking to the receipt and, if one was
 * sent, the inspection. No editing, no messaging; they reply to the text.
 *
 * Receipt tokens are minted lazily here for visits that never had "Text
 * receipt" tapped, same as repairOrders/receiptLink.ts does on demand.
 */
export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const customer = await Customer.findOne({ publicToken: token }).lean();
  if (!customer) return notFound();

  const [shop, vehicles, ros] = await Promise.all([
    Shop.findById(customer.shopId).lean(),
    Vehicle.find({ shopId: customer.shopId, customerId: customer._id }).lean(),
    RepairOrder.find({ shopId: customer.shopId, customerId: customer._id })
      .sort({ createdAt: -1 })
      .lean() as unknown as Promise<RoLike[]>,
  ]);
  if (!shop) return notFound();

  // `archivedAt` may land from the customer-records work; if a vehicle carries
  // it, leave it off the page. Vehicles without the field are all shown.
  const liveVehicles = vehicles.filter((v) => !(v as { archivedAt?: Date | null }).archivedAt);

  const now = Date.now();
  const upcomingRo = ros
    .filter(
      (r) =>
        r.status === "scheduled" &&
        r.scheduledFor instanceof Date &&
        r.scheduledFor.getTime() >= now
    )
    .sort((a, b) => (a.scheduledFor?.getTime() ?? 0) - (b.scheduledFor?.getTime() ?? 0))[0];

  const visits = ros.filter((r) => r.status !== "scheduled" && !HIDDEN_STATUSES.has(r.status));

  // Lazily mint receipt tokens for visits that have something to show and
  // never had one. `$exists: false` guard + re-read handles a concurrent
  // "Text receipt" from the shop side minting the same RO's token.
  const needsToken = visits.filter((r) => hasWork(r) && !r.receiptToken);
  if (needsToken.length > 0) {
    await RepairOrder.bulkWrite(
      needsToken.map((r) => ({
        updateOne: {
          filter: { _id: r._id, receiptToken: { $exists: false } },
          update: { $set: { receiptToken: randomBytes(18).toString("base64url") } },
        },
      }))
    );
    const fresh = await RepairOrder.find({ _id: { $in: needsToken.map((r) => r._id) } })
      .select({ receiptToken: 1 })
      .lean();
    const byId = new Map(fresh.map((f) => [String(f._id), f.receiptToken ?? null]));
    for (const r of needsToken) r.receiptToken = byId.get(String(r._id)) ?? null;
  }

  const serializeVisit = (r: RoLike) => {
    const lines = r.lineItems ?? [];
    const snap = roPaymentSnapshot(r);
    const inspectionSent = r.inspection?.status === "sent" && !!r.inspection.publicToken;
    return {
      number: r.number,
      date: r.completedAt ?? r.createdAt ?? null,
      stage: stageOf(r.status),
      concern: r.concern ?? null,
      summary: lines.slice(0, SUMMARY_LINES).map((li) => li.description),
      lineItemCount: lines.length,
      total: r.total ?? 0,
      payment: { status: snap.status, balanceCents: snap.balanceCents },
      mileage: r.mileageOut ?? r.mileageIn ?? null,
      // Same-app paths; the page renders them with the router.
      receiptPath: r.receiptToken && hasWork(r) ? `/public/receipt/${r.receiptToken}` : null,
      inspectionPath: inspectionSent ? `/public/inspection/${r.inspection!.publicToken}` : null,
    };
  };

  const byVehicle = new Map<string, RoLike[]>();
  for (const r of visits) {
    const key = String(r.vehicleId);
    const list = byVehicle.get(key);
    if (list) list.push(r);
    else byVehicle.set(key, [r]);
  }

  const vehicleBlocks = liveVehicles
    .map((v) => {
      const list = byVehicle.get(String(v._id)) ?? [];
      byVehicle.delete(String(v._id));
      const latest = list[0]?.completedAt ?? list[0]?.createdAt ?? null;
      return {
        id: String(v._id),
        year: v.year ?? null,
        make: v.make ?? null,
        model: v.model ?? null,
        plate: v.plate ?? null,
        mileage: v.mileage ?? null,
        latestVisitAt: latest,
        visits: list.map(serializeVisit),
      };
    })
    // Most recently serviced first; cars with no visits yet at the bottom.
    .sort((a, b) => (b.latestVisitAt?.getTime() ?? 0) - (a.latestVisitAt?.getTime() ?? 0));

  // Visits whose vehicle is archived or gone still happened; keep them visible
  // under a catch-all so a receipt never disappears from the customer's view.
  const orphaned = [...byVehicle.values()].flat().map(serializeVisit);

  const upcomingVehicle = upcomingRo
    ? vehicles.find((v) => String(v._id) === String(upcomingRo.vehicleId))
    : null;
  const bookingToken = upcomingRo ? (upcomingRo as { bookingToken?: string | null }).bookingToken : null;

  const address = shop.address;
  const hasAddress = !!(address?.line1 || address?.city);

  return ok({
    shop: {
      name: shop.name,
      phone: shop.phone ?? shop.sms?.phoneNumber ?? null,
      timezone: shop.timezone ?? null,
      address: hasAddress
        ? {
            line1: address?.line1 ?? null,
            line2: address?.line2 ?? null,
            city: address?.city ?? null,
            state: address?.state ?? null,
            zip: address?.zip ?? null,
          }
        : null,
    },
    customer: { firstName: customer.firstName },
    upcoming: upcomingRo
      ? {
          number: upcomingRo.number,
          scheduledFor: upcomingRo.scheduledFor,
          when: formatVisitTime(upcomingRo.scheduledFor as Date, shop.timezone),
          concern: upcomingRo.concern ?? null,
          vehicle: upcomingVehicle
            ? {
                year: upcomingVehicle.year ?? null,
                make: upcomingVehicle.make ?? null,
                model: upcomingVehicle.model ?? null,
              }
            : null,
          manageUrl: bookingToken ? bookingManageUrl(bookingToken) : null,
        }
      : null,
    vehicles: vehicleBlocks.map(({ latestVisitAt: _drop, ...v }) => v),
    otherVisits: orphaned,
  });
});
