/**
 * One-off backfill for repair orders marked paid before Payment rows became
 * the source of truth (QA round 2, H1/H2 — 2026-09-06):
 *   - RO with `payment.status = "paid"` and no Payment row → create one manual
 *     row from `ro.payment` (method / amountCents / note / paidAt).
 *   - Legacy Stripe rows: `method: "card"` → "stripe", fill `vehicleId`.
 *   - Every RO with any row (or a legacy `paid` marker) gets
 *     `payment.{status,collectedCents,...}` recomputed from its rows, so a
 *     $200 cash entry against a $294.50 RO becomes PARTIAL, not PAID.
 *
 * Idempotent — safe to re-run. Dry run by default; pass --apply to write.
 *
 *   MONGODB_URI="mongodb+srv://..." pnpm --filter @lift/api exec tsx scripts/backfillPayments.ts
 *   MONGODB_URI="mongodb+srv://..." pnpm --filter @lift/api exec tsx scripts/backfillPayments.ts --apply
 *
 * Get the URI with `sst secret list --stage prod` (MongodbUri).
 */
import { Payment, RepairOrder, connectDb } from "@lift/shared";
import { roPaymentSnapshot, serializeRoPayment } from "../src/functions/repairOrders/_payments.js";

const apply = process.argv.includes("--apply");

async function main() {
  await connectDb();

  // 1. Legacy Stripe rows: method "card" → "stripe"; stamp vehicleId from the RO.
  let stripeFixed = 0;
  for await (const row of Payment.find({
    stripePaymentIntentId: { $exists: true, $ne: null },
    $or: [{ method: "card" }, { method: { $exists: false } }, { vehicleId: { $exists: false } }],
  }).cursor()) {
    const ro = await RepairOrder.findById(row.repairOrderId).select("vehicleId").lean();
    const set: Record<string, unknown> = {};
    if (row.method === "card" || !row.method) set.method = "stripe";
    if (!row.vehicleId && ro?.vehicleId) set.vehicleId = ro.vehicleId;
    if (!Object.keys(set).length) continue;
    stripeFixed++;
    console.log("payment", String(row._id), JSON.stringify({ set }));
    if (apply) await Payment.updateOne({ _id: row._id }, { $set: set });
  }

  // 2. ROs that have a payment marker or any rows: materialize legacy rows, resync.
  const roIdsWithRows = new Set(
    (await Payment.distinct("repairOrderId")).map((id: unknown) => String(id))
  );
  let scanned = 0;
  let rowsCreated = 0;
  let resynced = 0;
  for await (const ro of RepairOrder.find({
    $or: [{ "payment.status": { $in: ["paid", "partial", "refunded"] } }, { "payment.collectedCents": { $exists: true } }],
  }).cursor()) {
    scanned++;
    const p = ro.payment;
    const hasRows = roIdsWithRows.has(String(ro._id));

    // Legacy round-1 mark-paid: the collected amount lives only on the RO.
    if (!hasRows && p?.status === "paid" && typeof p.collectedCents !== "number" && !p.stripePaymentIntentId) {
      const snap = roPaymentSnapshot(ro);
      if (snap.collectedCents > 0) {
        const doc = {
          shopId: ro.shopId,
          repairOrderId: ro._id,
          customerId: ro.customerId,
          vehicleId: ro.vehicleId,
          amountCents: snap.collectedCents,
          status: "succeeded" as const,
          method: p.method === "card" ? "card_in_person" : (p.method ?? "other"),
          note: p.note ?? undefined,
          paidAt: p.paidAt ?? ro.updatedAt ?? new Date(),
          completedAt: p.paidAt ?? ro.updatedAt ?? new Date(),
        };
        rowsCreated++;
        console.log("RO", ro.number, "create payment", JSON.stringify({ amountCents: doc.amountCents, method: doc.method }));
        if (apply) await Payment.create(doc);
      }
    }

    // Recompute the RO's denormalized view from its rows (dry run: simulate).
    const rows = apply
      ? await Payment.find({ shopId: ro.shopId, repairOrderId: ro._id }).sort({ createdAt: 1 }).lean()
      : await Payment.find({ shopId: ro.shopId, repairOrderId: ro._id }).sort({ createdAt: 1 }).lean();
    if (!apply && rows.length === 0 && p?.status === "paid" && !p.stripePaymentIntentId) {
      // Simulate the row we would have created above.
      const snap = roPaymentSnapshot(ro);
      rows.push({
        amountCents: snap.collectedCents,
        status: "succeeded",
        method: p.method === "card" ? "card_in_person" : (p.method ?? "other"),
        paidAt: p.paidAt ?? ro.updatedAt ?? new Date(),
      } as (typeof rows)[number]);
    }
    if (rows.length === 0) continue;

    const view = serializeRoPayment(ro, rows);
    const changed =
      view.status !== p?.status ||
      view.collectedCents !== p?.collectedCents ||
      (view.method ?? undefined) !== (p?.method ?? undefined);
    if (!changed) continue;
    resynced++;
    console.log(
      "RO",
      ro.number,
      `${p?.status ?? "unpaid"} → ${view.status}`,
      JSON.stringify({ collectedCents: view.collectedCents, balanceCents: view.balanceCents, total: ro.total })
    );
    if (apply) {
      ro.set("payment", {
        ...(p ?? {}),
        status: view.status,
        collectedCents: view.collectedCents,
        method: view.method ?? undefined,
        amountCents: view.amountCents ?? undefined,
        note: view.note ?? undefined,
        paidAt: view.paidAt ?? undefined,
      });
      await ro.save();
    }
  }

  console.log(
    `${apply ? "Applied" : "Would apply"}: ${stripeFixed} Stripe rows normalized, ${rowsCreated} payment rows created, ${resynced} of ${scanned} ROs resynced.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
