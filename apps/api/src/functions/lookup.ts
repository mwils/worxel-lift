import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import {
  Customer,
  Vehicle,
  normalizePlate,
  type CustomerDoc,
  type VehicleDoc,
} from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../lib/middleware.js";
import { badRequest, ok } from "../lib/response.js";

const LookupQuery = z.object({
  q: z.string().min(1, "q required").max(100),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isPhoneLike(s: string): boolean {
  return /\d/.test(s) && s.replace(/[^\d]/g, "").length >= 4;
}

function isVinSuffixLike(s: string): boolean {
  return /^[a-z0-9]{4,}$/i.test(s);
}

interface CustomerResult {
  kind: "customer";
  id: string;
  label: string;
  sublabel: string;
}
interface VehicleResult {
  kind: "vehicle";
  id: string;
  customerId: string;
  label: string;
  sublabel: string;
}
type LookupResult = CustomerResult | VehicleResult;

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const { q, limit } = parseQuery(event, LookupQuery);
    const raw = q.trim();
    if (!raw) return ok({ results: [] });

    const escaped = escapeRegex(raw);
    const nameRx = new RegExp(`^${escaped}`, "i");
    const phoneDigits = raw.replace(/[^\d+]/g, "");
    const plateNorm = normalizePlate(raw);
    // Substring match on the normalized plate so "KLM-4471" / "klm4471" find
    // a car stored as "SC KLM-4471".
    const plateRx = plateNorm ? new RegExp(escapeRegex(plateNorm)) : null;
    const vinSuffix = isVinSuffixLike(raw) ? raw.toUpperCase() : null;

    const noCustomers: CustomerDoc[] = [];
    const noVehicles: VehicleDoc[] = [];

    const [byPhone, byName, byPlate, byVin] = (await Promise.all([
      isPhoneLike(raw) && phoneDigits.length >= 4
        ? Customer.find({
            shopId: user.shopId,
            phone: new RegExp(escapeRegex(phoneDigits.replace(/^\+/, "")) + "$", "i"),
          })
            .limit(limit)
            .lean<CustomerDoc[]>()
        : Promise.resolve(noCustomers),
      Customer.find({
        shopId: user.shopId,
        $or: [{ firstName: nameRx }, { lastName: nameRx }],
      })
        .sort({ lastName: 1, firstName: 1 })
        .limit(limit)
        .lean<CustomerDoc[]>(),
      plateRx
        ? Vehicle.find({
            shopId: user.shopId,
            $or: [
              { plateNormalized: plateRx },
              // Vehicles written before plateNormalized existed (pre-backfill):
              // pull the raw plates and normalize in JS below.
              { plateNormalized: { $exists: false }, plate: { $exists: true, $ne: null } },
            ],
          })
            .limit(limit * 5)
            .lean<VehicleDoc[]>()
        : Promise.resolve(noVehicles),
      vinSuffix
        ? Vehicle.find({
            shopId: user.shopId,
            vin: new RegExp(escapeRegex(vinSuffix) + "$", "i"),
          })
            .limit(limit)
            .lean<VehicleDoc[]>()
        : Promise.resolve(noVehicles),
    ])) as [CustomerDoc[], CustomerDoc[], VehicleDoc[], VehicleDoc[]];

    // Legacy rows (no plateNormalized yet) are normalized here; rows that hit
    // the indexed plateNormalized regex pass straight through.
    const plateMatches = plateRx
      ? byPlate.filter((v) => (v.plateNormalized ?? normalizePlate(v.plate)).includes(plateNorm))
      : [];

    const customerResults: CustomerResult[] = [];
    const seenCustomerIds = new Set<string>();
    for (const c of [...byPhone, ...byName]) {
      const id = String(c._id);
      if (seenCustomerIds.has(id)) continue;
      seenCustomerIds.add(id);
      customerResults.push({
        kind: "customer",
        id,
        label: [c.firstName, c.lastName].filter(Boolean).join(" "),
        sublabel: c.phone,
      });
      if (customerResults.length >= limit) break;
    }

    const vehicleResults: VehicleResult[] = [];
    const seenVehicleIds = new Set<string>();
    for (const v of [...plateMatches, ...byVin]) {
      const id = String(v._id);
      if (seenVehicleIds.has(id)) continue;
      seenVehicleIds.add(id);
      const label =
        [v.year, v.make, v.model].filter(Boolean).join(" ") || (v.vin ?? "Vehicle");
      const subParts: string[] = [];
      if (v.plate) subParts.push(`Plate ${v.plate}`);
      if (v.vin) subParts.push(`VIN ${v.vin.slice(-6)}`);
      vehicleResults.push({
        kind: "vehicle",
        id,
        customerId: String(v.customerId),
        label,
        sublabel: subParts.join(" · "),
      });
      if (vehicleResults.length >= limit) break;
    }

    const results: LookupResult[] = [...customerResults, ...vehicleResults].slice(0, limit);
    return ok({ results });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
