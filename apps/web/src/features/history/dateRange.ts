import { pickerDateToInstant } from "../../lib/format";

/**
 * Date-range presets for the RO history page and the board's month strip,
 * resolved in the SHOP's timezone — "this month" for a shop in Phoenix is
 * Phoenix's month, not the browser's.
 *
 * Every range is half-open: [from, to). `to` is the first instant of the day
 * after the last day in range, so nothing on a boundary day gets dropped.
 */

export const RANGE_PRESETS = ["today", "this_week", "this_month", "last_month", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Today",
  this_week: "This week",
  this_month: "This month",
  last_month: "Last month",
  custom: "Custom",
};

export interface DateRange {
  from: Date;
  to: Date;
}

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

function todayYmd(tz: string, now = new Date()): Ymd {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")) };
}

/** Midnight at the start of the given calendar day, as the shop's clock reads it. */
function dayStart(ymd: Ymd, tz: string): Date {
  return pickerDateToInstant(new Date(ymd.y, ymd.m - 1, ymd.d, 0, 0), tz);
}

/** Calendar arithmetic via Date.UTC so month/day rollover and DST don't bite. */
function shiftYmd(ymd: Ymd, days: number): Ymd {
  const d = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + days));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

// 0 = Monday … 6 = Sunday. Shops run Monday-start weeks.
function weekdayIndex(ymd: Ymd): number {
  const dow = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay(); // 0 = Sun
  return (dow + 6) % 7;
}

export function presetRange(preset: Exclude<RangePreset, "custom">, tz: string, now = new Date()): DateRange {
  const today = todayYmd(tz, now);
  switch (preset) {
    case "today":
      return { from: dayStart(today, tz), to: dayStart(shiftYmd(today, 1), tz) };
    case "this_week": {
      const monday = shiftYmd(today, -weekdayIndex(today));
      return { from: dayStart(monday, tz), to: dayStart(shiftYmd(monday, 7), tz) };
    }
    case "this_month": {
      const first = { ...today, d: 1 };
      const nextFirst = today.m === 12 ? { y: today.y + 1, m: 1, d: 1 } : { y: today.y, m: today.m + 1, d: 1 };
      return { from: dayStart(first, tz), to: dayStart(nextFirst, tz) };
    }
    case "last_month": {
      const first = { ...today, d: 1 };
      const prevFirst = today.m === 1 ? { y: today.y - 1, m: 12, d: 1 } : { y: today.y, m: today.m - 1, d: 1 };
      return { from: dayStart(prevFirst, tz), to: dayStart(first, tz) };
    }
  }
}

/** A custom [start day, end day] pick (browser-local Dates from a picker) → shop-zone range. */
export function customRange(start: Date, end: Date, tz: string): DateRange {
  const s = { y: start.getFullYear(), m: start.getMonth() + 1, d: start.getDate() };
  const e = { y: end.getFullYear(), m: end.getMonth() + 1, d: end.getDate() };
  return { from: dayStart(s, tz), to: dayStart(shiftYmd(e, 1), tz) };
}

/** "Sep 2026" for the board strip header. */
export function monthLabel(tz: string, now = new Date()): string {
  return now.toLocaleString("en-US", { timeZone: tz, month: "short", year: "numeric" });
}

/** "Sep 3" / "Sep 3, 2025" (year only when it isn't this year) for history rows. */
export function formatHistoryDate(iso: string | Date, tz: string, now = new Date()): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = todayYmd(tz, now).y === todayYmd(tz, d).y;
  return d.toLocaleString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
