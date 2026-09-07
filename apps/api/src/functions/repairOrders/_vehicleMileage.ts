import { Vehicle } from "@lift/shared";

/**
 * Mirror an RO odometer reading onto `vehicles.mileage`. Only ever moves the
 * vehicle forward: a lower reading on an old RO being back-filled (or a typo)
 * must not roll the car's mileage back. `null`/`undefined` is a no-op.
 * Always shop-scoped; errors are the caller's to swallow — a failed mirror
 * must never fail the RO write it rides along with.
 */
export async function bumpVehicleMileage(
  shopId: unknown,
  vehicleId: unknown,
  ...readings: Array<number | null | undefined>
): Promise<void> {
  const values = readings.filter((m): m is number => typeof m === "number" && m >= 0);
  if (values.length === 0) return;
  const mileage = Math.max(...values);
  await Vehicle.updateOne(
    {
      _id: vehicleId,
      shopId,
      $or: [{ mileage: { $exists: false } }, { mileage: null }, { mileage: { $lt: mileage } }],
    },
    { $set: { mileage } }
  );
}
