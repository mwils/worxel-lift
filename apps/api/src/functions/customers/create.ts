import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { CreateCustomerDto, Customer } from "@lift/shared";
import { findPossibleDuplicates } from "../../lib/findDuplicates.js";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, conflict, created, ok } from "../../lib/response.js";
import { sendOptInConfirmation } from "./_optIn.js";

// `force` is create-only (the UI's "Create anyway"); kept out of the shared
// DTO so UpdateCustomerDto's $set loop can never write it to a document.
const CreateBody = CreateCustomerDto.extend({ force: z.boolean().optional() });

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, CreateBody);

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

    // Same person, different phone? Ask before creating a second record.
    // Phone matched nothing, so this is name (last name + first initial,
    // punctuation-insensitive) or email. 409 with the candidates; the UI
    // re-posts with force:true for "Create anyway".
    if (!dto.force) {
      const candidates = await findPossibleDuplicates({
        shopId: user.shopId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
      });
      if (candidates.length > 0) {
        return conflict("A customer with a similar name already exists", {
          reason: "possible_duplicates",
          candidates,
        });
      }
    }

    const customer = await Customer.create({
      shopId: user.shopId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      notes: dto.notes,
      taxExempt: dto.taxExempt === true,
      // Customer opts in at the moment of creation (TCPA opt-in language is
      // included in the shop onboarding script / first outbound).
      smsOptInAt: new Date(),
    });

    // Opt-in confirmation text (10DLC). Best-effort — see _optIn.ts.
    await sendOptInConfirmation({
      shopId: user.shopId,
      customerId: customer._id,
      phone: customer.phone,
      email: customer.email,
    });

    return created({
      customer: {
        id: String(customer._id),
        firstName: customer.firstName,
        lastName: customer.lastName ?? null,
        phone: customer.phone,
        email: customer.email ?? null,
        notes: customer.notes ?? null,
        taxExempt: customer.taxExempt === true,
        smsOptInAt: customer.smsOptInAt ?? null,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
