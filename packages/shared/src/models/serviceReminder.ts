import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { SERVICE_CATEGORIES, SERVICE_REMINDER_STATUSES } from "../constants.js";

const ServiceReminderSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    sourceRepairOrderId: {
      type: Schema.Types.ObjectId,
      ref: "RepairOrder",
      required: true,
    },
    category: { type: String, enum: SERVICE_CATEGORIES, required: true },
    dueAt: { type: Date, required: true },
    // When / at what odometer the source RO did this service. Display only —
    // reminders are date-triggered (dueAt); mileage-based triggers are v2.
    servicedAt: Date,
    mileageAtService: Number,
    status: {
      type: String,
      enum: SERVICE_REMINDER_STATUSES,
      default: "pending",
      required: true,
    },
    sentMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
    sentAt: Date,
    dismissedAt: Date,
    dismissedBy: { type: Schema.Types.ObjectId, ref: "User" },
    attempt: { type: Number, default: 0 },
    promptVersion: String,
  },
  { timestamps: true }
);

// Cron scan: pending reminders for a shop, ordered by dueAt.
ServiceReminderSchema.index({ shopId: 1, status: 1, dueAt: 1 });
// Upsert path during inference: collapses to a single pending reminder per car+category.
ServiceReminderSchema.index({ shopId: 1, customerId: 1, vehicleId: 1, category: 1, status: 1 });
// Per-shop ordered list views (most-due first).
ServiceReminderSchema.index({ shopId: 1, dueAt: 1, status: 1 });

export type ServiceReminderDoc = InferSchemaType<typeof ServiceReminderSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ServiceReminder: Model<ServiceReminderDoc> =
  (mongoose.models.ServiceReminder as Model<ServiceReminderDoc>) ||
  mongoose.model<ServiceReminderDoc>("ServiceReminder", ServiceReminderSchema);
