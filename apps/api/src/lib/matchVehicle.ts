import { Customer, Vehicle, normalizePlate } from "@lift/shared";

export interface VehicleMatchCandidate {
  id: string;
  customerId: string;
  customerName: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  plate: string | null;
  confidence: "exact" | "fuzzy";
}

export interface VehicleMatchInput {
  shopId: string;
  /** When set, vehicle-match search is scoped to this customer. The voice flow
   *  passes this when the user has already picked a customer in the wizard. */
  customerId?: string;
  vin?: string;
  plate?: string;
  year?: number;
  make?: string;
  model?: string;
}

/**
 * Find existing vehicles in the shop that look like a voice-extracted draft.
 *
 * Ranking:
 *   1. VIN exact (uppercase, no dashes) — gold standard.
 *   2. Plate exact (uppercase, no spaces).
 *   3. Same customerId + year + make + model — strong only when the wizard
 *      has already locked in a customer.
 *
 * Returns at most 3 candidates with strongest confidence first, joined to
 * the customer name for display.
 */
export async function matchVehicle(
  input: VehicleMatchInput
): Promise<VehicleMatchCandidate[]> {
  const out: VehicleMatchCandidate[] = [];
  const seen = new Set<string>();

  async function nameFor(customerId: any): Promise<string> {
    const c = await Customer.findById(customerId).select({ firstName: 1, lastName: 1 }).lean();
    if (!c) return "(unknown customer)";
    return [c.firstName, c.lastName].filter(Boolean).join(" ");
  }

  async function push(doc: any, confidence: "exact" | "fuzzy") {
    const id = String(doc._id);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      customerId: String(doc.customerId),
      customerName: await nameFor(doc.customerId),
      vin: doc.vin ?? null,
      year: doc.year ?? null,
      make: doc.make ?? null,
      model: doc.model ?? null,
      trim: doc.trim ?? null,
      plate: doc.plate ?? null,
      confidence,
    });
  }

  // 1. VIN — normalize and exact-match.
  if (input.vin) {
    const vin = input.vin.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (vin.length === 17) {
      const doc = await Vehicle.findOne({ shopId: input.shopId, vin }).lean();
      if (doc) await push(doc, "exact");
    }
  }

  // 2. Plate — compared on the normalized form (letters/digits, uppercase).
  if (input.plate && out.length < 3) {
    const plateNormalized = normalizePlate(input.plate);
    if (plateNormalized) {
      const doc = await Vehicle.findOne({ shopId: input.shopId, plateNormalized }).lean();
      if (doc) await push(doc, "exact");
    }
  }

  // 3. Fuzzy: same customer + year/make/model.
  if (
    input.customerId &&
    out.length < 3 &&
    (input.year || input.make || input.model)
  ) {
    const q: any = { shopId: input.shopId, customerId: input.customerId };
    if (input.year) q.year = input.year;
    if (input.make) q.make = new RegExp(`^${escapeRegex(input.make)}$`, "i");
    if (input.model) q.model = new RegExp(`^${escapeRegex(input.model)}$`, "i");
    const fuzzy = await Vehicle.find(q).limit(3 - out.length).lean();
    for (const doc of fuzzy) await push(doc, "fuzzy");
  }

  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
