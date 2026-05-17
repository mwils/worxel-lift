import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { CreateCustomerDto, Customer } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, created, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, CreateCustomerDto);

    // Idempotent on the unique (shopId, phone) index: if this phone already exists,
    // return the existing customer instead of throwing a duplicate-key error.
    const existing = await Customer.findOne({ shopId: user.shopId, phone: dto.phone }).lean();
    if (existing) {
      return ok({
        customer: {
          id: String(existing._id),
          firstName: existing.firstName,
          lastName: existing.lastName ?? null,
          phone: existing.phone,
          email: existing.email ?? null,
          notes: existing.notes ?? null,
          smsOptInAt: existing.smsOptInAt ?? null,
        },
      });
    }

    const customer = await Customer.create({
      shopId: user.shopId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      notes: dto.notes,
      // Customer opts in at the moment of creation (TCPA opt-in language is
      // included in the shop onboarding script / first outbound).
      smsOptInAt: new Date(),
    });

    return created({
      customer: {
        id: String(customer._id),
        firstName: customer.firstName,
        lastName: customer.lastName ?? null,
        phone: customer.phone,
        email: customer.email ?? null,
        notes: customer.notes ?? null,
        smsOptInAt: customer.smsOptInAt ?? null,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
