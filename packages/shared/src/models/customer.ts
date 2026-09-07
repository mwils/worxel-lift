import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const CustomerSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    firstName: { type: String, required: true },
    lastName: String,
    phone: { type: String, required: true }, // E.164
    email: String,
    smsOptInAt: Date,
    smsOptOutAt: Date,
    notes: String,
    // Resale / farm / government accounts: no sales tax on their ROs.
    taxExempt: { type: Boolean, default: false },
    stripeCustomerId: String,
    // Customer-side token for the public history page (/public/account/:token).
    // Minted on first use (receipt text, booking confirmation, "Text history
    // link"); rotated from the customer page. Sparse so unminted docs don't
    // collide on the unique index.
    publicToken: { type: String, unique: true, sparse: true, index: true },
    // Prior numbers, newest last. The thread stays keyed by customerId, so
    // this is how we know which texts went to which number.
    phoneHistory: {
      type: [
        new Schema(
          {
            phone: { type: String, required: true }, // E.164
            changedAt: { type: Date, required: true },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    // Set by online booking when the booker's name + vehicle match an
    // existing customer whose phone differs. Never auto-merged — the shop
    // sees a banner offering Merge / Not the same. Cleared on either.
    possibleDuplicateOf: { type: Schema.Types.ObjectId, ref: "Customer" },
    // Customers merged INTO this one. The merged record is deleted; its
    // identity lives on here so old links redirect and both names/phones
    // stay searchable. `customerId` is the deleted record's id.
    aliases: {
      type: [
        new Schema(
          {
            customerId: { type: Schema.Types.ObjectId, required: true },
            firstName: { type: String, required: true },
            lastName: String,
            phone: { type: String, required: true }, // E.164
            email: String,
            mergedAt: { type: Date, required: true },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
  },
  { timestamps: true }
);

CustomerSchema.index({ shopId: 1, phone: 1 }, { unique: true });
// Cross-tenant by design: inbound SMS on the shared origination number is
// routed to a shop by looking up the sender's phone (see snsInbound).
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ shopId: 1, lastName: 1, firstName: 1 });
// Old links to a merged-away customer resolve to the survivor through this.
CustomerSchema.index({ shopId: 1, "aliases.customerId": 1 }, { sparse: true });
CustomerSchema.index({ shopId: 1, possibleDuplicateOf: 1 }, { sparse: true });

export type CustomerDoc = InferSchemaType<typeof CustomerSchema> & { _id: mongoose.Types.ObjectId };

export const Customer: Model<CustomerDoc> =
  (mongoose.models.Customer as Model<CustomerDoc>) ||
  mongoose.model<CustomerDoc>("Customer", CustomerSchema);
