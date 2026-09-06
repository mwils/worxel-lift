import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PAYMENT_METHODS, PAYMENT_ROW_STATUSES } from "../constants.js";

/**
 * One collected (or attempted) payment against an RO. Source of truth for
 * "how much has been paid" — the RO's `payment.{status,collectedCents}` are
 * derived from these rows (see apps/api repairOrders/_payments.ts).
 *
 * Stripe rows carry `stripePaymentIntentId`; manual rows (cash / in-person
 * card / check / other, recorded via POST /repair-orders/:id/mark-paid) don't.
 */
const PaymentSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    repairOrderId: { type: Schema.Types.ObjectId, ref: "RepairOrder", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    // Denormalized from the RO so vehicle "$ spent" is a single-collection sum.
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle" },
    stripePaymentIntentId: { type: String },
    amountCents: { type: Number, required: true },
    status: { type: String, enum: PAYMENT_ROW_STATUSES, required: true },
    // "card" is the legacy value Stripe rows were written with; normalized on read.
    method: { type: String, enum: [...PAYMENT_METHODS, "card"] },
    last4: String,
    note: { type: String, maxlength: 200 },
    // Owner who recorded a manual payment (absent on Stripe rows).
    recordedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    // When the money actually changed hands (manual) / intent succeeded (Stripe).
    paidAt: Date,
    completedAt: Date,
    // Set when a manual row is undone (mistake) or any row is refunded.
    voidedAt: Date,
    voidNote: { type: String, maxlength: 200 },
    voidedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PaymentSchema.index({ stripePaymentIntentId: 1 }, { unique: true, sparse: true });
PaymentSchema.index({ shopId: 1, repairOrderId: 1, createdAt: -1 });
PaymentSchema.index({ shopId: 1, customerId: 1, status: 1 });
PaymentSchema.index({ shopId: 1, vehicleId: 1, status: 1 });

export type PaymentDoc = InferSchemaType<typeof PaymentSchema> & { _id: mongoose.Types.ObjectId };

export const Payment: Model<PaymentDoc> =
  (mongoose.models.Payment as Model<PaymentDoc>) ||
  mongoose.model<PaymentDoc>("Payment", PaymentSchema);
