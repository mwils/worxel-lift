import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MESSAGE_CLASSIFICATIONS } from "../constants.js";
import { applyMessageToConversation, type ConversationMessageInput } from "./conversation.js";

const MessageSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    repairOrderId: { type: Schema.Types.ObjectId, ref: "RepairOrder" },

    direction: { type: String, enum: ["in", "out"], required: true },
    // "system" = a note in the thread that was never texted (e.g. "phone
    // number changed"). Everything else is a real SMS.
    kind: { type: String, enum: ["sms", "system"], default: "sms" },
    body: { type: String, required: true },
    mediaUrls: { type: [String], default: [] }, // s3 keys

    sentAt: { type: Date, default: () => new Date() },
    awsMessageId: String,

    aiDrafted: { type: Boolean, default: false },
    aiModel: String,
    aiPromptVersion: String,

    // Set on outbound messages sent by the service-reminder cron so the
    // conversation view and reporting can attribute them back to a reminder.
    serviceReminderId: { type: Schema.Types.ObjectId, ref: "ServiceReminder" },

    inboundClassification: { type: String, enum: MESSAGE_CLASSIFICATIONS },
    // Outbound text sent *in reply to* an inbound customer text without the
    // owner touching it (AI status reply, booking-keyword reply, etc.).
    autoReplied: { type: Boolean, default: false },
    // Outbound text the system sent on its own — opt-in confirmation, booking
    // confirmation / change notices, service reminders. Not a reply to anything,
    // so the UI must not tag it "Auto-replied".
    automated: { type: Boolean, default: false },

    // Updated by the snsDelivery Lambda based on End User Messaging delivery events.
    deliveryStatus: { type: String, enum: ["sent", "delivered", "failed"] },
  },
  { timestamps: true }
);

MessageSchema.index({ shopId: 1, customerId: 1, sentAt: -1 });

// Keep the per-customer Conversation row current for every write site
// (18 of them at last count) without each having to remember. Only the
// first save counts — snsInbound re-saves the inbound doc to attach the
// classification, and that must not double-count.
MessageSchema.pre("save", function () {
  this.$locals.wasNew = this.isNew;
});
MessageSchema.post("save", async function () {
  if (!this.$locals.wasNew) return;
  try {
    await applyMessageToConversation(this as unknown as ConversationMessageInput);
  } catch (err) {
    // The text already went out; a stale inbox row is repairable
    // (scripts/backfillConversations.ts) — a failed send is not.
    console.error("[Message] conversation update failed", err);
  }
});

export type MessageDoc = InferSchemaType<typeof MessageSchema> & { _id: mongoose.Types.ObjectId };

export const Message: Model<MessageDoc> =
  (mongoose.models.Message as Model<MessageDoc>) ||
  mongoose.model<MessageDoc>("Message", MessageSchema);
