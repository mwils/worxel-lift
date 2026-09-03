import type mongoose from "mongoose";
import { Message, Shop } from "@lift/shared";
import { sendSms } from "../../lib/sms.js";

/**
 * Opt-in confirmation text, required by our 10DLC registration ("verbal
 * opt-in gets a written confirmation"). Sent when a customer is created and
 * again whenever their phone number changes — the new number has never seen
 * the consent language.
 *
 * "Worxel" (registered 10DLC DBA) must appear in the opt-in confirmation —
 * carrier vetting rejects opt-in/opt-out texts without the brand name.
 *
 * Best-effort: never fail the calling request over a carrier hiccup — the
 * record and consent stand either way.
 */
export async function sendOptInConfirmation(input: {
  shopId: mongoose.Types.ObjectId | string;
  customerId: mongoose.Types.ObjectId;
  phone: string;
  email?: string | null;
}): Promise<void> {
  try {
    const shop = await Shop.findById(input.shopId).lean();
    const confirmBody =
      `${shop?.name ?? "Your repair shop"} via Worxel Lift: You're set to get text updates ` +
      `about your vehicle. Msg frequency varies. Msg & data rates may apply. ` +
      `Reply HELP for help, STOP to cancel.`;
    const sendResult = await sendSms({
      to: input.phone,
      from: shop?.sms?.phoneNumber ?? undefined,
      body: confirmBody,
      mockEmailRecipient: input.email ?? undefined,
    });
    await Message.create({
      shopId: input.shopId,
      customerId: input.customerId,
      direction: "out",
      body: confirmBody,
      sentAt: new Date(),
      awsMessageId: sendResult.messageId,
      autoReplied: true,
    });
  } catch (err) {
    console.error("[customers] opt-in confirmation SMS failed", err);
  }
}
