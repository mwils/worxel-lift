import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, RepairOrder, Shop, Vehicle } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound } from "../../lib/response.js";
import { loadPaymentRows, serializePaymentRow, serializeRoPayment } from "../repairOrders/_payments.js";

/**
 * GET /public/receipt/:token
 *
 * Token-scoped, unauthenticated. Everything the customer needs to keep for
 * their records: shop, RO number (= invoice reference), vehicle, line items,
 * tax, total, each payment (method + date), and what's still open. Payment
 * notes are the owner's ("paid by wife") and are NOT included.
 */
export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const ro = await RepairOrder.findOne({ receiptToken: token }).lean();
  if (!ro) return notFound();

  const [customer, vehicle, shop, rows] = await Promise.all([
    Customer.findById(ro.customerId).lean(),
    Vehicle.findById(ro.vehicleId).lean(),
    Shop.findById(ro.shopId).lean(),
    loadPaymentRows(ro.shopId, ro._id),
  ]);

  const payment = serializeRoPayment(ro, rows);
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
      completedAt: ro.completedAt ?? null,
      createdAt: ro.createdAt,
    },
    payment: {
      status: payment.status,
      collectedCents: payment.collectedCents,
      balanceCents: payment.balanceCents,
    },
    // Voided rows never happened; refunded rows stay so the customer sees the money came back.
    payments: rows
      .filter((r) => r.status === "succeeded" || r.status === "refunded")
      .map((r) => serializePaymentRow(r, { includeNote: false })),
    customer: customer
      ? { firstName: customer.firstName, lastName: customer.lastName ?? null }
      : null,
    vehicle: vehicle
      ? {
          year: vehicle.year ?? null,
          make: vehicle.make ?? null,
          model: vehicle.model ?? null,
          plate: vehicle.plate ?? null,
          vin: vehicle.vin ?? null,
          mileage: vehicle.mileage ?? null,
        }
      : null,
    shop: shop
      ? {
          name: shop.name,
          phone: shop.phone ?? shop.sms?.phoneNumber ?? null,
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
