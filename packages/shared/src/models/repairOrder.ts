import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  INSPECTION_SEVERITIES,
  INSPECTION_STATUSES,
  LINE_ITEM_KINDS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RO_STATUSES,
  SERVICE_CATEGORIES,
  TAX_APPLIES_TO,
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
    // Stamped when the line came from a saved job tagged with a reminder
    // category (JobTemplate.reminderCategory). _inferReminders reads this
    // ahead of keyword matching, so "LOF" vs "Lube, oil & filter" stops
    // mattering once the shop uses its templates.
    reminderCategory: { type: String, enum: SERVICE_CATEGORIES },
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
    // Shop tax settings frozen at RO creation, so a rate change in Settings
    // doesn't rewrite history. Absent on pre-snapshot ROs — `applyRoTotals`
    // stamps the shop's current setting the next time line items change.
    taxRateBps: { type: Number, min: 0 },
    taxAppliesTo: { type: String, enum: TAX_APPLIES_TO },

    photos: { type: [PhotoSchema], default: [] },

    estimate: {
      sentAt: Date,
      viewedAt: Date, // first open of the public estimate page
      approvedAt: Date,
      declinedAt: Date,
      // Optional free-text the customer left on the public decline page.
      declineReason: { type: String, maxlength: 200 },
      // Set when the shop texts the customer after a decline (any outbound
      // text on the RO, or the follow-up prompt on the RO page). Drives the
      // "declined estimate needs a reply" board banner. Cleared on re-send.
      declineFollowedUpAt: Date,
      publicToken: String,
      // Snapshot taken when the customer approves, so later line-item edits
      // can be flagged as "changed since approval" against the number the
      // customer actually agreed to, and so the public estimate page keeps
      // showing what they agreed to. Cleared when the estimate is re-sent.
      approvedTotal: Number, // cents
      approvedTaxTotal: Number, // cents; tax included in approvedTotal
      approvedLineItems: {
        type: [
          new Schema(
            {
              kind: { type: String, enum: LINE_ITEM_KINDS, required: true },
              description: { type: String, required: true },
              hours: Number,
              rate: Number, // cents per hour
              qty: Number,
              unitPrice: Number, // cents
              total: { type: Number, required: true }, // cents
            },
            { _id: false }
          ),
        ],
        default: undefined,
      },
      // Set when the snapshot was reconstructed from the live lines for an
      // approval that predates snapshotting (lazy on read, or the backfill
      // script) — best available truth, not what the customer literally saw.
      approvedSnapshotBackfilledAt: Date,
    },

    // Last time a line item was added / edited / removed. Drives the
    // "changed <time>" marker next to an approval that no longer matches.
    lineItemsChangedAt: Date,

    inspection: {
      status: { type: String, enum: INSPECTION_STATUSES, default: "draft" },
      publicToken: { type: String },
      items: { type: [InspectionItemSchema], default: [] },
      sentAt: Date,
      viewedAt: Date,
    },

    // Derived from this RO's Payment rows (apps/api repairOrders/_payments.ts
    // recomputes on every payment write). `method/amountCents/note/paidAt`
    // mirror the LATEST counted payment as a display convenience. ROs written
    // before the payments backfill have `status: "paid"` and no
    // `collectedCents`; readers treat that as collected = amountCents ?? total.
    payment: {
      status: { type: String, enum: PAYMENT_STATUSES, default: "unpaid" },
      stripePaymentIntentId: String,
      paidAt: Date,
      method: { type: String, enum: [...PAYMENT_METHODS, "card"] }, // "card" = legacy in-person
      amountCents: Number,
      note: { type: String, maxlength: 200 },
      // Sum of succeeded Payment rows, in cents.
      collectedCents: Number,
    },

    publicToken: { type: String, index: true }, // for pay/estimate links
    // Customer-side token for the public receipt page. Minted on first
    // "Text receipt"; separate from publicToken (which also opens the estimate).
    receiptToken: { type: String, index: true, sparse: true },

    // Where this RO came from. `manual` = the owner created it in the app;
    // `booking` = a customer self-booked via the public URL.
    source: { type: String, enum: ["manual", "booking"], default: "manual" },
    // Customer-side token for the public manage page (reschedule / cancel).
    // Distinct from `publicToken` so revoking one doesn't break the other.
    bookingToken: { type: String, index: true, sparse: true },

    scheduledFor: Date,
    completedAt: Date,

    // Day-before appointment reminder bookkeeping (feature gap 6). Two fields
    // rather than one flag so a reschedule re-arms the reminder for free:
    // `appointmentReminderFor` records WHICH `scheduledFor` instant was
    // reminded, so the hourly scan skips an RO only while the two match. No
    // ServiceReminder row is used — those are vehicle+category+interval shaped
    // (`dueAt = completedAt + interval`) and would show up in the Settings
    // reminders list and GET /service-reminders as a fake service category.
    appointmentReminderSentAt: Date,
    appointmentReminderFor: Date,

    // Odometer at drop-off / pickup. Optional — Mike often skips it. The
    // latest value is mirrored onto `vehicles.mileage` by repairOrders/
    // create.ts + patch.ts (only ever moves forward), and onto the service
    // reminders this RO spawns (`mileageAtService`).
    mileageIn: Number,
    mileageOut: Number,
  },
  { timestamps: true }
);

RepairOrderSchema.index({ shopId: 1, status: 1, updatedAt: -1 });
// RO history (/repair-orders/history): the list date is `completedAt ?? updatedAt`,
// queried as an $or so both branches ride this one index.
RepairOrderSchema.index({ shopId: 1, completedAt: -1, updatedAt: -1 });
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
