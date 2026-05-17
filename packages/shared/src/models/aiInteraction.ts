import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AiInteractionSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    kind: { type: String, required: true }, // 'draft_estimate', 'classify_inbound', 'voice_to_ro', ...
    model: { type: String, required: true },
    promptVersion: String,
    inputTokens: Number,
    outputTokens: Number,
    costCents: Number,
    durationMs: Number,
    error: String,
  },
  { timestamps: true }
);

AiInteractionSchema.index({ shopId: 1, createdAt: -1 });

export type AiInteractionDoc = InferSchemaType<typeof AiInteractionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const AiInteraction: Model<AiInteractionDoc> =
  (mongoose.models.AiInteraction as Model<AiInteractionDoc>) ||
  mongoose.model<AiInteractionDoc>("AiInteraction", AiInteractionSchema);
