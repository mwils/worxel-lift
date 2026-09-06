import type { SNSHandler } from "aws-lambda";
import { connectDb } from "@lift/shared/db";
import { Conversation, Message } from "@lift/shared";

/**
 * Subscriber for the SNS topic that AWS End User Messaging publishes
 * SMS delivery events to. The event shape (from PinpointSMSVoiceV2):
 *
 *   {
 *     "messageId": "<id we received from SendTextMessage>",
 *     "eventType": "TEXT_SUCCESSFUL" | "TEXT_DELIVERED" | "TEXT_PENDING"
 *                 | "TEXT_QUEUED" | "TEXT_INVALID" | "TEXT_UNREACHABLE"
 *                 | "TEXT_BLOCKED" | "TEXT_CARRIER_BLOCKED" | "TEXT_TTL_EXPIRED"
 *                 | "TEXT_CARRIER_UNREACHABLE" | "TEXT_SPAM" | "TEXT_UNKNOWN" ...,
 *     ...
 *   }
 *
 * We collapse all of these into a tri-state `deliveryStatus` on the
 * Message doc keyed by `awsMessageId`.
 */

type DeliveryStatus = "sent" | "delivered" | "failed";

function mapEventTypeToStatus(eventType: string | undefined): DeliveryStatus | null {
  if (!eventType) return null;
  const t = eventType.toUpperCase();
  if (t.includes("DELIVERED")) return "delivered";
  if (t.includes("SUCCESS") || t.includes("PENDING") || t.includes("QUEUED")) return "sent";
  if (
    t.includes("INVALID") ||
    t.includes("UNREACHABLE") ||
    t.includes("BLOCKED") ||
    t.includes("EXPIRED") ||
    t.includes("SPAM") ||
    t.includes("FAIL")
  ) {
    return "failed";
  }
  return null;
}

interface DeliveryEvent {
  messageId?: string;
  eventType?: string;
  // older shapes / variants
  MessageId?: string;
  EventType?: string;
}

export const handler: SNSHandler = async (event) => {
  await connectDb();

  for (const rec of event.Records) {
    try {
      const payload = JSON.parse(rec.Sns.Message) as DeliveryEvent;
      const awsMessageId = payload.messageId ?? payload.MessageId;
      const eventType = payload.eventType ?? payload.EventType;

      if (!awsMessageId) {
        console.log("[snsDelivery] no messageId in event", payload);
        continue;
      }

      const status = mapEventTypeToStatus(eventType);
      if (!status) {
        console.log("[snsDelivery] unmapped eventType", { awsMessageId, eventType });
        continue;
      }

      // No shopId filter here: awsMessageId is a globally-unique AWS id,
      // and the message it points at is already shop-scoped. updateOne
      // touches exactly one document.
      const res = await Message.updateOne(
        { awsMessageId },
        { $set: { deliveryStatus: status } }
      );

      console.log("[snsDelivery] updated", {
        awsMessageId,
        eventType,
        status,
        matched: res.matchedCount,
        modified: res.modifiedCount,
      });

      // A bounced text is something Mike has to act on, so surface the
      // thread again — and if it was an auto-reply, the customer is still
      // waiting on an answer.
      if (status === "failed" && res.matchedCount > 0) {
        const failed = await Message.findOne(
          { awsMessageId, direction: "out" },
          { shopId: 1, customerId: 1, autoReplied: 1 }
        ).lean();
        if (failed) {
          await Conversation.updateOne(
            { shopId: failed.shopId, customerId: failed.customerId },
            {
              $set: {
                bumpedAt: new Date(),
                ...(failed.autoReplied ? { needsReply: true } : {}),
              },
            }
          );
        }
      }
    } catch (err) {
      console.error("[snsDelivery] failed", err);
    }
  }
};
