import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, UpdateCustomerDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing customer id");

    const dto = await parseBody(event, UpdateCustomerDto);
    // Drop undefined keys so we don't clobber existing fields with $set: undefined.
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v !== undefined) update[k] = v;
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, shopId: user.shopId },
      { $set: update },
      { new: true }
    ).lean();
    if (!customer) return notFound("Customer not found");

    return ok({
      customer: {
        id: String(customer._id),
        firstName: customer.firstName,
        lastName: customer.lastName ?? null,
        phone: customer.phone,
        email: customer.email ?? null,
        notes: customer.notes ?? null,
        smsOptInAt: customer.smsOptInAt ?? null,
        smsOptOutAt: customer.smsOptOutAt ?? null,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
