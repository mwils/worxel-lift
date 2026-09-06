import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, RepairOrder, Vehicle } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { presignDownload } from "../../lib/s3.js";
import { serializeEstimate } from "./_estimate.js";

// Photo URLs are presigned for ~1h. The frontend re-fetches the RO often
// enough that the link gets refreshed well before it expires.
const PHOTO_URL_TTL_SEC = 60 * 60;

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const id = event.pathParameters?.id;
  if (!id) return badRequest("Missing repair order id");

  const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId }).lean();
  if (!ro) return notFound("Repair order not found");

  const [customer, vehicle] = await Promise.all([
    Customer.findOne({ _id: ro.customerId, shopId: user.shopId }).lean(),
    Vehicle.findOne({ _id: ro.vehicleId, shopId: user.shopId }).lean(),
  ]);

  const photos = await Promise.all(
    (ro.photos ?? []).map(async (p: any) => ({
      id: String(p._id),
      s3Key: p.s3Key,
      url: await presignDownload(p.s3Key, PHOTO_URL_TTL_SEC),
      takenAt: p.takenAt,
      caption: p.caption ?? null,
    }))
  );

  return ok({
    repairOrder: {
      id: String(ro._id),
      number: ro.number,
      status: ro.status,
      concern: ro.concern ?? null,
      diagnosis: ro.diagnosis ?? null,
      lineItems: (ro.lineItems ?? []).map((li: any) => ({
        id: String(li._id),
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
      // null = pre-snapshot RO; it picks up the shop's current rate the next
      // time its line items change (see _totals.applyRoTotals).
      taxRateBps: ro.taxRateBps ?? null,
      taxAppliesTo: ro.taxAppliesTo ?? null,
      photos,
      estimate: serializeEstimate(ro),
      inspection: (ro as any).inspection
        ? {
            status: (ro as any).inspection.status ?? "draft",
            sentAt: (ro as any).inspection.sentAt ?? null,
            viewedAt: (ro as any).inspection.viewedAt ?? null,
            items: ((ro as any).inspection.items ?? []).map((it: any) => ({
              id: String(it._id),
              title: it.title,
              severity: it.severity,
              note: it.note ?? null,
              photoIds: (it.photoIds ?? []).map((pid: any) => String(pid)),
              order: it.order ?? 0,
              createdAt: it.createdAt ?? null,
              updatedAt: it.updatedAt ?? null,
            })),
            // publicToken intentionally omitted — server-side only.
          }
        : { status: "draft", sentAt: null, viewedAt: null, items: [] },
      payment: ro.payment ?? null,
      publicToken: ro.publicToken ?? null,
      scheduledFor: ro.scheduledFor ?? null,
      completedAt: ro.completedAt ?? null,
      createdAt: ro.createdAt,
      updatedAt: ro.updatedAt,
      customer: customer
        ? {
            id: String(customer._id),
            firstName: customer.firstName,
            lastName: customer.lastName ?? null,
            phone: customer.phone,
            email: customer.email ?? null,
            taxExempt: customer.taxExempt === true,
          }
        : null,
      vehicle: vehicle
        ? {
            id: String(vehicle._id),
            vin: vehicle.vin ?? null,
            year: vehicle.year ?? null,
            make: vehicle.make ?? null,
            model: vehicle.model ?? null,
            trim: vehicle.trim ?? null,
            mileage: vehicle.mileage ?? null,
            plate: vehicle.plate ?? null,
            color: vehicle.color ?? null,
          }
        : null,
    },
  });
});
