/**
 * Estimate approval snapshot helpers.
 *
 * When a customer approves, we freeze the line set + total they agreed to on
 * `ro.estimate.approvedTotal` / `approvedLineItems`. Any later edit to the
 * line items is then detectable by comparing fingerprints, so the RO page can
 * say "Changed since approval · $294.50 approved" instead of silently keeping
 * the APPROVED badge. Re-sending the estimate clears the snapshot.
 */

interface SnapshotLine {
  kind: string;
  description: string;
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
  approvedLineItems?: SnapshotLine[] | null;
}

interface RoLike {
  lineItems?: Array<{ kind: string; description: string; total: number }> | null;
  total?: number | null;
  estimate?: EstimateLike | null;
}

export function snapshotLineItems(items: RoLike["lineItems"]): SnapshotLine[] {
  return (items ?? []).map((li) => ({
    kind: li.kind,
    description: li.description,
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
    approvedLineItems: snapshotLineItems(ro.lineItems),
  };
}

/**
 * True when the RO was approved and the line items have since diverged from
 * the approved snapshot. Legacy approvals (no snapshot) are never flagged.
 */
export function estimateChangedSinceApproval(ro: RoLike): boolean {
  const est = ro.estimate;
  if (!est?.approvedAt) return false;
  if (est.approvedTotal == null && !est.approvedLineItems) return false;
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

/** Estimate state as exposed to the app + public pages (no token). */
export function serializeEstimate(ro: RoLike) {
  const est = ro.estimate;
  if (!est) return null;
  const declined = isEstimateDeclined(est);
  return {
    sentAt: est.sentAt ?? null,
    viewedAt: est.viewedAt ?? null,
    approvedAt: est.approvedAt ?? null,
    declinedAt: declined ? est.declinedAt ?? null : null,
    declineReason: declined ? est.declineReason ?? null : null,
    declineFollowedUpAt: declined ? est.declineFollowedUpAt ?? null : null,
    approvedTotal: est.approvedAt ? est.approvedTotal ?? null : null,
    changedSinceApproval: estimateChangedSinceApproval(ro),
    // publicToken intentionally omitted — server-side only.
  };
}

/** Match either token slot — sendInspection mints estimate.publicToken alone. */
export function estimateTokenQuery(token: string) {
  return { $or: [{ publicToken: token }, { "estimate.publicToken": token }] };
}
