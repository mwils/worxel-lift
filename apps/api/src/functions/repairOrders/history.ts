import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import { z } from "zod";
import { Customer, RepairOrder, RoStatusEnum, Vehicle, normalizePlate } from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";
import { roPaymentSnapshot } from "./_payments.js";
import { customerName, parseRoNumber, vehicleSummary } from "./_rows.js";

/**
 * GET /repair-orders/history
 *
 * Every RO the shop has ever written, newest first, for the /ros page and the
 * board's "This month" strip. Separate from GET /repair-orders because that one
 * is board-shaped (open columns, 100-row cap, sorted by last touch); this one
 * paginates by cursor, filters by date / status / paid state, searches across
 * customer + vehicle, and returns money totals for the filter.
 *
 * Query:
 *   from, to    ISO instants; half-open [from, to) on the RO's history date
 *   status      comma list of RO statuses
 *   paid        paid | partial | unpaid
 *   q           RO number ("142", "RO-0142") or customer name / plate / VIN
 *   cursor      "<historyAt ISO>|<id>" from the previous page
 *   limit       1..100, default 50
 *
 * The history date is `completedAt ?? updatedAt` — when the car left, or the
 * last touch for anything that never got picked up. The range filter is an
 * indexable $or over the two fields ({shopId, completedAt, updatedAt} index);
 * sort + cursor use the computed field, which is an in-memory sort over the
 * shop's projected rows — thousands of small docs, fine for a 1–3 bay shop.
 *
 * `totals` rides along on the first page only (no cursor). `collectedCents`
 * is the denormalized sum of succeeded Payment rows kept on each RO by
 * repairOrders/_payments.ts (legacy round-1 "paid" ROs fall back to
 * amountCents ?? total, same rule as roPaymentSnapshot / vehicles/history.ts),
 * so the totals row agrees with the rows under it.
 */

const HistoryQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z
    .string()
    .transform((v) => v.split(",").filter(Boolean))
    .pipe(z.array(RoStatusEnum).min(1))
    .optional(),
  paid: z.enum(["paid", "partial", "unpaid"]).optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// Cap on how many customer / vehicle ids a text search can fan out to. Past
// this the search is too broad to be useful anyway ("s").
const MAX_SEARCH_IDS = 500;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Legacy-tolerant "what's been collected" — mirrors roPaymentSnapshot for
// rows that predate payment.collectedCents.
const COLLECTED_EXPR = {
  $cond: [
    { $isNumber: "$payment.collectedCents" },
    "$payment.collectedCents",
    {
      $cond: [
        { $eq: ["$payment.status", "paid"] },
        { $ifNull: ["$payment.amountCents", { $ifNull: ["$total", 0] }] },
        0,
      ],
    },
  ],
};

interface HistoryRow {
  _id: mongoose.Types.ObjectId;
  number: number;
  status: string;
  customerId: mongoose.Types.ObjectId;
  vehicleId: mongoose.Types.ObjectId;
  total?: number | null;
  payment?: {
    status?: string | null;
    amountCents?: number | null;
    collectedCents?: number | null;
  } | null;
  completedAt?: Date | null;
  updatedAt: Date;
  historyAt: Date;
}

interface Totals {
  count: number;
  revenueCents: number;
  collectedCents: number;
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const { from, to, status, paid, q, cursor, limit } = parseQuery(event, HistoryQuery);
    if (from && to && from >= to) return badRequest("`from` must be before `to`");

    const shopOid = new mongoose.Types.ObjectId(user.shopId);
    const match: Record<string, unknown> = { shopId: shopOid };
    if (status) match.status = status.length === 1 ? status[0] : { $in: status };
    if (paid === "paid" || paid === "partial") match["payment.status"] = paid;
    else if (paid === "unpaid") match["payment.status"] = { $nin: ["paid", "partial"] };

    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = from;
      if (to) range.$lt = to;
      match.$or = [{ completedAt: range }, { completedAt: null, updatedAt: range }];
    }

    // Free text: an RO number hits `number` directly; anything else resolves to
    // customer / vehicle ids first (both shop-scoped, both indexed), then
    // filters ROs by those ids. Two cheap queries beat a $lookup here.
    if (q) {
      const roNumber = parseRoNumber(q);
      if (roNumber !== null) {
        match.number = roNumber;
      } else {
        const ids = await searchIds(shopOid, q);
        if (ids.customerIds.length === 0 && ids.vehicleIds.length === 0) {
          return ok({
            ros: [],
            nextCursor: null,
            ...(cursor ? {} : { totals: emptyTotals() }),
          });
        }
        const or: Record<string, unknown>[] = [];
        if (ids.customerIds.length) or.push({ customerId: { $in: ids.customerIds } });
        if (ids.vehicleIds.length) or.push({ vehicleId: { $in: ids.vehicleIds } });
        // Combine with the date-range $or (if any) via $and.
        if (match.$or) {
          match.$and = [{ $or: match.$or }, { $or: or }];
          delete match.$or;
        } else {
          match.$or = or;
        }
      }
    }

    const basePipeline: mongoose.PipelineStage[] = [
      { $match: match },
      // Project before the in-memory sort so it's over small rows, not full
      // ROs with line items and photos.
      {
        $project: {
          number: 1,
          status: 1,
          customerId: 1,
          vehicleId: 1,
          total: 1,
          "payment.status": 1,
          "payment.amountCents": 1,
          "payment.collectedCents": 1,
          completedAt: 1,
          updatedAt: 1,
          historyAt: { $ifNull: ["$completedAt", "$updatedAt"] },
        },
      },
    ];

    const cursorMatch = parseCursor(cursor);
    const pagePipeline: mongoose.PipelineStage[] = [
      ...basePipeline,
      ...(cursorMatch ? [{ $match: cursorMatch }] : []),
      { $sort: { historyAt: -1, _id: -1 } },
      { $limit: limit + 1 },
    ];

    const [rows, totalsAgg] = await Promise.all([
      RepairOrder.aggregate<HistoryRow>(pagePipeline),
      cursor
        ? Promise.resolve<Totals[]>([])
        : RepairOrder.aggregate<Totals>([
            ...basePipeline,
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                revenueCents: { $sum: { $ifNull: ["$total", 0] } },
                collectedCents: { $sum: COLLECTED_EXPR },
              },
            },
          ]),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? `${new Date(last.historyAt).toISOString()}|${String(last._id)}` : null;

    const customerIds = Array.from(new Set(page.map((r) => String(r.customerId))));
    const vehicleIds = Array.from(new Set(page.map((r) => String(r.vehicleId))));
    const [customers, vehicles] = await Promise.all([
      customerIds.length
        ? Customer.find({ _id: { $in: customerIds }, shopId: shopOid })
            .select("firstName lastName")
            .lean()
        : Promise.resolve([]),
      vehicleIds.length
        ? Vehicle.find({ _id: { $in: vehicleIds }, shopId: shopOid })
            .select("year make model plate")
            .lean()
        : Promise.resolve([]),
    ]);
    const customerById = new Map(customers.map((c) => [String(c._id), c]));
    const vehicleById = new Map(vehicles.map((v) => [String(v._id), v]));

    const ros = page.map((r) => {
      const c = customerById.get(String(r.customerId));
      const v = vehicleById.get(String(r.vehicleId));
      const pay = roPaymentSnapshot(r);
      return {
        id: String(r._id),
        number: r.number,
        status: r.status,
        customerId: String(r.customerId),
        customerName: customerName(c),
        vehicleId: String(r.vehicleId),
        vehicleSummary: vehicleSummary(v),
        plate: v?.plate ?? null,
        total: r.total ?? 0,
        paymentStatus: pay.status,
        collectedCents: pay.collectedCents,
        balanceCents: pay.balanceCents,
        date: r.historyAt,
        completedAt: r.completedAt ?? null,
        updatedAt: r.updatedAt,
      };
    });

    const body: Record<string, unknown> = { ros, nextCursor };
    if (!cursor) {
      const t = totalsAgg[0];
      body.totals = t
        ? {
            count: t.count,
            revenueCents: t.revenueCents,
            collectedCents: t.collectedCents,
            outstandingCents: Math.max(0, t.revenueCents - t.collectedCents),
          }
        : emptyTotals();
    }
    return ok(body);
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});

function emptyTotals() {
  return { count: 0, revenueCents: 0, collectedCents: 0, outstandingCents: 0 };
}

/** "<iso>|<id>" → strictly-older-than match on (historyAt, _id). Bad cursors are ignored. */
function parseCursor(cursor: string | undefined): Record<string, unknown> | null {
  if (!cursor) return null;
  const [iso, id] = cursor.split("|");
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime()) || !id || !mongoose.isValidObjectId(id)) return null;
  const oid = new mongoose.Types.ObjectId(id);
  return { $or: [{ historyAt: { $lt: at } }, { historyAt: at, _id: { $lt: oid } }] };
}

/**
 * Resolve free text to customer ids (name prefix, "first last" pairs) and
 * vehicle ids (normalized-plate substring, VIN suffix). Shop-scoped.
 */
async function searchIds(shopId: mongoose.Types.ObjectId, q: string) {
  const tokens = q.split(/\s+/).filter(Boolean);
  const nameOr: Record<string, unknown>[] = [];
  if (tokens.length >= 2) {
    // "dale smith" — first token first name, rest last name (and the reverse).
    const a = new RegExp(`^${escapeRegex(tokens[0]!)}`, "i");
    const b = new RegExp(`^${escapeRegex(tokens.slice(1).join(" "))}`, "i");
    nameOr.push({ firstName: a, lastName: b }, { firstName: b, lastName: a });
  } else {
    const rx = new RegExp(`^${escapeRegex(q)}`, "i");
    nameOr.push({ firstName: rx }, { lastName: rx });
  }

  const plateNorm = normalizePlate(q);
  const vehicleOr: Record<string, unknown>[] = [];
  if (plateNorm.length >= 2) vehicleOr.push({ plateNormalized: new RegExp(escapeRegex(plateNorm)) });
  if (/^[a-z0-9]{4,17}$/i.test(q)) vehicleOr.push({ vin: new RegExp(escapeRegex(q.toUpperCase()) + "$", "i") });

  const [customers, vehicles] = await Promise.all([
    Customer.find({ shopId, $or: nameOr }).select("_id").limit(MAX_SEARCH_IDS).lean(),
    vehicleOr.length
      ? Vehicle.find({ shopId, $or: vehicleOr }).select("_id").limit(MAX_SEARCH_IDS).lean()
      : Promise.resolve([]),
  ]);
  return {
    customerIds: customers.map((c) => c._id),
    vehicleIds: vehicles.map((v) => v._id),
  };
}
