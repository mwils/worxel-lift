import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound } from "../../lib/response.js";
import { RepairOrder, Customer, Vehicle, Shop } from "@lift/shared";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const ro = await RepairOrder.findOne({ publicToken: token }).lean();
  if (!ro) return notFound();

  const [customer, vehicle, shop] = await Promise.all([
    Customer.findById(ro.customerId).lean(),
    Vehicle.findById(ro.vehicleId).lean(),
    Shop.findById(ro.shopId).lean(),
  ]);

  return ok({
    ro: {
      number: ro.number,
      status: ro.status,
      concern: ro.concern,
      lineItems: ro.lineItems,
      total: ro.total,
      estimate: ro.estimate,
    },
    customer: customer ? { firstName: customer.firstName, lastName: customer.lastName } : null,
    vehicle: vehicle ? { year: vehicle.year, make: vehicle.make, model: vehicle.model } : null,
    shop: shop ? { name: shop.name } : null,
  });
});
