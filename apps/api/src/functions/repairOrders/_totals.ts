import { Customer, Shop } from "@lift/shared";
import { computeTaxCents, resolveTaxSettings, type TaxSettings } from "@lift/shared/constants";

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

/** Tax config as snapshotted on an RO (or read from the shop). Rate in basis points. */
export type TaxConfig = TaxSettings;

/**
 * Recompute laborTotal / partsTotal / taxTotal / total from the RO's current
 * line items. "fee" items roll into partsTotal — they're flat-line, not labor —
 * so the board still shows the right grand total.
 *
 * Tax applies to `part` items (never fees), plus labor for `parts_labor`.
 * Rounded to the cent. No tax config / 0 bps / `none` → taxTotal 0.
 */
export function recomputeTotals(
  items: LineItemLike[],
  tax?: TaxConfig | null
): { laborTotal: number; partsTotal: number; taxTotal: number; total: number } {
  let laborTotal = 0;
  let partsTotal = 0;
  for (const item of items) {
    if (item.kind === "labor") laborTotal += item.total;
    else partsTotal += item.total;
  }
  const taxTotal = computeTaxCents(items, tax);
  return { laborTotal, partsTotal, taxTotal, total: laborTotal + partsTotal + taxTotal };
}

/** The shop's CURRENT tax settings (legacy percent shape tolerated). */
export async function loadTaxConfig(shopId: unknown): Promise<TaxConfig> {
  const shop = await Shop.findById(shopId)
    .select("settings.taxRateBps settings.taxAppliesTo settings.taxRatePct settings.taxLabor")
    .lean();
  return resolveTaxSettings(shop?.settings);
}

/** Minimal RO shape `applyRoTotals` reads and writes. */
export interface TotalsTarget {
  shopId: unknown;
  customerId?: unknown;
  lineItems: unknown;
  laborTotal?: number;
  partsTotal?: number;
  taxTotal?: number;
  total?: number;
  taxRateBps?: number | null;
  taxAppliesTo?: string | null;
}

/**
 * Recompute and write the four totals onto a (mutable) RO document from its
 * current line items, using the RO's own tax snapshot. Caller still `save()`s.
 *
 * Migration: ROs created before the snapshot existed have no `taxRateBps`.
 * The first time their lines change we stamp the shop's current setting and
 * go from there — so a pre-snapshot RO behaves as "taxRateBps = shop's current
 * rate", lazily. Pass `refreshFromShop` to re-stamp on purpose ("Apply
 * current tax rate" on the RO page).
 *
 * A tax-exempt customer zeroes the tax but leaves the snapshot alone, so
 * clearing the flag later brings tax back at the RO's own rate.
 */
export async function applyRoTotals(
  ro: TotalsTarget,
  shopId: unknown = ro.shopId,
  opts: { refreshFromShop?: boolean } = {}
): Promise<void> {
  if (opts.refreshFromShop || typeof ro.taxRateBps !== "number") {
    const current = await loadTaxConfig(shopId);
    ro.taxRateBps = current.taxRateBps;
    ro.taxAppliesTo = current.taxAppliesTo;
  }
  let tax: TaxConfig | null = resolveTaxSettings({
    taxRateBps: ro.taxRateBps,
    taxAppliesTo: ro.taxAppliesTo,
  });
  if (tax.taxRateBps > 0 && ro.customerId) {
    const customer = await Customer.findOne({ _id: ro.customerId, shopId })
      .select("taxExempt")
      .lean();
    if (customer?.taxExempt) tax = null;
  }
  const totals = recomputeTotals(ro.lineItems as LineItemLike[], tax);
  ro.laborTotal = totals.laborTotal;
  ro.partsTotal = totals.partsTotal;
  ro.taxTotal = totals.taxTotal;
  ro.total = totals.total;
}
