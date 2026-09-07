/** Display strings shared by the board list and the RO history list. */

export function customerName(
  c: { firstName?: string; lastName?: string | null } | undefined | null
): string {
  if (!c) return "Unknown";
  const last = c.lastName ?? "";
  return [c.firstName ?? "", last].filter(Boolean).join(" ").trim() || "Unknown";
}

export function vehicleSummary(
  v: { year?: number | null; make?: string | null; model?: string | null } | undefined | null
): string {
  if (!v) return "—";
  return [v.year, v.make, v.model].filter(Boolean).join(" ").trim() || "—";
}

/**
 * Parse anything the owner might type for an RO number — "142", "0142",
 * "RO-0142", "ro 142" — into the stored integer. Null if it isn't one.
 */
export function parseRoNumber(raw: string): number | null {
  const m = raw.trim().match(/^(?:ro[-\s#]?)?0*(\d{1,7})$/i);
  if (!m || !m[1]) return null;
  const n = Number(m[1]);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
