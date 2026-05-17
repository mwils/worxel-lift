import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, RepairOrder, Vehicle } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

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
      photos: (ro.photos ?? []).map((p: any) => ({
        id: String(p._id),
        s3Key: p.s3Key,
        takenAt: p.takenAt,
        caption: p.caption ?? null,
      })),
      estimate: ro.estimate ?? null,
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
