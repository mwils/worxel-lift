import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  INSPECTION_SEVERITIES,
  INSPECTION_STATUSES,
  LINE_ITEM_KINDS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RO_STATUSES,
} from "../constants.js";

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

const InspectionItemSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 120 },
    severity: { type: String, enum: INSPECTION_SEVERITIES, required: true },
    note: { type: String, maxlength: 500 },
    photoIds: { type: [Schema.Types.ObjectId], default: [] },
    order: { type: Number, default: 0 },
  },
  { _id: true, timestamps: true }
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

    inspection: {
      status: { type: String, enum: INSPECTION_STATUSES, default: "draft" },
      publicToken: { type: String },
      items: { type: [InspectionItemSchema], default: [] },
      sentAt: Date,
      viewedAt: Date,
    },

    payment: {
      status: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
      stripePaymentIntentId: String,
      paidAt: Date,
      // Set by POST /repair-orders/:id/mark-paid (cash / in-person card /
      // check / other) or "stripe" by the pay-link + card-on-file paths.
      method: { type: String, enum: PAYMENT_METHODS },
      // What was actually collected, in cents. Defaults to `total` at mark-paid
      // time; may be lower if the owner knocked something off at the counter.
      amountCents: Number,
      note: { type: String, maxlength: 200 },
    },

    publicToken: { type: String, index: true }, // for pay/estimate links

    // Where this RO came from. `manual` = the owner created it in the app;
    // `booking` = a customer self-booked via the public URL.
    source: { type: String, enum: ["manual", "booking"], default: "manual" },
    // Customer-side token for the public manage page (reschedule / cancel).
    // Distinct from `publicToken` so revoking one doesn't break the other.
    bookingToken: { type: String, index: true, sparse: true },

    scheduledFor: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

RepairOrderSchema.index({ shopId: 1, status: 1, updatedAt: -1 });
RepairOrderSchema.index({ shopId: 1, number: 1 }, { unique: true });
RepairOrderSchema.index({ shopId: 1, customerId: 1, createdAt: -1 });
RepairOrderSchema.index({ shopId: 1, vehicleId: 1, createdAt: -1 });
RepairOrderSchema.index({ "inspection.publicToken": 1 }, { sparse: true });
// Slot lookup query: range over scheduledFor, filtered by shop + open status.
RepairOrderSchema.index({ shopId: 1, scheduledFor: 1, status: 1 });

export type RepairOrderDoc = InferSchemaType<typeof RepairOrderSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RepairOrder: Model<RepairOrderDoc> =
  (mongoose.models.RepairOrder as Model<RepairOrderDoc>) ||
  mongoose.model<RepairOrderDoc>("RepairOrder", RepairOrderSchema);
