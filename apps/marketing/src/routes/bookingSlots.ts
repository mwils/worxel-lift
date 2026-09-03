import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api";
import type { Slot, SlotResponse } from "../api";

/**
 * Shared slot-window logic for the public booking (/book/:slug) and manage
 * (/booking/:token) pages. Both calendars must request the SAME range the API
 * accepts — `horizonDays` inclusive of today — or the slots call 400s with
 * "Range too wide" and every day looks closed.
 */

/** Matches BOOKING_DEFAULTS.horizonDays in @lift/shared (marketing doesn't depend on shared). */
export const DEFAULT_HORIZON_DAYS = 14;

const PHONE_DIGITS_RE = /\D+/g;
export function normalizeUSPhone(raw: string): string | null {
  // Accept the four most common formats Mike's customers will type:
  //   555-555-5555, (555) 555-5555, +1 555 555 5555, 5555555555
  // Normalize to E.164. Anything else falls through to a validation error.
  const digits = raw.replace(PHONE_DIGITS_RE, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/** "+18643100337" → "(864) 310-0337". Returns the input untouched if it isn't a US number. */
export function formatUSPhoneDisplay(raw: string): string {
  const e164 = normalizeUSPhone(raw);
  if (!e164) return raw;
  const d = e164.slice(2);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function formatYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTimeInTz(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLongInTz(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface SlotWindow {
  /** First selectable calendar day (browser-local today). */
  today: Date;
  /** Last selectable calendar day — today + horizonDays - 1 (inclusive span). */
  maxDate: Date;
  slotData: SlotResponse | null;
  /** YYYY-MM-DD → whether at least one slot is open; missing key = unknown. */
  dayHasSlots: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  slotsForDay: (date: Date | null) => Slot[];
}

/**
 * Fetch the shop's bookable window once and expose the calendar bounds plus a
 * per-day availability map for greying out closed days. `excludeToken` is the
 * manage token of a booking being rescheduled — the API drops that RO from its
 * own slot-capacity count so the customer's current time isn't shown as full.
 */
export function useSlotWindow({
  slug,
  horizonDays,
  excludeToken,
}: {
  slug: string;
  horizonDays: number | null | undefined;
  excludeToken?: string;
}): SlotWindow {
  const days = horizonDays && horizonDays > 0 ? horizonDays : DEFAULT_HORIZON_DAYS;
  const today = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => {
    // horizonDays counts today as day 1 — the API validates the INCLUSIVE
    // from..to span, so today + horizonDays would be one day too many.
    // Calendar-day arithmetic, not ms math, so DST boundaries don't drift it.
    const d = new Date(today);
    d.setDate(d.getDate() + days - 1);
    return d;
  }, [today, days]);

  const [slotData, setSlotData] = useState<SlotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ from: formatYmd(today), to: formatYmd(maxDate) });
    if (excludeToken) params.set("exclude", excludeToken);
    setLoading(true);
    setError(null);
    api
      .get<SlotResponse>(`/public/book/${slug}/slots?${params.toString()}`)
      .then((res) => {
        if (!cancelled) setSlotData(res);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, excludeToken, today, maxDate]);

  const dayHasSlots = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const d of slotData?.days ?? []) {
      map[d.date] = d.slots.some((s) => s.available);
    }
    return map;
  }, [slotData]);

  const slotsForDay = (date: Date | null): Slot[] => {
    if (!date || !slotData) return [];
    const key = formatYmd(date);
    return slotData.days.find((d) => d.date === key)?.slots ?? [];
  };

  return { today, maxDate, slotData, dayHasSlots, loading, error, slotsForDay };
}
