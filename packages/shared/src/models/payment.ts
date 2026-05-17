import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const PaymentSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    repairOrderId: { type: Schema.Types.ObjectId, ref: "RepairOrder", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    stripePaymentIntentId: { type: String, required: true, unique: true },
    amountCents: { type: Number, required: true },
    status: {
      type: String,
      enum: ["requires_payment_method", "requires_action", "processing", "succeeded", "canceled", "refunded"],
      required: true,
    },
    method: String, // card / ach / etc
    last4: String,
    completedAt: Date,
  },
  { timestamps: true }
);

PaymentSchema.index({ shopId: 1, repairOrderId: 1, createdAt: -1 });

export type PaymentDoc = InferSchemaType<typeof PaymentSchema> & { _id: mongoose.Types.ObjectId };

export const Payment: Model<PaymentDoc> =
  (mongoose.models.Payment as Model<PaymentDoc>) ||
  mongoose.model<PaymentDoc>("Payment", PaymentSchema);
