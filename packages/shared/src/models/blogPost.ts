import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BLOG_POST_STATUSES } from "../constants.js";

// First tenant-less collection in the codebase (deliberate): the blog belongs
// to Lift-the-company, not a shop, so there is no shopId.
const BlogPostSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    metaDescription: { type: String, required: true },
    // Which curated topic (content/blogTopics.ts) this draft came from. A
    // topicKey is consumed by ANY post regardless of status — a rejected draft
    // does not release its topic back to the bank.
    topicKey: { type: String, required: true, index: true },
    bucket: { type: String, required: true },
    bodyMarkdown: { type: String, required: true },
    status: { type: String, enum: BLOG_POST_STATUSES, default: "scheduled", index: true },
    // UTC instant of 7:00 AM America/Chicago on the post's publish date.
    scheduledFor: { type: Date, required: true, index: true },
    publishedAt: Date,
    model: String,
    promptVersion: String,
    generation: {
      inputTokens: Number,
      outputTokens: Number,
      durationMs: Number,
      attempt: Number,
    },
    // Admin audit trail
    editedAt: Date,
    editedBy: String,
    rejectedAt: Date,
    rejectedBy: String,
    rejectionReason: String,
  },
  { timestamps: true }
);

// The renderer's hot query: visible = published OR (scheduled AND due).
BlogPostSchema.index({ status: 1, scheduledFor: 1 });

export type BlogPostDoc = InferSchemaType<typeof BlogPostSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const BlogPost: Model<BlogPostDoc> =
  (mongoose.models.BlogPost as Model<BlogPostDoc>) ||
  mongoose.model<BlogPostDoc>("BlogPost", BlogPostSchema);
