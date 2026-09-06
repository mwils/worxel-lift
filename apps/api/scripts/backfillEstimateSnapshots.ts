/**
 * One-off backfill for estimates approved before approval snapshotting shipped
 * (QA-2026-09-03 round-2 C1): any RO with `estimate.approvedAt` but no
 * `approvedTotal` / `approvedLineItems` gets its *current* lines frozen as the
 * approved set. That's the best truth available — the lines the customer
 * actually saw were never recorded — and it's marked with
 * `estimate.approvedSnapshotBackfilledAt` so it's distinguishable from a real
 * approval-time snapshot. From then on, line edits are flagged
 * "changed since approval" and the public page stops following live lines.
 *
 * The API also does this lazily on first read of an affected RO; this script
 * just does it for everything at once so nothing waits on a page view.
 *
 * Idempotent — safe to re-run. Dry run by default; pass --apply to write.
 *
 *   MONGODB_URI="mongodb+srv://..." pnpm --filter @lift/api exec tsx scripts/backfillEstimateSnapshots.ts
 *   MONGODB_URI="mongodb+srv://..." pnpm --filter @lift/api exec tsx scripts/backfillEstimateSnapshots.ts --apply
 *
 * Get the URI with `sst secret list --stage prod` (MongodbUri).
 */
import { RepairOrder, connectDb } from "@lift/shared";
import { approvalStamp, ensureApprovalSnapshot } from "../src/functions/repairOrders/_estimate.js";

const apply = process.argv.includes("--apply");

async function main() {
  await connectDb();
  const cursor = RepairOrder.find(
    {
      "estimate.approvedAt": { $exists: true },
      "estimate.approvedTotal": { $exists: false },
      "estimate.approvedLineItems": { $exists: false },
    },
    { shopId: 1, number: 1, lineItems: 1, taxTotal: 1, total: 1, estimate: 1 }
  )
    .lean()
    .cursor();

  let scanned = 0;
  let changed = 0;
  for await (const ro of cursor) {
    scanned++;
    const stamp = approvalStamp(ro as any, ro.estimate!.approvedAt!);
    console.log(
      `RO-${String(ro.number).padStart(4, "0")} (${String(ro._id)}, shop ${String(ro.shopId)})`,
      JSON.stringify({
        approvedAt: stamp.approvedAt,
        approvedTotal: stamp.approvedTotal,
        approvedTaxTotal: stamp.approvedTaxTotal,
        lines: stamp.approvedLineItems.map((li) => `${li.description} ${li.total}`),
      })
    );
    if (apply) {
      if (await ensureApprovalSnapshot(ro as any)) changed++;
    } else {
      changed++;
    }
  }
  console.log(`${apply ? "Snapshotted" : "Would snapshot"} ${changed} of ${scanned} approved ROs.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
