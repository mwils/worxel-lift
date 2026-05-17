import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const SubscriptionEventSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", index: true },
    type: { type: String, required: true }, // e.g. 'customer.subscription.updated'
    stripeEventId: { type: String, required: true, unique: true },
    payload: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export type SubscriptionEventDoc = InferSchemaType<typeof SubscriptionEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const SubscriptionEvent: Model<SubscriptionEventDoc> =
  (mongoose.models.SubscriptionEvent as Model<SubscriptionEventDoc>) ||
  mongoose.model<SubscriptionEventDoc>("SubscriptionEvent", SubscriptionEventSchema);
