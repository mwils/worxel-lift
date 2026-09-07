import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import { z } from "zod";
import { Customer, Payment, RepairOrder, Vehicle } from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { roPaymentSnapshot } from "../repairOrders/_payments.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const HistoryQuery = z.object({
  cursor: z
    .string()
    .regex(/^[a-f0-9]{24}$/i, "invalid cursor")
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id || !mongoose.isValidObjectId(id)) return badRequest("Missing vehicle id");
    const { cursor, limit } = parseQuery(event, HistoryQuery);

    const vehicle = await Vehicle.findOne({ _id: id, shopId: user.shopId }).lean();
    if (!vehicle) return notFound("Vehicle not found");

    const shopOid = new mongoose.Types.ObjectId(user.shopId);
    const vehicleOid = new mongoose.Types.ObjectId(String(vehicle._id));
    const customerOid = new mongoose.Types.ObjectId(String(vehicle.customerId));

    // Stats aggregate is small (one vehicle) — runs in parallel with the page query.
    const [customer, [statsAgg], [paidAgg], rows] = await Promise.all([
      Customer.findOne({ _id: vehicle.customerId, shopId: user.shopId }).lean(),
      RepairOrder.aggregate<{
        roCount: number;
        legacySpendCents: number;
        lastServicedAt: Date | null;
      }>([
        { $match: { shopId: shopOid, vehicleId: vehicleOid } },
        {
          $group: {
            _id: null,
            roCount: { $sum: 1 },
            // Round-1 "paid" ROs with no Payment row yet (pre-backfill) — see
            // repairOrders/_payments.ts. Zero once collectedCents exists.
            legacySpendCents: {
              $sum: {
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
              },
            },
            lastServicedAt: { $max: "$createdAt" },
          },
        },
        { $project: { _id: 0 } },
      ]),
      // "$ spent" = what was actually collected on this vehicle's ROs.
      Payment.aggregate<{ cents: number }>([
        { $match: { shopId: shopOid, vehicleId: vehicleOid, status: "succeeded" } },
        { $group: { _id: null, cents: { $sum: "$amountCents" } } },
      ]),
      RepairOrder.find({
        shopId: shopOid,
        vehicleId: vehicleOid,
        ...(cursor ? { _id: { $lt: new mongoose.Types.ObjectId(cursor) } } : {}),
      })
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean(),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const lastRow = page[page.length - 1];
    const nextCursor = hasMore && lastRow ? String(lastRow._id) : null;

    const stats = statsAgg ?? { roCount: 0, legacySpendCents: 0, lastServicedAt: null };
    const lifetimeSpendCents = (paidAgg?.cents ?? 0) + stats.legacySpendCents;

    return ok({
      vehicle: {
        id: String(vehicle._id),
        customerId: String(vehicle.customerId),
        vin: vehicle.vin ?? null,
        year: vehicle.year ?? null,
        make: vehicle.make ?? null,
        model: vehicle.model ?? null,
        trim: vehicle.trim ?? null,
        engine: vehicle.engine ?? null,
        mileage: vehicle.mileage ?? null,
        plate: vehicle.plate ?? null,
        color: vehicle.color ?? null,
        notes: vehicle.notes ?? null,
      },
      customer: customer
        ? {
            id: String(customer._id),
            firstName: customer.firstName,
            lastName: customer.lastName ?? null,
            phone: customer.phone,
            email: customer.email ?? null,
          }
        : null,
      stats: {
        roCount: stats.roCount,
        lifetimeSpendCents,
        lastServicedAt: stats.lastServicedAt,
      },
      repairOrders: page.map((r) => ({
        id: String(r._id),
        number: r.number,
        status: r.status,
        concern: r.concern ?? null,
        diagnosis: r.diagnosis ?? null,
        laborTotal: r.laborTotal ?? 0,
        partsTotal: r.partsTotal ?? 0,
        taxTotal: r.taxTotal ?? 0,
        total: r.total ?? 0,
        paymentStatus: roPaymentSnapshot(r).status,
        collectedCents: roPaymentSnapshot(r).collectedCents,
        balanceCents: roPaymentSnapshot(r).balanceCents,
        mileageIn: r.mileageIn ?? null,
        mileageOut: r.mileageOut ?? null,
        completedAt: r.completedAt ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        lineItems: (r.lineItems ?? []).map((li: any) => ({
          id: String(li._id),
          kind: li.kind,
          description: li.description,
          hours: li.hours ?? null,
          rate: li.rate ?? null,
          qty: li.qty ?? null,
          unitPrice: li.unitPrice ?? null,
          total: li.total,
        })),
      })),
      nextCursor,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
