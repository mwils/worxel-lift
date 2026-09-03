/**
 * One-off backfill for vehicles written before QA-2026-09-03 (items M4 / L2):
 *   - plateNormalized  ← normalizePlate(plate)     (substring plate search)
 *   - vin              ← vin.toUpperCase()          (VINs used to be stored as typed)
 *   - make             ← title-cased when ALL CAPS  (NHTSA "FORD" → "Ford")
 *
 * Idempotent — safe to re-run. Dry run by default; pass --apply to write.
 *
 *   MONGODB_URI="mongodb+srv://..." pnpm --filter @lift/api exec tsx scripts/backfillVehicleSearchFields.ts
 *   MONGODB_URI="mongodb+srv://..." pnpm --filter @lift/api exec tsx scripts/backfillVehicleSearchFields.ts --apply
 *
 * Get the URI with `sst secret list --stage prod` (MongodbUri).
 */
import { Vehicle, connectDb, normalizePlate } from "@lift/shared";
import { titleCaseMake } from "../src/functions/vehicles/decodeVin.js";

const apply = process.argv.includes("--apply");

async function main() {
  await connectDb();
  const cursor = Vehicle.find({}, { vin: 1, plate: 1, plateNormalized: 1, make: 1 }).lean().cursor();

  let scanned = 0;
  let changed = 0;
  for await (const v of cursor) {
    scanned++;
    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};

    const wantPlateNorm = v.plate ? normalizePlate(v.plate) || undefined : undefined;
    if (wantPlateNorm !== (v.plateNormalized ?? undefined)) {
      if (wantPlateNorm) set.plateNormalized = wantPlateNorm;
      else unset.plateNormalized = "";
    }

    if (v.vin && v.vin !== v.vin.toUpperCase()) set.vin = v.vin.toUpperCase();

    const wantMake = titleCaseMake(v.make ?? undefined);
    if (wantMake && wantMake !== v.make) set.make = wantMake;

    if (!Object.keys(set).length && !Object.keys(unset).length) continue;
    changed++;
    console.log(String(v._id), JSON.stringify({ set, unset }));
    if (apply) {
      await Vehicle.updateOne(
        { _id: v._id },
        {
          ...(Object.keys(set).length ? { $set: set } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        }
      );
    }
  }
  console.log(`${apply ? "Updated" : "Would update"} ${changed} of ${scanned} vehicles.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
