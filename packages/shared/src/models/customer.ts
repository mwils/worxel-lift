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
  },
  { timestamps: true }
);

CustomerSchema.index({ shopId: 1, phone: 1 }, { unique: true });
// Cross-tenant by design: inbound SMS on the shared origination number is
// routed to a shop by looking up the sender's phone (see snsInbound).
CustomerSchema.index({ phone: 1 });
CustomerSchema.index({ shopId: 1, lastName: 1, firstName: 1 });

export type CustomerDoc = InferSchemaType<typeof CustomerSchema> & { _id: mongoose.Types.ObjectId };

export const Customer: Model<CustomerDoc> =
  (mongoose.models.Customer as Model<CustomerDoc>) ||
  mongoose.model<CustomerDoc>("Customer", CustomerSchema);
