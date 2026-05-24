import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const VehicleSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    vin: String,
    year: Number,
    make: String,
    model: String,
    trim: String,
    engine: String,
    mileage: Number,
    plate: String,
    color: String,
    notes: String,
  },
  { timestamps: true }
);

VehicleSchema.index({ shopId: 1, customerId: 1 });
VehicleSchema.index({ shopId: 1, vin: 1 }, { sparse: true });
VehicleSchema.index({ shopId: 1, plate: 1 }, { sparse: true });

export type VehicleDoc = InferSchemaType<typeof VehicleSchema> & { _id: mongoose.Types.ObjectId };

export const Vehicle: Model<VehicleDoc> =
  (mongoose.models.Vehicle as Model<VehicleDoc>) ||
  mongoose.model<VehicleDoc>("Vehicle", VehicleSchema);

/** Cached NHTSA vPIC decodes so we don't re-hit the API. */
const VinDecodeCacheSchema = new Schema(
  {
    vin: { type: String, required: true, unique: true },
    decodedAt: { type: Date, default: () => new Date() },
    year: Number,
    make: String,
    model: String,
    trim: String,
    engine: String,
    raw: Schema.Types.Mixed,
  },
  { timestamps: false }
);

export type VinDecodeCacheDoc = InferSchemaType<typeof VinDecodeCacheSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const VinDecodeCache: Model<VinDecodeCacheDoc> =
  (mongoose.models.VinDecodeCache as Model<VinDecodeCacheDoc>) ||
  mongoose.model<VinDecodeCacheDoc>("VinDecodeCache", VinDecodeCacheSchema);
