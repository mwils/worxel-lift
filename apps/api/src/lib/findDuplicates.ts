import mongoose from "mongoose";
import { Customer, Vehicle, type CustomerDoc } from "@lift/shared";

/**
 * Duplicate-customer detection shared by manual create (customers/create)
 * and online booking (public/book).
 *
 * Phone is the identity key (unique per shop) and is matched by the callers
 * before this runs. This module handles the softer signal: the same person
 * typing their name differently — "Dale O'Brien-Reyes" / "dale obrien reyes"
 * / "D. OBrien-Reyes". Rule: normalized last name equal + first initial
 * equal. Optionally strengthened by a vehicle match (VIN exact, else exact
 * year + make + model) so booking can tell "same name, same truck" from
 * "another Smith".
 */

export interface DuplicateCandidate {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  /** Why we think it's the same person. `vehicle` only when a vehicle was supplied. */
  reasons: Array<"name" | "email" | "vehicle">;
}

export interface FindDuplicatesInput {
  shopId: string | mongoose.Types.ObjectId;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  vehicle?: { vin?: string | null; year?: number | null; make?: string | null; model?: string | null };
  /** Skip this customer (e.g. the record being edited). */
  excludeId?: string | mongoose.Types.ObjectId;
  limit?: number;
}

/** Lowercase, letters only — "O'Brien-Reyes" → "obrienreyes". */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/**
 * Regex that matches any spelling of a normalized name in the DB: letters in
 * order with any non-letters (apostrophes, hyphens, spaces, periods) between.
 * Anchored so "smith" doesn't match "smithson".
 */
function looseNameRegex(normalized: string): RegExp {
  const parts = normalized.split("").map((ch) => escapeRegex(ch));
  return new RegExp(`^[^a-z]*${parts.join("[^a-z]*")}[^a-z]*$`, "i");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function findPossibleDuplicates(
  input: FindDuplicatesInput
): Promise<DuplicateCandidate[]> {
  const limit = input.limit ?? 5;
  const first = normalizeName(input.firstName);
  const last = normalizeName(input.lastName);
  const email = input.email?.trim().toLowerCase() || null;

  const or: Record<string, unknown>[] = [];
  if (last.length >= 2 && first.length >= 1) {
    or.push({ lastName: looseNameRegex(last), firstName: new RegExp(`^[^a-z]*${first[0]}`, "i") });
  } else if (!last && first.length >= 3) {
    // Single-name customers ("Cher", "Bubba"): whole first name, no last name on file.
    or.push({ firstName: looseNameRegex(first), lastName: { $in: [null, ""] } });
  }
  if (email) or.push({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });
  if (or.length === 0) return [];

  const filter: Record<string, unknown> = { shopId: input.shopId, $or: or };
  if (input.excludeId) filter._id = { $ne: input.excludeId };

  const rows = await Customer.find(filter).limit(limit).lean<CustomerDoc[]>();
  if (rows.length === 0) return [];

  // Vehicle strengthening — one query for all candidates.
  const vehicleOwners = new Set<string>();
  const v = input.vehicle;
  if (v) {
    const vin = (v.vin ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const vq: Record<string, unknown> = {
      shopId: input.shopId,
      customerId: { $in: rows.map((r) => r._id) },
      archivedAt: null,
    };
    if (vin.length === 17) {
      vq.vin = vin;
    } else if (v.year && v.make && v.model) {
      vq.year = v.year;
      vq.make = new RegExp(`^${escapeRegex(v.make.trim())}$`, "i");
      vq.model = new RegExp(`^${escapeRegex(v.model.trim())}$`, "i");
    } else {
      // Nothing identifying about the vehicle — don't pretend it matched.
      return decorate(rows, { first, last, email, vehicleOwners });
    }
    const owned = await Vehicle.find(vq).select({ customerId: 1 }).lean();
    for (const o of owned) vehicleOwners.add(String(o.customerId));
  }

  return decorate(rows, { first, last, email, vehicleOwners });
}

function decorate(
  rows: CustomerDoc[],
  ctx: { first: string; last: string; email: string | null; vehicleOwners: Set<string> }
): DuplicateCandidate[] {
  return rows.map((c) => {
    const reasons: DuplicateCandidate["reasons"] = [];
    const cFirst = normalizeName(c.firstName);
    const cLast = normalizeName(c.lastName);
    const nameHit = ctx.last
      ? cLast === ctx.last && cFirst[0] === ctx.first[0]
      : !cLast && cFirst === ctx.first;
    if (nameHit) reasons.push("name");
    if (ctx.email && (c.email ?? "").toLowerCase() === ctx.email) reasons.push("email");
    if (ctx.vehicleOwners.has(String(c._id))) reasons.push("vehicle");
    return {
      id: String(c._id),
      firstName: c.firstName,
      lastName: c.lastName ?? null,
      phone: c.phone,
      email: c.email ?? null,
      reasons,
    };
  });
}
