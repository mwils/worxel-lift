import { DateTime, Interval } from "luxon";
import { RO_OPEN_STATUSES, RepairOrder, type RoStatus } from "@lift/shared";
import { BOOKING_DEFAULTS } from "@lift/shared/constants";

// Shape we need off the shop. We don't import the full ShopDoc here — Lambdas
// call this with the result of a `.lean()` query and the field set is stable.
// `settings` is `any` because Mongoose's InferSchemaType returns `null`-typed
// fields for optional sub-paths that the helper just navigates defensively.
export interface SlotShop {
  _id: { toString(): string } | string;
  timezone?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings?: any;
}

export interface SlotDay {
  date: string; // YYYY-MM-DD in shop tz
  slots: Array<{ start: string /* ISO UTC */; available: boolean }>;
}

export interface BookingConfig {
  slotMinutes: number;
  maxPerSlot: number;
  leadTimeHours: number;
  horizonDays: number;
  hours: Array<{ day: number; open?: string; close?: string; closed?: boolean }>;
}

export function readBookingConfig(shop: SlotShop): BookingConfig {
  const b = shop.settings?.booking ?? {};
  return {
    slotMinutes: b.slotMinutes ?? BOOKING_DEFAULTS.slotMinutes,
    maxPerSlot: b.maxPerSlot ?? BOOKING_DEFAULTS.maxPerSlot,
    leadTimeHours: b.leadTimeHours ?? BOOKING_DEFAULTS.leadTimeHours,
    horizonDays: b.horizonDays ?? BOOKING_DEFAULTS.horizonDays,
    hours: b.hours ?? [],
  };
}

/** Statuses that count against `maxPerSlot` for a given slot start. */
const RESERVED_STATUSES: RoStatus[] = [...RO_OPEN_STATUSES];

function parseHm(s: string | undefined): { h: number; m: number } | null {
  if (!s) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { h: hh, m: mm };
}

/**
 * Compute available booking slots for a shop between `fromYmd` and `toYmd`
 * (inclusive), in the shop's timezone. Returns ISO UTC start instants so the
 * client can render them however it wants.
 *
 * The algorithm:
 *  1. Walk each calendar date in [from, to] in shop tz.
 *  2. Look up the hours entry for that day-of-week; skip if closed/missing.
 *  3. Generate slot starts at `slotMinutes` increments while
 *     `start + slotMinutes <= close`.
 *  4. Drop any slot earlier than `now + leadTimeHours`.
 *  5. Bucket existing ROs (status ∈ open ∪ scheduled, scheduledFor in window)
 *     by ISO slot start; mark `available = count < maxPerSlot`.
 *
 * Returns all slots regardless of availability — the public page greys out
 * full ones rather than hiding them so the customer can see they're choosing
 * from a real calendar.
 */
export async function computeSlots(
  shop: SlotShop,
  fromYmd: string,
  toYmd: string,
  now: Date,
  opts?: { ignoreRoId?: string }
): Promise<SlotDay[]> {
  const tz = shop.timezone || "America/Chicago";
  const cfg = readBookingConfig(shop);

  const fromDt = DateTime.fromISO(fromYmd, { zone: tz }).startOf("day");
  const toDt = DateTime.fromISO(toYmd, { zone: tz }).startOf("day");
  if (!fromDt.isValid || !toDt.isValid || toDt < fromDt) return [];

  const earliest = DateTime.fromJSDate(now).plus({ hours: cfg.leadTimeHours });
  const windowEnd = toDt.plus({ days: 1 }); // exclusive

  // One Mongo query for everything that could collide in the window. We also
  // need to capture `scheduled` here — booking-source ROs land in scheduled
  // immediately, and RO_OPEN_STATUSES already contains it, but be explicit so a
  // future tweak to the open set doesn't silently break slot math.
  const reserved = new Set<string>([...RESERVED_STATUSES, "scheduled"]);
  const existingFilter: Record<string, unknown> = {
    shopId: shop._id,
    status: { $in: Array.from(reserved) },
    scheduledFor: { $gte: fromDt.toJSDate(), $lt: windowEnd.toJSDate() },
  };
  // Reschedule flow: the booking being moved shouldn't count against its own
  // slot, otherwise (with maxPerSlot=1) the customer's current time reads as full.
  if (opts?.ignoreRoId) existingFilter._id = { $ne: opts.ignoreRoId };
  const existing = await RepairOrder.find(existingFilter, { scheduledFor: 1, status: 1 }).lean();

  // Bucket counts by ISO UTC slot start.
  const buckets = new Map<string, number>();
  for (const ro of existing) {
    if (!ro.scheduledFor) continue;
    const key = new Date(ro.scheduledFor).toISOString();
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const days: SlotDay[] = [];
  const totalDays = Interval.fromDateTimes(fromDt, windowEnd).length("days");
  for (let i = 0; i < totalDays; i++) {
    const dayDt = fromDt.plus({ days: i });
    const ymd = dayDt.toFormat("yyyy-LL-dd");
    const dow = dayDt.weekday % 7; // luxon: 1=Mon..7=Sun → 0=Sun..6=Sat
    const hours = cfg.hours.find((h) => h.day === dow);
    if (!hours || hours.closed) {
      days.push({ date: ymd, slots: [] });
      continue;
    }
    const open = parseHm(hours.open);
    const close = parseHm(hours.close);
    if (!open || !close) {
      days.push({ date: ymd, slots: [] });
      continue;
    }

    const openDt = dayDt.set({ hour: open.h, minute: open.m, second: 0, millisecond: 0 });
    const closeDt = dayDt.set({ hour: close.h, minute: close.m, second: 0, millisecond: 0 });

    const slots: SlotDay["slots"] = [];
    let cursor = openDt;
    while (cursor.plus({ minutes: cfg.slotMinutes }) <= closeDt) {
      if (cursor >= earliest) {
        const iso = cursor.toUTC().toISO({ suppressMilliseconds: true });
        if (iso) {
          const count = buckets.get(iso) ?? 0;
          slots.push({ start: iso, available: count < cfg.maxPerSlot });
        }
      }
      cursor = cursor.plus({ minutes: cfg.slotMinutes });
    }
    days.push({ date: ymd, slots });
  }
  return days;
}

/**
 * Check that a candidate `start` ISO falls on a valid, currently-available
 * slot. Used at the booking + reschedule commit step.
 *
 * Returns `{ ok: true, slotIso }` (slotIso normalized to seconds) or
 * `{ ok: false, reason }`.
 */
export async function validateSlot(
  shop: SlotShop,
  startIso: string,
  now: Date,
  opts?: { ignoreRoId?: string }
): Promise<
  | { ok: true; slotIso: string; slotDate: Date }
  | { ok: false; reason: "invalid_start" | "outside_hours" | "too_soon" | "full" }
> {
  const tz = shop.timezone || "America/Chicago";
  const cfg = readBookingConfig(shop);

  const startDt = DateTime.fromISO(startIso, { zone: "utc" });
  if (!startDt.isValid) return { ok: false, reason: "invalid_start" };
  const inTz = startDt.setZone(tz);

  if (startDt < DateTime.fromJSDate(now).plus({ hours: cfg.leadTimeHours })) {
    return { ok: false, reason: "too_soon" };
  }

  const dow = inTz.weekday % 7;
  const hours = cfg.hours.find((h) => h.day === dow);
  if (!hours || hours.closed) return { ok: false, reason: "outside_hours" };
  const open = parseHm(hours.open);
  const close = parseHm(hours.close);
  if (!open || !close) return { ok: false, reason: "outside_hours" };

  const dayStart = inTz.startOf("day");
  const openDt = dayStart.set({ hour: open.h, minute: open.m });
  const closeDt = dayStart.set({ hour: close.h, minute: close.m });

  if (inTz < openDt || inTz.plus({ minutes: cfg.slotMinutes }) > closeDt) {
    return { ok: false, reason: "outside_hours" };
  }

  // Confirm `start` lies on a slot boundary (open + N*slotMinutes).
  const diffMin = inTz.diff(openDt, "minutes").minutes;
  if (Math.abs(diffMin % cfg.slotMinutes) > 0.001) {
    return { ok: false, reason: "outside_hours" };
  }

  const slotIso = startDt.toUTC().toISO({ suppressMilliseconds: true });
  if (!slotIso) return { ok: false, reason: "invalid_start" };

  // Live capacity check at commit time. For v1's maxPerSlot=1 case this is
  // count-then-insert; the SST plan accepts the rare-race risk in lieu of a
  // Mongo transaction (see plan §4 open-questions).
  const filter: Record<string, unknown> = {
    shopId: shop._id,
    status: { $in: [...RESERVED_STATUSES, "scheduled"] },
    scheduledFor: new Date(slotIso),
  };
  if (opts?.ignoreRoId) filter._id = { $ne: opts.ignoreRoId };
  const count = await RepairOrder.countDocuments(filter);
  if (count >= cfg.maxPerSlot) return { ok: false, reason: "full" };

  return { ok: true, slotIso, slotDate: new Date(slotIso) };
}
