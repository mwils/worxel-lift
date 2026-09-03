import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, Message, UpdateCustomerDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { sendOptInConfirmation } from "./_optIn.js";

function prettyPhone(e164: string): string {
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing customer id");

    const dto = await parseBody(event, UpdateCustomerDto);
    // PATCH semantics: undefined = leave alone, null = clear the field.
    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(dto)) {
      if (v === undefined) continue;
      if (v === null) unset[k] = "";
      else set[k] = v;
    }

    const before = await Customer.findOne({ _id: id, shopId: user.shopId }).lean();
    if (!before) return notFound("Customer not found");

    // Phone change: the new number has never received the TCPA opt-in
    // language, so we re-send the confirmation and record the old number.
    // Only when the E.164 actually differs — re-saving the same number is a no-op.
    const now = new Date();
    const phoneChanged = typeof dto.phone === "string" && dto.phone !== before.phone;
    const push: Record<string, unknown> = {};
    if (phoneChanged) {
      const clash = await Customer.findOne({ shopId: user.shopId, phone: dto.phone })
        .select({ _id: 1 })
        .lean();
      if (clash) return badRequest("Another customer already has that phone number");
      push.phoneHistory = { phone: before.phone, changedAt: now };
      set.smsOptInAt = now;
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: id, shopId: user.shopId },
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
        ...(Object.keys(push).length ? { $push: push } : {}),
      },
      { new: true }
    ).lean();
    if (!customer) return notFound("Customer not found");

    if (phoneChanged) {
      // System note so the thread (still keyed by customerId) shows which
      // texts went to the old number. Never sent as an SMS.
      try {
        await Message.create({
          shopId: user.shopId,
          customerId: customer._id,
          direction: "out",
          kind: "system",
          body:
            `Phone number changed from ${prettyPhone(before.phone)} to ` +
            `${prettyPhone(customer.phone)}. Earlier texts went to the old number.`,
          sentAt: now,
        });
      } catch (err) {
        console.error("[customers/patch] phone-change note failed", err);
      }
      // A customer who replied STOP stays opted out — changing the number in
      // the shop's records isn't consent, so no text goes out.
      if (!customer.smsOptOutAt) {
        await sendOptInConfirmation({
          shopId: user.shopId,
          customerId: customer._id,
          phone: customer.phone,
          email: customer.email,
        });
      }
    }

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
