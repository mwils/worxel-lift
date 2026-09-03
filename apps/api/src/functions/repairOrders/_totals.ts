import { Shop } from "@lift/shared";

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

/** Shop tax settings, as stored on `shop.settings`. `ratePct` is a percent (8.25 = 8.25%). */
export interface TaxConfig {
  ratePct: number;
  taxLabor: boolean;
}

/**
 * Recompute laborTotal / partsTotal / taxTotal / total from the RO's current
 * line items. "fee" items roll into partsTotal — they're flat-line, not labor —
 * so the board still shows the right grand total.
 *
 * Tax applies to `part` items (never fees), plus labor when the shop has
 * `taxLabor` on. Rounded to the cent. No tax config → taxTotal 0.
 */
export function recomputeTotals(
  items: LineItemLike[],
  tax?: TaxConfig | null
): { laborTotal: number; partsTotal: number; taxTotal: number; total: number } {
  let laborTotal = 0;
  let partsTotal = 0;
  let taxableParts = 0;
  for (const item of items) {
    if (item.kind === "labor") laborTotal += item.total;
    else partsTotal += item.total;
    if (item.kind === "part") taxableParts += item.total;
  }
  const rate = tax?.ratePct ?? 0;
  const taxable = taxableParts + (tax?.taxLabor ? laborTotal : 0);
  const taxTotal = rate > 0 ? Math.round((taxable * rate) / 100) : 0;
  return { laborTotal, partsTotal, taxTotal, total: laborTotal + partsTotal + taxTotal };
}

/** Read the shop's tax settings; null when no tax is configured. */
export async function loadTaxConfig(shopId: unknown): Promise<TaxConfig | null> {
  const shop = await Shop.findById(shopId).select("settings.taxRatePct settings.taxLabor").lean();
  const ratePct = shop?.settings?.taxRatePct ?? 0;
  if (!ratePct || ratePct <= 0) return null;
  return { ratePct, taxLabor: shop?.settings?.taxLabor === true };
}

/**
 * Recompute and write the four totals onto a (mutable) RO document from its
 * current line items, using the shop's tax settings. Caller still `save()`s.
 */
export async function applyRoTotals(
  ro: {
    shopId: unknown;
    lineItems: unknown;
    laborTotal?: number;
    partsTotal?: number;
    taxTotal?: number;
    total?: number;
  },
  shopId: unknown = ro.shopId
): Promise<void> {
  const tax = await loadTaxConfig(shopId);
  const totals = recomputeTotals(ro.lineItems as LineItemLike[], tax);
  ro.laborTotal = totals.laborTotal;
  ro.partsTotal = totals.partsTotal;
  ro.taxTotal = totals.taxTotal;
  ro.total = totals.total;
}
