import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import { Customer, Message, RepairOrder, Vehicle } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

const RECENT_RO_LIMIT = 10;
const RECENT_MESSAGE_LIMIT = 20;

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const id = event.pathParameters?.id;
  if (!id || !mongoose.isValidObjectId(id)) return badRequest("Missing customer id");

  const customer = await Customer.findOne({ _id: id, shopId: user.shopId }).lean();
  if (!customer) return notFound("Customer not found");

  const shopOid = new mongoose.Types.ObjectId(user.shopId);
  const customerOid = new mongoose.Types.ObjectId(String(customer._id));

  // Single aggregation: customer-level stats + per-vehicle stats + recent ROs.
  // Faceting trims us to one MongoDB round-trip instead of N + 3.
  const [vehicles, messages, [agg]] = await Promise.all([
    Vehicle.find({ shopId: user.shopId, customerId: customer._id })
      .sort({ updatedAt: -1 })
      .lean(),
    Message.find({ shopId: user.shopId, customerId: customer._id })
      .sort({ sentAt: -1 })
      .limit(RECENT_MESSAGE_LIMIT)
      .lean(),
    RepairOrder.aggregate<{
      customerStats: Array<{
        roCount: number;
        lifetimeSpendCents: number;
        lifetimeBilledCents: number;
        firstVisitAt: Date | null;
        lastVisitAt: Date | null;
      }>;
      vehicleStats: Array<{
        _id: mongoose.Types.ObjectId;
        roCount: number;
        lifetimeSpendCents: number;
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
        payment: { status: string } | null;
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
                lifetimeSpendCents: {
                  $sum: {
                    $cond: [{ $eq: ["$payment.status", "paid"] }, "$total", 0],
                  },
                },
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
                lifetimeSpendCents: {
                  $sum: {
                    $cond: [{ $eq: ["$payment.status", "paid"] }, "$total", 0],
                  },
                },
                lastServicedAt: { $max: "$createdAt" },
                lastConcern: { $first: "$concern" },
              },
            },
          ],
          recentRepairOrders: [
            { $sort: { createdAt: -1 } },
            { $limit: RECENT_RO_LIMIT },
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
  ]);

  const customerStats = agg?.customerStats?.[0] ?? {
    roCount: 0,
    lifetimeSpendCents: 0,
    lifetimeBilledCents: 0,
    firstVisitAt: null,
    lastVisitAt: null,
  };

  type VehicleStat = NonNullable<typeof agg>["vehicleStats"][number];
  const perVehicleMap = new Map<string, VehicleStat>();
  for (const v of agg?.vehicleStats ?? []) {
    perVehicleMap.set(String(v._id), v);
  }

  return ok({
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
    },
    stats: {
      vehicleCount: vehicles.length,
      roCount: customerStats.roCount,
      lifetimeSpendCents: customerStats.lifetimeSpendCents,
      lifetimeBilledCents: customerStats.lifetimeBilledCents,
      firstVisitAt: customerStats.firstVisitAt,
      lastVisitAt: customerStats.lastVisitAt,
    },
    vehicles: vehicles.map((v) => {
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
        roCount: s?.roCount ?? 0,
        lastServicedAt: s?.lastServicedAt ?? null,
        lastConcern: s?.lastConcern ?? null,
        lifetimeSpendCents: s?.lifetimeSpendCents ?? 0,
      };
    }),
    recentRepairOrders: (agg?.recentRepairOrders ?? []).map((r) => ({
      id: String(r._id),
      number: r.number,
      status: r.status,
      concern: r.concern ?? null,
      total: r.total,
      vehicleId: String(r.vehicleId),
      paymentStatus: r.payment?.status ?? "unpaid",
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      completedAt: r.completedAt ?? null,
    })),
    recentMessages: messages.map((m) => ({
      id: String(m._id),
      direction: m.direction,
      body: m.body,
      sentAt: m.sentAt,
      aiDrafted: m.aiDrafted,
      inboundClassification: m.inboundClassification ?? null,
      autoReplied: m.autoReplied,
      automated: m.automated ?? false,
      deliveryStatus: m.deliveryStatus ?? null,
    })),
  });
});
