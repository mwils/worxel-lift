import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Vehicle } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { resolveCustomerByIdOrAlias } from "./_resolve.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const id = event.pathParameters?.id;
  if (!id) return badRequest("Missing customer id");

  // Follows the merge trail so links to a merged-away duplicate still work.
  const resolved = await resolveCustomerByIdOrAlias(user.shopId, id);
  if (!resolved) return notFound("Customer not found");
  const { customer } = resolved;

  // Pickers (RO wizard) read this — archived (sold / totalled) cars stay
  // out. The customer page uses /history, which returns them separately.
  const vehicles = await Vehicle.find({
    shopId: user.shopId,
    customerId: customer._id,
    archivedAt: null,
  })
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
