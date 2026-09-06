import { Payment, normalizePaymentMethod, type PaymentMethod, type PaymentStatus } from "@lift/shared";

/**
 * Payment rows are the source of truth for what an RO has collected. These
 * helpers derive the RO-level view (`collectedCents`, `balanceCents`,
 * `payment.status`) from the rows and write the denormalized copy back onto
 * `ro.payment` so the board / list / history endpoints can read it without a
 * join.
 *
 * Legacy tolerance: ROs marked paid in round 1 (2026-09-03) have
 * `payment.status = "paid"` + `amountCents` but no Payment row and no
 * `collectedCents`. Until `scripts/backfillPayments.ts` runs, readers treat
 * that as collected = amountCents ?? total.
 */

export interface PaymentRowLike {
  _id?: unknown;
  amountCents: number;
  status: string;
  method?: string | null;
  stripePaymentIntentId?: string | null;
  last4?: string | null;
  note?: string | null;
  paidAt?: Date | null;
  completedAt?: Date | null;
  createdAt?: Date | null;
  voidedAt?: Date | null;
  voidNote?: string | null;
}

export interface RoPaymentLike {
  status?: string | null;
  stripePaymentIntentId?: string | null;
  paidAt?: Date | null;
  method?: string | null;
  amountCents?: number | null;
  note?: string | null;
  collectedCents?: number | null;
}

export interface RoPaymentSnapshot {
  status: PaymentStatus;
  collectedCents: number;
  balanceCents: number;
}

/** Only rows that actually put money in the drawer count toward the balance. */
export function countsTowardCollected(row: { status: string }): boolean {
  return row.status === "succeeded";
}

export function paymentRowMethod(row: PaymentRowLike): PaymentMethod | null {
  return normalizePaymentMethod(row.method, { stripe: !!row.stripePaymentIntentId });
}

export function paymentRowPaidAt(row: PaymentRowLike): Date | null {
  return row.paidAt ?? row.completedAt ?? row.createdAt ?? null;
}

/** Sum succeeded rows (cents). */
export function sumCollected(rows: PaymentRowLike[]): number {
  return rows.reduce((acc, r) => acc + (countsTowardCollected(r) ? r.amountCents : 0), 0);
}

/**
 * Derive the RO settlement status from its rows.
 *   collected >= total (and total > 0)      → paid
 *   0 < collected < total                   → partial
 *   collected == 0 and any refunded row     → refunded
 *   collected == 0 and a Stripe intent open → authorized
 *   otherwise                               → unpaid
 * A $0 RO with nothing collected stays unpaid (nothing to settle).
 */
export function deriveRoStatus(
  total: number,
  rows: PaymentRowLike[],
  opts?: { stripeIntentOpen?: boolean }
): RoPaymentSnapshot {
  const collectedCents = sumCollected(rows);
  const balanceCents = Math.max(0, total - collectedCents);
  let status: PaymentStatus;
  if (collectedCents > 0 && collectedCents >= total) status = "paid";
  else if (collectedCents > 0) status = "partial";
  else if (rows.some((r) => r.status === "refunded")) status = "refunded";
  else if (opts?.stripeIntentOpen) status = "authorized";
  else status = "unpaid";
  return { status, collectedCents, balanceCents };
}

/**
 * Read the denormalized snapshot off an RO without touching the payments
 * collection — for list / board / history rows. Tolerates legacy ROs.
 */
export function roPaymentSnapshot(
  ro: { total?: number | null; payment?: RoPaymentLike | null },
  status: string | null | undefined = ro.payment?.status
): RoPaymentSnapshot {
  const total = ro.total ?? 0;
  const p = ro.payment;
  let collectedCents: number;
  if (typeof p?.collectedCents === "number") {
    collectedCents = p.collectedCents;
  } else if (status === "paid") {
    // Legacy round-1 mark-paid: the amount collected lives on the RO only.
    collectedCents = typeof p?.amountCents === "number" ? p.amountCents : total;
  } else {
    collectedCents = 0;
  }
  const balanceCents = Math.max(0, total - collectedCents);
  let derived: PaymentStatus;
  if (collectedCents > 0 && collectedCents >= total) derived = "paid";
  else if (collectedCents > 0) derived = "partial";
  else if (status === "refunded" || status === "authorized") derived = status;
  else derived = "unpaid";
  return { status: derived, collectedCents, balanceCents };
}

/** Public/RO-detail shape of one payment row. `note` is owner-only — strip it for customers. */
export function serializePaymentRow(row: PaymentRowLike, opts?: { includeNote?: boolean }) {
  return {
    id: row._id ? String(row._id) : null,
    amountCents: row.amountCents,
    status: row.status,
    method: paymentRowMethod(row),
    last4: row.last4 ?? null,
    paidAt: paymentRowPaidAt(row),
    ...(opts?.includeNote === false ? {} : { note: row.note ?? null }),
    voidedAt: row.voidedAt ?? null,
    voidNote: opts?.includeNote === false ? undefined : (row.voidNote ?? null),
    stripe: !!row.stripePaymentIntentId,
  };
}

/** RO-detail `payment` block: derived status + latest counted payment for the pill. */
export function serializeRoPayment(
  ro: { total?: number | null; payment?: RoPaymentLike | null },
  rows: PaymentRowLike[]
) {
  const legacy = rows.length === 0;
  const snap = legacy
    ? roPaymentSnapshot(ro)
    : deriveRoStatus(ro.total ?? 0, rows, {
        stripeIntentOpen: ro.payment?.status === "authorized",
      });
  const latest = [...rows]
    .filter(countsTowardCollected)
    .sort((a, b) => (paymentRowPaidAt(b)?.getTime() ?? 0) - (paymentRowPaidAt(a)?.getTime() ?? 0))[0];
  const p = ro.payment;
  return {
    status: snap.status,
    collectedCents: snap.collectedCents,
    balanceCents: snap.balanceCents,
    method: latest
      ? paymentRowMethod(latest)
      : normalizePaymentMethod(p?.method, { stripe: !!p?.stripePaymentIntentId }),
    amountCents: latest ? latest.amountCents : (p?.amountCents ?? null),
    note: latest ? (latest.note ?? null) : (p?.note ?? null),
    paidAt: latest ? paymentRowPaidAt(latest) : (p?.paidAt ?? null),
    stripePaymentIntentId: p?.stripePaymentIntentId ?? null,
  };
}

/** Load every Payment row for one RO, oldest first. Always shop-scoped. */
export async function loadPaymentRows(shopId: unknown, repairOrderId: unknown) {
  return Payment.find({ shopId, repairOrderId }).sort({ createdAt: 1 }).lean();
}

/**
 * Recompute `ro.payment.{status,collectedCents,method,amountCents,note,paidAt}`
 * from the RO's Payment rows and write it onto the (mutable) document. Caller
 * still `save()`s. Returns the snapshot so handlers can echo it back.
 */
export async function syncRoPayment(ro: {
  _id: unknown;
  shopId: unknown;
  total?: number | null;
  payment?: RoPaymentLike | null;
  set: (path: string, value: unknown) => unknown;
}): Promise<RoPaymentSnapshot & { rows: Awaited<ReturnType<typeof loadPaymentRows>> }> {
  const rows = await loadPaymentRows(ro.shopId, ro._id);
  const view = serializeRoPayment(ro, rows);
  ro.set("payment", {
    ...(ro.payment ?? {}),
    status: view.status,
    collectedCents: view.collectedCents,
    method: view.method ?? undefined,
    amountCents: view.amountCents ?? undefined,
    note: view.note ?? undefined,
    paidAt: view.paidAt ?? undefined,
    stripePaymentIntentId: ro.payment?.stripePaymentIntentId ?? undefined,
  });
  return { status: view.status, collectedCents: view.collectedCents, balanceCents: view.balanceCents, rows };
}
