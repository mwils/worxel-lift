import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, Vehicle } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const id = event.pathParameters?.id;
  if (!id) return badRequest("Missing customer id");

  const customer = await Customer.findOne({ _id: id, shopId: user.shopId }).lean();
  if (!customer) return notFound("Customer not found");

  const vehicles = await Vehicle.find({ shopId: user.shopId, customerId: customer._id })
    .sort({ updatedAt: -1 })
    .lean();

  return ok({
    customer: {
      id: String(customer._id),
      firstName: customer.firstName,
      lastName: customer.lastName ?? null,
      phone: customer.phone,
      email: customer.email ?? null,
      notes: customer.notes ?? null,
      taxExempt: customer.taxExempt === true,
      smsOptInAt: customer.smsOptInAt ?? null,
      smsOptOutAt: customer.smsOptOutAt ?? null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    },
    vehicles: vehicles.map((v) => ({
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
    })),
  });
});
