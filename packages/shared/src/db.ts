import mongoose from "mongoose";

let cached: typeof mongoose | null = null;
let connecting: Promise<typeof mongoose> | null = null;

/**
 * Cache the Mongoose connection across warm Lambda invocations.
 * Call at the top of every handler. Safe to call concurrently.
 */
export async function connectDb(uri?: string, dbName?: string): Promise<typeof mongoose> {
  if (cached && cached.connection.readyState === 1) return cached;
  if (connecting) return connecting;

  const mongoUri = uri ?? process.env.MONGODB_URI;
  const mongoDbName = dbName ?? process.env.MONGODB_DB_NAME ?? "lift";
  if (!mongoUri) throw new Error("MONGODB_URI is not set");

  mongoose.set("strictQuery", true);

  connecting = mongoose
    .connect(mongoUri, {
      dbName: mongoDbName,
      // Lambda-friendly pool settings
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then((m) => {
      cached = m;
      connecting = null;
      return m;
    })
    .catch((err) => {
      connecting = null;
      throw err;
    });

  return connecting;
}
