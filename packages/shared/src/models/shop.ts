import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ShopSchema = new Schema(
  {
    name: { type: String, required: true },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zip: String,
    },
    timezone: { type: String, default: "America/Chicago" },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    sms: {
      phoneNumber: String, // E.164
      awsPhonePoolId: String,
      optInScript: String,
    },

    stripe: {
      customerId: String,
      subscriptionId: String,
      status: { type: String, enum: ["trialing", "active", "past_due", "canceled", "incomplete"] },
      currentPeriodEnd: Date,
    },

    billing: {
      plan: { type: String, default: "lift_79" },
      trialEndsAt: Date,
    },

    settings: {
      aiTone: { type: String, enum: ["plain", "friendly"], default: "plain" },
      autoReplyEnabled: { type: Boolean, default: true },
      businessHours: {
        // 0 = Sun … 6 = Sat
        type: [
          {
            day: { type: Number, min: 0, max: 6 },
            open: String, // "08:00"
            close: String, // "17:00"
            closed: { type: Boolean, default: false },
          },
        ],
        default: [],
      },
    },

    counters: {
      // per-shop atomic counters (e.g. RO numbering)
      ro: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export type ShopDoc = InferSchemaType<typeof ShopSchema> & { _id: mongoose.Types.ObjectId };

export const Shop: Model<ShopDoc> =
  (mongoose.models.Shop as Model<ShopDoc>) || mongoose.model<ShopDoc>("Shop", ShopSchema);
