import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import {
  CreatePayLinkDto,
  Customer,
  Message,
  RepairOrder,
  Shop,
  User,
  PAY_LINK_PROMPT_VERSION,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withVerifiedAuth } from "../../lib/middleware.js";
import { ok, badRequest, forbidden, notFound } from "../../lib/response.js";
import { sendSms } from "../../lib/sms.js";
import { modelDraft } from "../../lib/bedrock.js";

const TEMPLATE_VERSION = "pay_link.template.v1";

function publicPayUrl(token: string): string {
  const base = (process.env.WEB_APP_URL ?? "http://localhost:5173").replace(/\/+$/, "");
  return `${base}/public/pay/${token}`;
}

/**
 * POST /payments/create-link
 *
 * Two modes:
 *
 *   1. `{ repairOrderId }` only — returns `{ url, token }`. Used by the
 *      frontend to mint the public pay URL so it can embed it in a draft
 *      SMS that the owner reviews.
 *
 *   2. `{ repairOrderId, draftOverride, useAi? }` — actually sends the owner-
 *      approved SMS to the customer via End User Messaging (or the SES
 *      mocking path when MOCK_SMS=1) and records a Message. Mirrors
 *      `POST /repair-orders/:id/send-estimate`.
 */
export const handler: APIGatewayProxyHandlerV2 = withVerifiedAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("User has no shop");
    const dto = await parseBody(event, CreatePayLinkDto);

    // Payments are set up lazily (Stripe Connect Standard) — refuse to mint a
    // link the customer couldn't pay, and say how to fix it.
    const gateShop = await Shop.findById(user.shopId).lean();
    if (gateShop?.stripe?.connectChargesEnabled !== true) {
      return forbidden(
        "Payments aren't set up yet — go to Settings → Getting paid. Takes about 5 minutes, then you can text pay links."
      );
    }

    const ro = await RepairOrder.findOne({ _id: dto.repairOrderId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");
    if (!ro.total || ro.total <= 0) {
      return badRequest("Repair order has no total — add line items before sending a pay link");
    }

    if (!ro.publicToken) {
      ro.publicToken = randomBytes(16).toString("base64url");
      await ro.save();
    }

    const url = publicPayUrl(ro.publicToken);

    // Mode 1: URL-only (frontend draft prep). Don't send anything yet.
    if (!dto.draftOverride || dto.draftOverride.trim().length === 0) {
      return ok({ url, token: ro.publicToken });
    }

    // Mode 2: owner reviewed the draft and clicked Send.
    const [customer, shop] = await Promise.all([
      Customer.findOne({ _id: ro.customerId, shopId: user.shopId }).lean(),
      Shop.findById(user.shopId).lean(),
    ]);
    if (!customer) return notFound("Customer not found");
    if (!shop) return notFound("Shop not found");

    const draft = dto.draftOverride.trim();
    const aiDrafted = dto.useAi === true;
    const model = modelDraft();
    const promptVersion = aiDrafted ? PAY_LINK_PROMPT_VERSION : TEMPLATE_VERSION;

    const owner = shop.ownerUserId
      ? await User.findById(shop.ownerUserId).lean()
      : null;
    const mockEmailRecipient = customer.email ?? owner?.email;

    const smsResult = await sendSms({
      to: customer.phone,
      from: shop.sms?.phoneNumber ?? undefined,
      body: draft,
      mockEmailRecipient: mockEmailRecipient ?? undefined,
    });

    const message = await Message.create({
      shopId: user.shopId,
      customerId: customer._id,
      repairOrderId: ro._id,
      direction: "out",
      body: draft,
      sentAt: new Date(),
      aiDrafted,
      aiModel: aiDrafted ? model : undefined,
      aiPromptVersion: promptVersion,
      awsMessageId: smsResult.messageId,
    });

    return ok({
      url,
      token: ro.publicToken,
      message: {
        id: String(message._id),
        customerId: String(message.customerId),
        repairOrderId: message.repairOrderId ? String(message.repairOrderId) : null,
        direction: message.direction,
        body: message.body,
        sentAt: message.sentAt,
        aiDrafted: message.aiDrafted,
        awsMessageId: message.awsMessageId ?? null,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
