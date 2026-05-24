import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, RepairOrder, Shop, Vehicle } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const ro = await RepairOrder.findOne({ bookingToken: token }).lean();
  if (!ro) return notFound();

  const [customer, vehicle, shop] = await Promise.all([
    Customer.findById(ro.customerId).lean(),
    Vehicle.findById(ro.vehicleId).lean(),
    Shop.findById(ro.shopId).lean(),
  ]);

  const cancellable =
    ro.status !== "cancelled_by_customer" &&
    ro.status !== "voided" &&
    ro.status !== "picked_up";

  return ok({
    shop: shop
      ? { name: shop.name, slug: shop.slug, timezone: shop.timezone ?? null }
      : null,
    customer: customer
      ? { firstName: customer.firstName, lastName: customer.lastName ?? null }
      : null,
    vehicle: vehicle
      ? {
          year: vehicle.year ?? null,
          make: vehicle.make ?? null,
          model: vehicle.model ?? null,
        }
      : null,
    booking: {
      scheduledFor: ro.scheduledFor?.toISOString() ?? null,
      status: ro.status,
      concern: ro.concern ?? null,
      cancellable,
      rescheduleable: cancellable && ro.status === "scheduled",
    },
  });
});
