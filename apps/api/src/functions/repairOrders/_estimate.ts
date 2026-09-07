/**
 * Estimate approval snapshot helpers.
 *
 * When a customer approves, we freeze the line set + total they agreed to on
 * `ro.estimate.approvedTotal` / `approvedTaxTotal` / `approvedLineItems`. Any
 * later edit to the line items is then detectable by comparing fingerprints,
 * so the RO page can say "Changed since approval · $294.50 approved" instead
 * of silently keeping the APPROVED badge — and the public estimate page keeps
 * rendering the snapshot, never the live lines, once approved. Re-sending the
 * estimate clears the snapshot.
 *
 * Approvals recorded before snapshotting shipped (approvedAt set, no
 * snapshot) are healed lazily by `ensureApprovalSnapshot` — see below.
 */

import { RepairOrder } from "@lift/shared";

export interface SnapshotLine {
  kind: string;
  description: string;
  hours?: number | null;
  rate?: number | null;
  qty?: number | null;
  unitPrice?: number | null;
  total: number;
}

interface EstimateLike {
  sentAt?: Date | null;
  viewedAt?: Date | null;
  approvedAt?: Date | null;
  declinedAt?: Date | null;
  declineReason?: string | null;
  declineFollowedUpAt?: Date | null;
  publicToken?: string | null;
  approvedTotal?: number | null;
  approvedTaxTotal?: number | null;
  approvedLineItems?: SnapshotLine[] | null;
  approvedSnapshotBackfilledAt?: Date | null;
}

interface RoLike {
  _id?: unknown;
  lineItems?: SnapshotLine[] | null;
  taxTotal?: number | null;
  total?: number | null;
  lineItemsChangedAt?: Date | null;
  estimate?: EstimateLike | null;
}

export function snapshotLineItems(items: RoLike["lineItems"]): SnapshotLine[] {
  return (items ?? []).map((li) => ({
    kind: li.kind,
    description: li.description,
    hours: li.hours ?? null,
    rate: li.rate ?? null,
    qty: li.qty ?? null,
    unitPrice: li.unitPrice ?? null,
    total: li.total,
  }));
}

// Order-insensitive so a reorder that leaves the work identical isn't a "change".
export function lineItemsFingerprint(items: SnapshotLine[] | null | undefined): string {
  return (items ?? [])
    .map((li) => `${li.kind}|${li.description.trim().toLowerCase()}|${li.total}`)
    .sort()
    .join("\n");
}

/** Fields to stamp on `estimate` at approval time. */
export function approvalStamp(ro: RoLike, at = new Date()) {
  return {
    approvedAt: at,
    approvedTotal: ro.total ?? 0,
    approvedTaxTotal: ro.taxTotal ?? 0,
    approvedLineItems: snapshotLineItems(ro.lineItems),
  };
}

/** True when the approval carries a line/total snapshot (post round-1 approvals). */
export function hasApprovalSnapshot(ro: RoLike): boolean {
  const est = ro.estimate;
  return !!est?.approvedAt && (est.approvedTotal != null || !!est.approvedLineItems);
}

/**
 * Heal a legacy approval (approvedAt set, no snapshot) by freezing the
 * *current* lines as the approved set — the best truth available, since the
 * lines the customer actually saw were never recorded. Writes once (guarded
 * so concurrent reads can't clobber a real snapshot), mutates `ro` in place,
 * and logs so the backfill is visible in CloudWatch. No-op otherwise.
 */
export async function ensureApprovalSnapshot(ro: RoLike): Promise<boolean> {
  const est = ro.estimate;
  if (!est?.approvedAt || hasApprovalSnapshot(ro) || !ro._id) return false;

  const stamp = approvalStamp(ro, est.approvedAt);
  const backfilledAt = new Date();
  const res = await RepairOrder.updateOne(
    {
      _id: ro._id,
      "estimate.approvedAt": { $exists: true },
      "estimate.approvedTotal": { $exists: false },
      "estimate.approvedLineItems": { $exists: false },
    },
    {
      $set: {
        "estimate.approvedTotal": stamp.approvedTotal,
        "estimate.approvedTaxTotal": stamp.approvedTaxTotal,
        "estimate.approvedLineItems": stamp.approvedLineItems,
        "estimate.approvedSnapshotBackfilledAt": backfilledAt,
      },
    }
  );
  if (res.modifiedCount === 0) return false;

  est.approvedTotal = stamp.approvedTotal;
  est.approvedTaxTotal = stamp.approvedTaxTotal;
  est.approvedLineItems = stamp.approvedLineItems;
  est.approvedSnapshotBackfilledAt = backfilledAt;
  console.log(
    `[estimate] backfilled approval snapshot for RO ${String(ro._id)}: ` +
      `${stamp.approvedLineItems.length} lines, total ${stamp.approvedTotal}c (approved ${est.approvedAt.toISOString()})`
  );
  return true;
}

/**
 * True when the RO was approved and the line items have since diverged from
 * the approved snapshot. Legacy approvals with no snapshot can't be judged —
 * call `ensureApprovalSnapshot` first on read paths.
 */
export function estimateChangedSinceApproval(ro: RoLike): boolean {
  const est = ro.estimate;
  if (!est?.approvedAt) return false;
  if (!hasApprovalSnapshot(ro)) return false;
  if ((est.approvedTotal ?? 0) !== (ro.total ?? 0)) return true;
  return (
    lineItemsFingerprint(est.approvedLineItems) !==
    lineItemsFingerprint(snapshotLineItems(ro.lineItems))
  );
}

/**
 * True when the customer declined and hasn't since approved. An approval
 * always wins over an earlier decline (the customer changed their mind), so
 * callers should never read `declinedAt` alone.
 */
export function isEstimateDeclined(est: EstimateLike | null | undefined): boolean {
  return !!est?.declinedAt && !est?.approvedAt;
}

/**
 * The approved estimate as the customer agreed to it — what the public page
 * renders once `approvedAt` is set. Labor/parts split is derived from the
 * snapshot lines (fees roll into parts, same as `recomputeTotals`).
 */
export function approvedSnapshotView(ro: RoLike) {
  const est = ro.estimate;
  if (!est?.approvedAt || !hasApprovalSnapshot(ro)) return null;
  const lineItems = est.approvedLineItems ?? [];
  let laborTotal = 0;
  let partsTotal = 0;
  for (const li of lineItems) {
    if (li.kind === "labor") laborTotal += li.total;
    else partsTotal += li.total;
  }
  return {
    lineItems: lineItems.map((li) => ({
      kind: li.kind,
      description: li.description,
      hours: li.hours ?? null,
      rate: li.rate ?? null,
      qty: li.qty ?? null,
      unitPrice: li.unitPrice ?? null,
      total: li.total,
    })),
    laborTotal,
    partsTotal,
    taxTotal: est.approvedTaxTotal ?? 0,
    total: est.approvedTotal ?? 0,
  };
}

/** Estimate state as exposed to the app + public pages (no token). */
export function serializeEstimate(ro: RoLike) {
  const est = ro.estimate;
  if (!est) return null;
  const declined = isEstimateDeclined(est);
  const changedSinceApproval = estimateChangedSinceApproval(ro);
  return {
    sentAt: est.sentAt ?? null,
    viewedAt: est.viewedAt ?? null,
    approvedAt: est.approvedAt ?? null,
    declinedAt: declined ? est.declinedAt ?? null : null,
    declineReason: declined ? est.declineReason ?? null : null,
    declineFollowedUpAt: declined ? est.declineFollowedUpAt ?? null : null,
    approvedTotal: est.approvedAt ? est.approvedTotal ?? null : null,
    approvedTaxTotal: est.approvedAt ? est.approvedTaxTotal ?? null : null,
    changedSinceApproval,
    // When the lines were last touched — only meaningful alongside a
    // divergence, so the RO page can say "· changed 4:12 PM".
    changedAt: changedSinceApproval ? ro.lineItemsChangedAt ?? null : null,
    // publicToken intentionally omitted — server-side only.
  };
}

/** Match either token slot — sendInspection mints estimate.publicToken alone. */
export function estimateTokenQuery(token: string) {
  return { $or: [{ publicToken: token }, { "estimate.publicToken": token }] };
}
