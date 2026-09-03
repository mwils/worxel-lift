import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound } from "../../lib/response.js";
import { RepairOrder, Customer, Vehicle, Shop } from "@lift/shared";
import { estimateTokenQuery, serializeEstimate } from "../repairOrders/_estimate.js";

// The RO's public token is minted at creation, so the link resolves before
// the owner has actually sent anything. Distinguish that from a bad link so
// the page can say "not ready yet" instead of "expired".
function estimateNotSent() {
  return {
    statusCode: 404,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      error: { code: "estimate_not_sent", message: "This estimate hasn't been sent yet" },
    }),
  };
}

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const ro = await RepairOrder.findOne(estimateTokenQuery(token)).lean();
  if (!ro) return notFound();
  if (!ro.estimate?.sentAt) return estimateNotSent();

  if (!ro.estimate.viewedAt) {
    const viewedAt = new Date();
    await RepairOrder.updateOne(
      { _id: ro._id, "estimate.viewedAt": { $exists: false } },
      { $set: { "estimate.viewedAt": viewedAt } }
    );
    ro.estimate.viewedAt = viewedAt;
  }

  const [customer, vehicle, shop] = await Promise.all([
    Customer.findById(ro.customerId).lean(),
    Vehicle.findById(ro.vehicleId).lean(),
    Shop.findById(ro.shopId).lean(),
  ]);

  const address = shop?.address;
  const hasAddress = !!(address?.line1 || address?.city);

  return ok({
    ro: {
      number: ro.number,
      status: ro.status,
      concern: ro.concern ?? null,
      lineItems: (ro.lineItems ?? []).map((li: any) => ({
        kind: li.kind,
        description: li.description,
        hours: li.hours ?? null,
        rate: li.rate ?? null,
        qty: li.qty ?? null,
        unitPrice: li.unitPrice ?? null,
        total: li.total,
      })),
      laborTotal: ro.laborTotal ?? 0,
      partsTotal: ro.partsTotal ?? 0,
      taxTotal: ro.taxTotal ?? 0,
      total: ro.total ?? 0,
      estimate: serializeEstimate(ro),
    },
    customer: customer
      ? { firstName: customer.firstName, lastName: customer.lastName ?? null }
      : null,
    vehicle: vehicle
      ? { year: vehicle.year ?? null, make: vehicle.make ?? null, model: vehicle.model ?? null }
      : null,
    shop: shop
      ? {
          name: shop.name,
          phone: shop.sms?.phoneNumber ?? null,
          address: hasAddress
            ? {
                line1: address?.line1 ?? null,
                line2: address?.line2 ?? null,
                city: address?.city ?? null,
                state: address?.state ?? null,
                zip: address?.zip ?? null,
              }
            : null,
        }
      : null,
  });
});
