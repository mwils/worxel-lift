import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ShopSchema = new Schema(
  {
    name: { type: String, required: true },
    // Public booking URL slug. Sparse-unique so existing shops can backfill at
    // their own pace; onboarding will populate this from `name` when added.
    slug: { type: String, unique: true, sparse: true, index: true },
    // Previous slugs are retained for a v1.1 90-day redirect window. Capped at
    // 5 entries in PATCH /shop. v1 just stores the list — redirect serving is
    // a follow-up.
    oldSlugs: { type: [String], default: [] },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zip: String,
    },
    timezone: { type: String, default: "America/Chicago" },
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    sms: {
      phoneNumber: String, // E.164
      awsPhonePoolId: String,
      optInScript: String,
    },

    stripe: {
      customerId: String,
      subscriptionId: String,
      status: { type: String, enum: ["trialing", "active", "past_due", "canceled", "incomplete"] },
      currentPeriodEnd: Date,
      // Stripe Connect (Standard) — the shop's own account for RECEIVING
      // customer payments. Distinct from customerId/subscriptionId above,
      // which are the shop PAYING Lift's $79/mo. Charges are created directly
      // on this account; Lift takes no fee.
      connectAccountId: String,
      connectChargesEnabled: Boolean,
      connectDetailsSubmitted: Boolean,
    },

    billing: {
      plan: { type: String, default: "lift_79" },
      trialEndsAt: Date,
    },

    settings: {
      aiTone: { type: String, enum: ["plain", "friendly"], default: "plain" },
      autoReplyEnabled: { type: Boolean, default: true },
      defaultLaborRate: { type: Number }, // cents per hour; set by owner on first template create
      // Kill switch for service-due reminders. Defaults on; flipped off in
      // Settings if Mike wants to handle follow-ups manually.
      serviceRemindersEnabled: { type: Boolean, default: true },
      businessHours: {
        // 0 = Sun … 6 = Sat
        type: [
          {
            day: { type: Number, min: 0, max: 6 },
            open: String, // "08:00"
            close: String, // "17:00"
            closed: { type: Boolean, default: false },
          },
        ],
        default: [],
      },
      // Online appointment booking config. `enabled=false` hides the public
      // booking URL even if `slug` is set. `hours` defaults to a copy of
      // `businessHours` the first time the owner toggles booking on.
      booking: {
        enabled: { type: Boolean, default: false },
        slotMinutes: { type: Number, default: 60 },
        maxPerSlot: { type: Number, default: 1 },
        leadTimeHours: { type: Number, default: 2 },
        horizonDays: { type: Number, default: 14 },
        hours: {
          type: [
            {
              day: { type: Number, min: 0, max: 6 },
              open: String, // "HH:mm"
              close: String,
              closed: { type: Boolean, default: false },
            },
          ],
          default: [],
        },
        confirmationMessage: { type: String },
      },
    },

    counters: {
      // per-shop atomic counters (e.g. RO numbering)
      ro: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export type ShopDoc = InferSchemaType<typeof ShopSchema> & { _id: mongoose.Types.ObjectId };

export const Shop: Model<ShopDoc> =
  (mongoose.models.Shop as Model<ShopDoc>) || mongoose.model<ShopDoc>("Shop", ShopSchema);
