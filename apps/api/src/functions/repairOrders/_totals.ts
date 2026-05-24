export interface LineItemLike {
  _id?: unknown;
  kind: string;
  description: string;
  hours?: number | null;
  rate?: number | null;
  qty?: number | null;
  unitPrice?: number | null;
  total: number;
}

export interface PartialLineItem {
  kind: string;
  description: string;
  hours?: number | null;
  rate?: number | null;
  qty?: number | null;
  unitPrice?: number | null;
  total?: number | null;
}

/**
 * Compute a single line item's total in cents.
 * labor → hours * rate; part → qty * unitPrice; fee → flat unitPrice (or supplied total).
 * Rounded to nearest cent so float hours never leak fractional cents into Mongo.
 */
export function computeLineItemTotal(li: PartialLineItem): number {
  if (li.kind === "labor") {
    const hours = li.hours ?? 0;
    const rate = li.rate ?? 0;
    return Math.round(hours * rate);
  }
  if (li.kind === "part") {
    const qty = li.qty ?? 0;
    const unitPrice = li.unitPrice ?? 0;
    return Math.round(qty * unitPrice);
  }
  // fee: prefer explicit total, else flat unitPrice.
  if (typeof li.total === "number") return Math.round(li.total);
  return Math.round(li.unitPrice ?? 0);
}

/**
 * Recompute laborTotal / partsTotal / total from the RO's current line items.
 * "fee" items roll into partsTotal — they're flat-line, not labor — so the
 * board still shows the right grand total. Tax is unmanaged in v1.
 */
export function recomputeTotals(
  items: LineItemLike[]
): { laborTotal: number; partsTotal: number; total: number } {
  let laborTotal = 0;
  let partsTotal = 0;
  for (const item of items) {
    if (item.kind === "labor") laborTotal += item.total;
    else partsTotal += item.total;
  }
  return { laborTotal, partsTotal, total: laborTotal + partsTotal };
}
