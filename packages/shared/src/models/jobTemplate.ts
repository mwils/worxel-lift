import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { LINE_ITEM_KINDS, SERVICE_CATEGORIES } from "../constants.js";

const JobTemplateLineItemSchema = new Schema(
  {
    kind: { type: String, enum: LINE_ITEM_KINDS, required: true },
    description: { type: String, required: true, trim: true },
    hours: Number,
    rate: Number, // cents per hour (snapshot at template create)
    qty: Number,
    unitPrice: Number, // cents — parts each, fees flat
  },
  { _id: true }
);

const JobTemplateSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    // Which service reminder this job should schedule when it's on a
    // picked-up RO (oil_change, tire_rotation…). Distinct from `category`,
    // which is the shop's own free-text grouping ("Brakes", "HVAC").
    reminderCategory: { type: String, enum: SERVICE_CATEGORIES },
    notes: String,
    lineItems: { type: [JobTemplateLineItemSchema], default: [] },
    source: { type: String, enum: ["custom", "starter"], default: "custom" },
    starterKey: { type: String }, // sparse-unique with shopId
    archivedAt: { type: Date },
    lastUsedAt: { type: Date },
    useCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

JobTemplateSchema.index({ shopId: 1, name: 1 });
JobTemplateSchema.index({ shopId: 1, archivedAt: 1, lastUsedAt: -1 });
JobTemplateSchema.index({ shopId: 1, starterKey: 1 }, { unique: true, sparse: true });

export type JobTemplateDoc = InferSchemaType<typeof JobTemplateSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const JobTemplate: Model<JobTemplateDoc> =
  (mongoose.models.JobTemplate as Model<JobTemplateDoc>) ||
  mongoose.model<JobTemplateDoc>("JobTemplate", JobTemplateSchema);
