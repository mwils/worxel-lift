import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import { CreateRepairOrderDto, Customer, RepairOrder, Shop, Vehicle } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, created, notFound } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, CreateRepairOrderDto);

    // Verify both the customer and the vehicle live in this shop. This blocks
    // a malicious client from creating an RO referencing another tenant's data.
    const [customer, vehicle] = await Promise.all([
      Customer.findOne({ _id: dto.customerId, shopId: user.shopId }).lean(),
      Vehicle.findOne({ _id: dto.vehicleId, shopId: user.shopId }).lean(),
    ]);
    if (!customer) return notFound("Customer not found");
    if (!vehicle) return notFound("Vehicle not found");
    if (String(vehicle.customerId) !== String(customer._id)) {
      return badRequest("Vehicle does not belong to the customer");
    }

    // Per-shop atomic incrementing RO number.
    const shop = await Shop.findOneAndUpdate(
      { _id: user.shopId },
      { $inc: { "counters.ro": 1 } },
      { new: true }
    ).lean();
    if (!shop) return notFound("Shop not found");
    const number = shop.counters?.ro ?? 1;

    const publicToken = randomBytes(24).toString("base64url");

    const ro = await RepairOrder.create({
      shopId: user.shopId,
      customerId: customer._id,
      vehicleId: vehicle._id,
      number,
      status: "in",
      concern: dto.concern,
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
      lineItems: [],
      laborTotal: 0,
      partsTotal: 0,
      taxTotal: 0,
      total: 0,
      publicToken,
    });

    return created({
      repairOrder: {
        id: String(ro._id),
        number: ro.number,
        status: ro.status,
        customerId: String(ro.customerId),
        vehicleId: String(ro.vehicleId),
        concern: ro.concern ?? null,
        lineItems: [],
        laborTotal: 0,
        partsTotal: 0,
        taxTotal: 0,
        total: 0,
        publicToken: ro.publicToken,
        scheduledFor: ro.scheduledFor ?? null,
        createdAt: ro.createdAt,
        updatedAt: ro.updatedAt,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
