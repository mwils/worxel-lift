import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { MESSAGE_CLASSIFICATIONS } from "../constants.js";

const MessageSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    repairOrderId: { type: Schema.Types.ObjectId, ref: "RepairOrder" },

    direction: { type: String, enum: ["in", "out"], required: true },
    body: { type: String, required: true },
    mediaUrls: { type: [String], default: [] }, // s3 keys

    sentAt: { type: Date, default: () => new Date() },
    awsMessageId: String,

    aiDrafted: { type: Boolean, default: false },
    aiModel: String,
    aiPromptVersion: String,

    inboundClassification: { type: String, enum: MESSAGE_CLASSIFICATIONS },
    autoReplied: { type: Boolean, default: false },

    // Updated by the snsDelivery Lambda based on End User Messaging delivery events.
    deliveryStatus: { type: String, enum: ["sent", "delivered", "failed"] },
  },
  { timestamps: true }
);

MessageSchema.index({ shopId: 1, customerId: 1, sentAt: -1 });

export type MessageDoc = InferSchemaType<typeof MessageSchema> & { _id: mongoose.Types.ObjectId };

export const Message: Model<MessageDoc> =
  (mongoose.models.Message as Model<MessageDoc>) ||
  mongoose.model<MessageDoc>("Message", MessageSchema);
