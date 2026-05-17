import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { LINE_ITEM_KINDS, PAYMENT_STATUSES, RO_STATUSES } from "../constants.js";

const LineItemSchema = new Schema(
  {
    kind: { type: String, enum: LINE_ITEM_KINDS, required: true },
    description: { type: String, required: true },
    hours: Number,
    rate: Number, // cents per hour, stored consistent with money fields
    qty: Number,
    unitPrice: Number, // cents
    total: { type: Number, required: true }, // cents
  },
  { _id: true }
);

const PhotoSchema = new Schema(
  {
    s3Key: { type: String, required: true },
    takenAt: { type: Date, default: () => new Date() },
    caption: String,
  },
  { _id: true }
);

const RepairOrderSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },

    number: { type: Number, required: true }, // formatted as "RO-0142" in UI
    status: { type: String, enum: RO_STATUSES, default: "in", required: true },

    concern: String,
    diagnosis: String,

    lineItems: { type: [LineItemSchema], default: [] },
    laborTotal: { type: Number, default: 0 }, // cents
    partsTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },

    photos: { type: [PhotoSchema], default: [] },

    estimate: {
      sentAt: Date,
      approvedAt: Date,
      declinedAt: Date,
      publicToken: String,
    },

    payment: {
      status: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
      stripePaymentIntentId: String,
      paidAt: Date,
    },

    publicToken: { type: String, index: true }, // for pay/estimate links

    scheduledFor: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

RepairOrderSchema.index({ shopId: 1, status: 1, updatedAt: -1 });
RepairOrderSchema.index({ shopId: 1, number: 1 }, { unique: true });
RepairOrderSchema.index({ shopId: 1, customerId: 1, createdAt: -1 });

export type RepairOrderDoc = InferSchemaType<typeof RepairOrderSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RepairOrder: Model<RepairOrderDoc> =
  (mongoose.models.RepairOrder as Model<RepairOrderDoc>) ||
  mongoose.model<RepairOrderDoc>("RepairOrder", RepairOrderSchema);
