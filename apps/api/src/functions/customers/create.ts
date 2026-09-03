import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { CreateCustomerDto, Customer, Message, Shop } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, created, ok } from "../../lib/response.js";
import { sendSms } from "../../lib/sms.js";

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

    // Opt-in confirmation text, required by our 10DLC registration ("verbal
    // opt-in gets a written confirmation"). Best-effort: never fail customer
    // creation over a carrier hiccup — the record and consent stand either way.
    const shop = await Shop.findById(user.shopId).lean();
    // "Worxel" (registered 10DLC DBA) must appear in the opt-in confirmation
    // — carrier vetting rejects opt-in/opt-out texts without the brand name.
    const confirmBody =
      `${shop?.name ?? "Your repair shop"} via Worxel Lift: You're set to get text updates ` +
      `about your vehicle. Msg frequency varies. Msg & data rates may apply. ` +
      `Reply HELP for help, STOP to cancel.`;
    try {
      const sendResult = await sendSms({
        to: customer.phone,
        from: shop?.sms?.phoneNumber ?? undefined,
        body: confirmBody,
        mockEmailRecipient: customer.email ?? undefined,
      });
      await Message.create({
        shopId: user.shopId,
        customerId: customer._id,
        direction: "out",
        body: confirmBody,
        sentAt: new Date(),
        awsMessageId: sendResult.messageId,
        automated: true,
        deliveryStatus: "sent",
      });
    } catch (err) {
      console.error("[customers/create] opt-in confirmation SMS failed", err);
      // Still record the attempt so the thread shows a "Not delivered" marker
      // instead of silently having no opt-in text at all.
      try {
        await Message.create({
          shopId: user.shopId,
          customerId: customer._id,
          direction: "out",
          body: confirmBody,
          sentAt: new Date(),
          automated: true,
          deliveryStatus: "failed",
        });
      } catch (recordErr) {
        console.error("[customers/create] could not record failed opt-in text", recordErr);
      }
    }

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
