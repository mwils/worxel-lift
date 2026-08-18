import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const UserSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop" },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String, // E.164
    role: { type: String, enum: ["owner", "tech"], default: "owner" },

    // false = instant-signup account that hasn't clicked the emailed link yet.
    // undefined (pre-existing accounts) counts as verified — they could only
    // have gotten a session through the email round-trip.
    emailVerified: Boolean,

    auth: {
      magicLinkHash: String,
      magicLinkExpiresAt: Date,
      smsCode: String, // hashed
      smsCodeExpiresAt: Date,
      lastLoginAt: Date,
    },
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 }, { unique: true });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: mongoose.Types.ObjectId };

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", UserSchema);
