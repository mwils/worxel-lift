import type { SNSHandler } from "aws-lambda";
import { connectDb } from "@lift/shared/db";
import {
  AiInteraction,
  Conversation,
  Customer,
  MESSAGE_CLASSIFICATIONS,
  Message,
  RepairOrder,
  RO_OPEN_STATUSES,
  Shop,
  User,
  type MessageClassification,
  type RoStatus,
} from "@lift/shared";
import {
  CLASSIFY_INBOUND_PROMPT_VERSION,
  STATUS_REPLY_PROMPT_VERSION,
  buildClassifyInboundPrompt,
  buildStatusReplyPrompt,
} from "@lift/shared/prompts";
import { invokeModel, modelClassify, modelDraft } from "../../lib/bedrock.js";
import { sendSms } from "../../lib/sms.js";
import { approvalStamp } from "../repairOrders/_estimate.js";

interface InboundSnsPayload {
  originationNumber: string;
  destinationNumber: string;
  messageBody: string;
  messageId: string;
}

const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "END", "QUIT"]);

function isStopKeyword(body: string): boolean {
  // Carriers also honor STOP at their layer; the local flip prevents Lift
  // from queuing further outbound (reminders, drafts) for an opted-out customer.
  //
  // Note: CANCEL is intentionally NOT in this list — for a customer with an
  // upcoming booking, "cancel" means "cancel my appointment," handled below.
  // A bare CANCEL with no booking still falls through to classification.
  const first = body.trim().split(/\s+/)[0] ?? "";
  return STOP_KEYWORDS.has(first.toUpperCase());
}

const BOOKING_KEYWORD_RE = /\b(cancel|reschedul\w*)\b/i;
function isBookingKeyword(body: string): boolean {
  return BOOKING_KEYWORD_RE.test(body);
}

function parseClassification(text: string): {
  classification: MessageClassification;
  confidence: number;
} {
  // The prompt asks for raw JSON, but be defensive: strip code fences/prose,
  // pull the first {...} block, and validate against the allowed enum.
  const stripped = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  const raw = match ? match[0] : stripped;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { classification: "other", confidence: 0 };
  }
  const obj = parsed as { classification?: string; confidence?: number };
  const cls = obj?.classification as MessageClassification | undefined;
  const valid = cls && (MESSAGE_CLASSIFICATIONS as readonly string[]).includes(cls);
  return {
    classification: valid ? (cls as MessageClassification) : "other",
    confidence: typeof obj?.confidence === "number" ? obj.confidence : 0,
  };
}

/**
 * Subscriber for the SNS topic that AWS End User Messaging publishes
 * inbound SMS messages to. Resolve shop → customer, persist inbound
 * Message, classify with Haiku, and either auto-reply (status check /
 * approval) or leave the message in the owner's inbox.
 */
export const handler: SNSHandler = async (event) => {
  await connectDb();

  for (const rec of event.Records) {
    try {
      const payload = JSON.parse(rec.Sns.Message) as InboundSnsPayload;
      const { originationNumber, destinationNumber, messageBody, messageId } = payload;

      console.log("[snsInbound] received", {
        from: originationNumber,
        to: destinationNumber,
        messageId,
      });

      // 1) Resolve tenant. No tenant filter on these lookups — this is how we
      //    *find* the tenant. All subsequent queries are shop-scoped.
      //
      //    Dedicated-number mode: the destination number belongs to exactly
      //    one shop. Shared-number mode (early days — every shop sends from
      //    the same origination number): no shop owns the destination, so
      //    route by the *sender's* phone instead. The unique {shopId, phone}
      //    index means multiple matches = the same person is a customer at
      //    two shops — ambiguous, so log and skip rather than guess.
      let shop = await Shop.findOne({ "sms.phoneNumber": destinationNumber }).lean();
      let customer = shop
        ? await Customer.findOne({ shopId: shop._id, phone: originationNumber }).lean()
        : null;

      if (!shop) {
        const candidates = await Customer.find({ phone: originationNumber }).limit(2).lean();
        const only = candidates.length === 1 ? candidates[0] : undefined;
        if (only) {
          customer = only;
          shop = await Shop.findById(only.shopId).lean();
        } else if (candidates.length > 1) {
          console.error("[snsInbound] phone matches customers at multiple shops — skipping", {
            phone: originationNumber,
          });
          continue;
        }
      }

      if (!shop) {
        console.log("[snsInbound] no shop for inbound message", {
          to: destinationNumber,
          from: originationNumber,
        });
        continue;
      }

      // 2) We do NOT auto-create customers from random inbound texts.
      if (!customer) {
        console.log("[snsInbound] no customer matches phone for shop", {
          shopId: String(shop._id),
          phone: originationNumber,
        });
        continue;
      }

      // 3) Insert inbound Message. Remember where the thread sat first: an
      //    auto-answered status check must not move it (un-bumped in 9).
      const threadBefore = await Conversation.findOne(
        { shopId: shop._id, customerId: customer._id },
        { bumpedAt: 1 }
      ).lean();
      const inboundMsg = await Message.create({
        shopId: shop._id,
        customerId: customer._id,
        direction: "in",
        body: messageBody,
        awsMessageId: messageId,
      });

      // 3a) STOP-keyword short-circuit. Flip the opt-out flag and skip
      //     classification/auto-reply entirely — we never want to spend
      //     Bedrock tokens or send a follow-up to a customer who just opted out.
      if (isStopKeyword(messageBody)) {
        await Customer.updateOne(
          { _id: customer._id, shopId: shop._id },
          { $set: { smsOptOutAt: new Date() } }
        );
        inboundMsg.inboundClassification = "opt_out";
        await inboundMsg.save();
        // Nothing to reply to — texting an opted-out customer is prohibited.
        await Conversation.updateOne(
          { shopId: shop._id, customerId: customer._id },
          { $set: { needsReply: false } }
        );
        console.log("[snsInbound] STOP keyword — opted customer out", {
          shopId: String(shop._id),
          customerId: String(customer._id),
        });
        continue;
      }

      // 3b) Booking-keyword short-circuit. If the message looks like
      //     "cancel" / "reschedule" AND the customer has an upcoming scheduled
      //     RO with a bookingToken, reply with the manage link and skip
      //     classification. This is deterministic — we don't want Bedrock
      //     guessing whether "reschedule" means "tell me the price."
      if (isBookingKeyword(messageBody)) {
        const upcomingBooking = await RepairOrder.findOne({
          shopId: shop._id,
          customerId: customer._id,
          status: "scheduled",
          bookingToken: { $exists: true, $ne: null },
          scheduledFor: { $gte: new Date() },
        })
          .sort({ scheduledFor: 1 })
          .lean();

        if (upcomingBooking?.bookingToken) {
          const manageUrl = `${process.env.MARKETING_URL ?? ""}/booking/${upcomingBooking.bookingToken}`;
          const replyBody = `No problem — change or cancel here: ${manageUrl}`;

          const ownerForMock = shop.ownerUserId
            ? await User.findById(shop.ownerUserId).lean()
            : null;
          const sendResult = await sendSms({
            to: customer.phone,
            from: shop.sms?.phoneNumber ?? undefined,
            body: replyBody,
            mockEmailRecipient: customer.email ?? ownerForMock?.email ?? undefined,
          });
          await Message.create({
            shopId: shop._id,
            customerId: customer._id,
            repairOrderId: upcomingBooking._id,
            direction: "out",
            body: replyBody,
            awsMessageId: sendResult.messageId,
            autoReplied: true,
          });
          console.log("[snsInbound] booking keyword — sent manage link", {
            shopId: String(shop._id),
            customerId: String(customer._id),
            bookingRoId: String(upcomingBooking._id),
          });
          continue;
        }
        // Falls through to classification if no upcoming booking matches.
      }

      // 4) Look up the customer's most recent OPEN repair order.
      const openRo = await RepairOrder.findOne({
        shopId: shop._id,
        customerId: customer._id,
        status: { $in: RO_OPEN_STATUSES as RoStatus[] },
      })
        .sort({ updatedAt: -1 })
        .exec();

      const hasActiveRo = !!openRo;
      const hasOpenEstimate =
        !!openRo?.estimate?.sentAt && !openRo?.estimate?.approvedAt;

      // 5) Classify via Haiku.
      const classifyPrompt = buildClassifyInboundPrompt({
        body: messageBody,
        hasActiveRo,
        hasOpenEstimate,
      });

      const classifyModel = modelClassify();
      const classifyStart = Date.now();
      let classification: MessageClassification = "other";
      let confidence = 0;
      let classifyResult: Awaited<ReturnType<typeof invokeModel>> | null = null;
      let classifyError: string | undefined;

      try {
        classifyResult = await invokeModel({
          modelId: classifyModel,
          prompt: classifyPrompt,
          maxTokens: 100,
          temperature: 0,
        });
        const parsed = parseClassification(classifyResult.text);
        classification = parsed.classification;
        confidence = parsed.confidence;
      } catch (err) {
        classifyError = (err as Error).message;
        console.error("[snsInbound] classify failed", err);
      }

      await AiInteraction.create({
        shopId: shop._id,
        kind: "classify_inbound",
        model: classifyModel,
        promptVersion: CLASSIFY_INBOUND_PROMPT_VERSION,
        inputTokens: classifyResult?.inputTokens,
        outputTokens: classifyResult?.outputTokens,
        durationMs: Date.now() - classifyStart,
        error: classifyError,
      });

      // 6) Persist the classification on the inbound message.
      inboundMsg.inboundClassification = classification;
      await inboundMsg.save();

      console.log("[snsInbound] classified", {
        messageId: String(inboundMsg._id),
        classification,
        confidence,
        hasActiveRo,
        hasOpenEstimate,
      });

      // 7) Per-shop kill switch.
      if (!shop.settings?.autoReplyEnabled) {
        console.log("[snsInbound] auto-reply disabled for shop", String(shop._id));
        continue;
      }

      // 8) Look up the owner email for SMS mock fallback (when MOCK_SMS=1).
      const ownerUser = shop.ownerUserId
        ? await User.findById(shop.ownerUserId).lean()
        : null;
      const mockEmailRecipient = customer.email ?? ownerUser?.email ?? undefined;

      // 9) Branch on classification.
      if (classification === "status_check" && openRo) {
        const statusPrompt = buildStatusReplyPrompt({
          customerFirstName: customer.firstName,
          shopName: shop.name,
          roStatus: openRo.status,
          aiTone: shop.settings?.aiTone === "friendly" ? "friendly" : "plain",
        });

        const draftModel = modelDraft();
        const draftStart = Date.now();
        let replyBody = "";
        let draftResult: Awaited<ReturnType<typeof invokeModel>> | null = null;
        let draftError: string | undefined;

        try {
          draftResult = await invokeModel({
            modelId: draftModel,
            prompt: statusPrompt,
            maxTokens: 200,
            temperature: 0.4,
          });
          replyBody = draftResult.text.trim().replace(/^["']|["']$/g, "");
        } catch (err) {
          draftError = (err as Error).message;
          console.error("[snsInbound] status reply draft failed", err);
        }

        await AiInteraction.create({
          shopId: shop._id,
          kind: "status_reply",
          model: draftModel,
          promptVersion: STATUS_REPLY_PROMPT_VERSION,
          inputTokens: draftResult?.inputTokens,
          outputTokens: draftResult?.outputTokens,
          durationMs: Date.now() - draftStart,
          error: draftError,
        });

        if (replyBody) {
          const sendResult = await sendSms({
            to: customer.phone,
            from: shop.sms?.phoneNumber ?? undefined,
            body: replyBody,
            mockEmailRecipient,
          });

          await Message.create({
            shopId: shop._id,
            customerId: customer._id,
            repairOrderId: openRo._id,
            direction: "out",
            body: replyBody,
            awsMessageId: sendResult.messageId,
            aiDrafted: true,
            aiModel: draftModel,
            aiPromptVersion: STATUS_REPLY_PROMPT_VERSION,
            autoReplied: true,
          });
          // Handled without Mike: put the thread back where it was so the
          // inbox doesn't churn on "is it ready yet?" texts. snsDelivery
          // re-bumps it if the reply fails to deliver.
          await Conversation.updateOne(
            { shopId: shop._id, customerId: customer._id },
            {
              $set: {
                needsReply: false,
                bumpedAt: threadBefore?.bumpedAt ?? inboundMsg.sentAt ?? new Date(),
              },
            }
          );
        }
        continue;
      }

      if (classification === "approval" && openRo && hasOpenEstimate) {
        // Same snapshot the public Approve button takes, so a later line edit
        // is flagged "changed since approval" regardless of how they said yes.
        const stamp = approvalStamp(openRo);
        openRo.estimate = openRo.estimate ?? {};
        openRo.estimate.approvedAt = stamp.approvedAt;
        openRo.estimate.approvedTotal = stamp.approvedTotal;
        openRo.estimate.approvedLineItems = stamp.approvedLineItems as any;
        openRo.status = "in_repair";
        await openRo.save();

        const replyBody = "Got it — approved. We'll text you when she's ready.";
        const sendResult = await sendSms({
          to: customer.phone,
          from: shop.sms?.phoneNumber ?? undefined,
          body: replyBody,
          mockEmailRecipient,
        });

        await Message.create({
          shopId: shop._id,
          customerId: customer._id,
          repairOrderId: openRo._id,
          direction: "out",
          body: replyBody,
          awsMessageId: sendResult.messageId,
          aiDrafted: false,
          autoReplied: true,
        });
        continue;
      }

      // question / other / classification w/o matching context: do nothing.
      // The message sits in the owner's inbox for manual reply.
      console.log("[snsInbound] no auto-reply branch matched", {
        classification,
        hasActiveRo,
        hasOpenEstimate,
      });
    } catch (err) {
      console.error("[snsInbound] failed", err);
    }
  }
};
