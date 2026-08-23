export function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatRoNumber(n: number): string {
  return `RO-${String(n).padStart(4, "0")}`;
}

export function formatPhone(e164: string): string {
  // +15551234567 → (555) 123-4567
  const m = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (!m) return e164;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

export function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

// Calendar date (YYYY-MM-DD) as seen in `tz` — the basis for "is this today?"
// comparisons, which can't be done on timestamps alone.
function ymdInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Next calendar day, by date arithmetic rather than +24h — adding a fixed 24
// hours lands on the wrong day across a DST boundary.
function nextYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10);
}

/**
 * A scheduled visit as the owner reads it, in the shop's timezone:
 * "Today 2:30 PM", "Tomorrow 8:00 AM", "Mon Aug 24, 2:30 PM".
 * The shop's timezone matters — an owner in Phoenix must not see a booking
 * shifted by the browser's zone.
 */
export function formatVisit(date: Date | string, tz: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";

  const time = d.toLocaleString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const target = ymdInTz(d, tz);
  const today = ymdInTz(new Date(), tz);

  if (target === today) return `Today ${time}`;
  if (target === nextYmd(today)) return `Tomorrow ${time}`;

  // en-US renders this as "Mon, Aug 24"; drop that first comma so the whole
  // string reads the way it's spoken: "Mon Aug 24, 8:00 AM".
  const day = d
    .toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" })
    .replace(",", "");
  return `${day}, ${time}`;
}

// The shop's timezone, falling back to the browser's — a wrong fixed default
// would silently misreport every visit time.
export function shopTimezone(tz: string | null | undefined): string {
  if (tz) return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago";
  } catch {
    return "America/Chicago";
  }
}

// Minutes east of UTC that `tz` observes at `instant`. Derived via Intl —
// the only zone database the browser ships.
function tzOffsetMinutes(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24, // Intl renders midnight as "24" in some engines
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The instant at which the shop's wall clock reads the picker's value.
 *
 * Date pickers hand back a browser-local Date, but "8:00 AM" typed by the
 * owner means 8:00 AM *at the shop*. Reinterpret the picker's wall-clock
 * fields in the shop's zone. Second offset pass handles picks that land on a
 * DST transition.
 */
export function pickerDateToInstant(picked: Date, tz: string): Date {
  const naive = Date.UTC(
    picked.getFullYear(),
    picked.getMonth(),
    picked.getDate(),
    picked.getHours(),
    picked.getMinutes()
  );
  let ts = naive - tzOffsetMinutes(new Date(naive), tz) * 60_000;
  ts = naive - tzOffsetMinutes(new Date(ts), tz) * 60_000;
  return new Date(ts);
}

/**
 * Inverse of pickerDateToInstant: a browser-local Date whose wall-clock fields
 * equal the shop-zone rendering of `iso`, for prefilling a picker.
 */
export function instantToPickerDate(iso: string, tz: string): Date {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
}
