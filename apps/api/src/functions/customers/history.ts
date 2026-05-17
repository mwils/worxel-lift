import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, Message, RepairOrder, Vehicle } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

const RO_LIMIT = 50;
const MESSAGE_LIMIT = 100;

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const id = event.pathParameters?.id;
  if (!id) return badRequest("Missing customer id");

  const customer = await Customer.findOne({ _id: id, shopId: user.shopId }).lean();
  if (!customer) return notFound("Customer not found");

  const [vehicles, repairOrders, messages] = await Promise.all([
    Vehicle.find({ shopId: user.shopId, customerId: customer._id }).sort({ updatedAt: -1 }).lean(),
    RepairOrder.find({ shopId: user.shopId, customerId: customer._id })
      .sort({ createdAt: -1 })
      .limit(RO_LIMIT)
      .lean(),
    Message.find({ shopId: user.shopId, customerId: customer._id })
      .sort({ sentAt: -1 })
      .limit(MESSAGE_LIMIT)
      .lean(),
  ]);

  return ok({
    customer: {
      id: String(customer._id),
      firstName: customer.firstName,
      lastName: customer.lastName ?? null,
      phone: customer.phone,
      email: customer.email ?? null,
      notes: customer.notes ?? null,
    },
    vehicles: vehicles.map((v) => ({
      id: String(v._id),
      vin: v.vin ?? null,
      year: v.year ?? null,
      make: v.make ?? null,
      model: v.model ?? null,
      trim: v.trim ?? null,
      mileage: v.mileage ?? null,
      plate: v.plate ?? null,
      color: v.color ?? null,
    })),
    repairOrders: repairOrders.map((r) => ({
      id: String(r._id),
      number: r.number,
      status: r.status,
      concern: r.concern ?? null,
      total: r.total,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    messages: messages.map((m) => ({
      id: String(m._id),
      direction: m.direction,
      body: m.body,
      sentAt: m.sentAt,
      aiDrafted: m.aiDrafted,
      inboundClassification: m.inboundClassification ?? null,
      autoReplied: m.autoReplied,
    })),
  });
});
