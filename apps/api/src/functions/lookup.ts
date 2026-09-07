import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import {
  Customer,
  RO_STATUS_LABELS,
  RepairOrder,
  Vehicle,
  normalizePlate,
  type CustomerDoc,
  type RoStatus,
  type VehicleDoc,
} from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../lib/middleware.js";
import { badRequest, ok } from "../lib/response.js";
import { customerName, parseRoNumber, vehicleSummary } from "./repairOrders/_rows.js";

const LookupQuery = z.object({
  q: z.string().min(1, "q required").max(100),
  // Per-GROUP cap, not a total cap: at 800 customers "Smith" must not crowd
  // the matching plate off the list. Counts come back separately so the client
  // can render "+N more" into the fuller list.
  limit: z.coerce.number().int().min(1).max(25).default(5),
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
interface RoResult {
  kind: "ro";
  id: string;
  number: number;
  status: RoStatus;
  label: string; // "RO-0142"
  sublabel: string; // "Dale Smith · 2013 Ford F-150 · Picked up"
}
type LookupResult = CustomerResult | VehicleResult | RoResult;

interface RoLean {
  _id: unknown;
  number: number;
  status: RoStatus;
  customerId: unknown;
  vehicleId: unknown;
}

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
    // "0142", "142", "RO-0142" → the shop's RO with that number (exact, unique index).
    const roNumber = parseRoNumber(raw);

    const phoneRx =
      isPhoneLike(raw) && phoneDigits.length >= 4
        ? new RegExp(escapeRegex(phoneDigits.replace(/^\+/, "")) + "$", "i")
        : null;
    const vinRx = vinSuffix ? new RegExp(escapeRegex(vinSuffix) + "$", "i") : null;

    // Union filters used for the group counts. The page itself still runs the
    // phone / name / plate / VIN queries separately so ordering stays
    // deliberate (phone before name, plate before VIN).
    const customerOr: Record<string, unknown>[] = [
      { firstName: nameRx },
      { lastName: nameRx },
    ];
    if (phoneRx) customerOr.push({ phone: phoneRx });
    const vehicleOr: Record<string, unknown>[] = [];
    if (plateRx) vehicleOr.push({ plateNormalized: plateRx });
    if (vinRx) vehicleOr.push({ vin: vinRx });

    const [byPhone, byName, byPlate, byVin, roMatch, customerCount, vehicleCount] =
      (await Promise.all([
        phoneRx
          ? Customer.find({ shopId: user.shopId, phone: phoneRx })
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
        vinRx
          ? Vehicle.find({ shopId: user.shopId, vin: vinRx })
              .limit(limit)
              .lean<VehicleDoc[]>()
          : Promise.resolve(noVehicles),
        roNumber !== null
          ? RepairOrder.findOne({ shopId: user.shopId, number: roNumber })
              .select("number status customerId vehicleId")
              .lean()
          : Promise.resolve(null),
        Customer.countDocuments({ shopId: user.shopId, $or: customerOr }),
        vehicleOr.length
          ? Vehicle.countDocuments({ shopId: user.shopId, $or: vehicleOr })
          : Promise.resolve(0),
      ])) as [
        CustomerDoc[],
        CustomerDoc[],
        VehicleDoc[],
        VehicleDoc[],
        RoLean | null,
        number,
        number,
      ];

    const roResults: RoResult[] = [];
    if (roMatch) {
      const [c, v] = await Promise.all([
        Customer.findOne({ _id: roMatch.customerId, shopId: user.shopId })
          .select("firstName lastName")
          .lean(),
        Vehicle.findOne({ _id: roMatch.vehicleId, shopId: user.shopId })
          .select("year make model")
          .lean(),
      ]);
      roResults.push({
        kind: "ro",
        id: String(roMatch._id),
        number: roMatch.number,
        status: roMatch.status,
        label: `RO-${String(roMatch.number).padStart(4, "0")}`,
        sublabel: [customerName(c), vehicleSummary(v), RO_STATUS_LABELS[roMatch.status] ?? roMatch.status]
          .filter((s) => s && s !== "—")
          .join(" · "),
      });
    }

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
      // Sold / totalled cars stay searchable — the plate is how you find the
      // history — but say so, since they're hidden from pickers and reminders.
      if (v.archivedAt) subParts.push("Archived");
      vehicleResults.push({
        kind: "vehicle",
        id,
        customerId: String(v.customerId),
        label,
        sublabel: subParts.join(" · "),
      });
      if (vehicleResults.length >= limit) break;
    }

    // An exact RO-number hit goes first — the owner typed the number on purpose.
    // Each group is already capped at `limit`; nothing is sliced off the end
    // here, so a plate match can't be crowded out by a common surname.
    const results: LookupResult[] = [...roResults, ...customerResults, ...vehicleResults];

    return ok({
      results,
      // Total matches per group, so the client can render "12 · +7 more". The
      // vehicle count comes off the indexed plate/VIN filters; pre-backfill rows
      // matched in JS above can only push it up, never down.
      counts: {
        customers: customerCount,
        vehicles: Math.max(vehicleCount, vehicleResults.length),
        ros: roResults.length,
      },
      groupLimit: limit,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
