import {
  Customer,
  RepairOrder,
  SERVICE_CATEGORIES,
  SERVICE_INTERVALS,
  SERVICE_KEYWORDS,
  ServiceReminder,
  type ServiceCategory,
} from "@lift/shared";

const DAY_MS = 86_400_000;

/**
 * Inspect an RO's line items, derive due-dates from `completedAt`, and upsert
 * one `pending` ServiceReminder per (vehicle, category). Last-known service
 * wins — if a reminder already exists with an older dueAt, we push it out to
 * the new one.
 *
 * Called from `repairOrders/patch.ts` after the status transitions to
 * `picked_up` (or whenever `completedAt` is stamped). Failures here must not
 * block the patch — caller wraps in `void` + try/catch.
 */
export async function inferServiceReminders(args: {
  shopId: string;
  repairOrderId: string;
}): Promise<{ created: number; updated: number; skipped: boolean }> {
  const ro = await RepairOrder.findOne({
    _id: args.repairOrderId,
    shopId: args.shopId,
  }).lean();

  if (!ro) {
    return { created: 0, updated: 0, skipped: true };
  }
  if (!ro.completedAt) {
    // Inference only runs once the RO is closed and we know "this service
    // happened on date X." A scheduled-but-not-yet-completed RO has nothing
    // to infer from.
    return { created: 0, updated: 0, skipped: true };
  }

  // Skip if customer is SMS-opted-out — we won't be able to send the reminder
  // anyway, so don't litter the dashboard with rows that'll just be marked
  // `opted_out` later.
  const customer = await Customer.findOne({
    _id: ro.customerId,
    shopId: args.shopId,
  })
    .select("smsOptOutAt")
    .lean();
  if (customer?.smsOptOutAt) {
    return { created: 0, updated: 0, skipped: true };
  }

  const completedAt = new Date(ro.completedAt);
  const matchedCategories = new Set<ServiceCategory>();

  for (const li of ro.lineItems ?? []) {
    const desc = (li.description ?? "").toLowerCase();
    if (!desc) continue;
    for (const cat of SERVICE_CATEGORIES) {
      if (matchedCategories.has(cat)) continue;
      const hit = SERVICE_KEYWORDS[cat].some((kw) => desc.includes(kw));
      if (hit) matchedCategories.add(cat);
    }
  }

  if (matchedCategories.size === 0) {
    return { created: 0, updated: 0, skipped: false };
  }

  let created = 0;
  let updated = 0;

  for (const category of matchedCategories) {
    const { days } = SERVICE_INTERVALS[category];
    const dueAt = new Date(completedAt.getTime() + days * DAY_MS);

    // Upsert keyed by (shop, customer, vehicle, category, status=pending).
    // If a pending reminder already exists, we move `dueAt` forward (the
    // new service resets the clock) and re-stamp `sourceRepairOrderId`. We
    // explicitly do not touch reminders already in sent/dismissed/opted_out.
    const res = await ServiceReminder.updateOne(
      {
        shopId: ro.shopId,
        customerId: ro.customerId,
        vehicleId: ro.vehicleId,
        category,
        status: "pending",
      },
      {
        $set: {
          dueAt,
          sourceRepairOrderId: ro._id,
        },
        $setOnInsert: {
          shopId: ro.shopId,
          customerId: ro.customerId,
          vehicleId: ro.vehicleId,
          category,
          status: "pending",
          attempt: 0,
        },
      },
      { upsert: true }
    );

    if (res.upsertedCount && res.upsertedCount > 0) created++;
    else if (res.modifiedCount && res.modifiedCount > 0) updated++;
  }

  return { created, updated, skipped: false };
}
