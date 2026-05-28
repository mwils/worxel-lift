import { Customer, e164 } from "@lift/shared";

export interface CustomerMatchCandidate {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  confidence: "exact" | "fuzzy";
}

export interface CustomerMatchInput {
  shopId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

/**
 * Find existing customers in the shop that look like a voice-extracted draft.
 *
 * Ranking (highest first):
 *   1. Exact phone match (E.164-normalized) — unique-per-shop, treated as a hit.
 *   2. Exact email match (case-insensitive) — also strong; rare collisions in practice.
 *   3. Fuzzy name match (case-insensitive contains on first+last) — surfaced as suggestions.
 *
 * Returns at most 3 candidates, de-duplicated, with the strongest confidence first.
 */
export async function matchCustomer(
  input: CustomerMatchInput
): Promise<CustomerMatchCandidate[]> {
  const out: CustomerMatchCandidate[] = [];
  const seen = new Set<string>();

  function push(doc: any, confidence: "exact" | "fuzzy") {
    const id = String(doc._id);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      firstName: doc.firstName,
      lastName: doc.lastName ?? null,
      phone: doc.phone,
      email: doc.email ?? null,
      confidence,
    });
  }

  // 1. Phone — normalize the raw spoken phone through the same Zod transform
  //    so "five five five zero one four two" → "+15550000142" comparisons work.
  if (input.phone) {
    const parsed = e164.safeParse(input.phone);
    if (parsed.success) {
      const doc = await Customer.findOne({ shopId: input.shopId, phone: parsed.data }).lean();
      if (doc) push(doc, "exact");
    }
  }

  // 2. Email — case-insensitive.
  if (input.email && out.length < 3) {
    const doc = await Customer.findOne({
      shopId: input.shopId,
      email: new RegExp(`^${escapeRegex(input.email)}$`, "i"),
    }).lean();
    if (doc) push(doc, "exact");
  }

  // 3. Fuzzy name — only when we still have headroom.
  if ((input.firstName || input.lastName) && out.length < 3) {
    const conds: any[] = [];
    if (input.firstName) {
      conds.push({ firstName: new RegExp(escapeRegex(input.firstName), "i") });
    }
    if (input.lastName) {
      conds.push({ lastName: new RegExp(escapeRegex(input.lastName), "i") });
    }
    const fuzzy = await Customer.find({
      shopId: input.shopId,
      // Match either name to catch single-name dictation.
      ...(conds.length > 1 ? { $or: conds } : conds[0]),
    })
      .limit(3 - out.length)
      .lean();
    for (const doc of fuzzy) push(doc, "fuzzy");
  }

  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
