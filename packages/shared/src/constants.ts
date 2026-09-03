export const RO_STATUSES = [
  "scheduled",
  "in",
  "diagnosing",
  "awaiting_parts",
  "in_repair",
  "ready",
  "picked_up",
  "voided",
  "cancelled_by_customer",
] as const;
export type RoStatus = (typeof RO_STATUSES)[number];

// Human labels for every place a status renders (board columns, RO status
// select, history badges). Never show the raw enum to the shop owner.
export const RO_STATUS_LABELS: Record<RoStatus, string> = {
  scheduled: "Scheduled",
  in: "Checked in",
  diagnosing: "Diagnosing",
  awaiting_parts: "Awaiting parts",
  in_repair: "In repair",
  ready: "Ready for pickup",
  picked_up: "Picked up",
  voided: "Voided",
  cancelled_by_customer: "Cancelled by customer",
};

// `cancelled_by_customer` is intentionally NOT in the open set — a cancelled
// booking shouldn't occupy a bay or count toward a slot's maxPerSlot.
export const RO_OPEN_STATUSES: RoStatus[] = [
  "scheduled",
  "in",
  "diagnosing",
  "awaiting_parts",
  "in_repair",
  "ready",
];

export const LINE_ITEM_KINDS = ["labor", "part", "fee"] as const;
export type LineItemKind = (typeof LINE_ITEM_KINDS)[number];

export const PAYMENT_STATUSES = [
  "unpaid",
  "authorized",
  "paid",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// How an RO was settled. `stripe` is set by the pay-link / card-on-file
// paths; the rest are recorded by the owner via "Mark paid" for shops that
// take cash or run their own card terminal.
export const PAYMENT_METHODS = ["cash", "card", "check", "other", "stripe"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const MANUAL_PAYMENT_METHODS = ["cash", "card", "check", "other"] as const;

export const MESSAGE_CLASSIFICATIONS = [
  "status_check",
  "approval",
  "question",
  "other",
  "opt_out",
] as const;
export type MessageClassification = (typeof MESSAGE_CLASSIFICATIONS)[number];

export const USER_ROLES = ["owner", "tech"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const AI_TONES = ["plain", "friendly"] as const;
export type AiTone = (typeof AI_TONES)[number];

export const PLAN_PRICE_USD = 79;
export const PLAN_TRIAL_DAYS = 14;

export const MAGIC_LINK_TTL_MIN = 15;
export const SMS_CODE_TTL_MIN = 5;

export const INSPECTION_SEVERITIES = ["green", "yellow", "red"] as const;
export type InspectionSeverity = (typeof INSPECTION_SEVERITIES)[number];

export const INSPECTION_STATUSES = ["draft", "sent"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

// ── Service-due reminders ───────────────────────────────────────
export const SERVICE_REMINDER_STATUSES = [
  "pending",
  "sent",
  "dismissed",
  "opted_out",
  "failed",
] as const;
export type ServiceReminderStatus = (typeof SERVICE_REMINDER_STATUSES)[number];

export const SERVICE_CATEGORIES = [
  "oil_change",
  "tire_rotation",
  "brake_inspection",
  "coolant_service",
  "transmission_service",
  "alignment",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/**
 * Default service intervals. Days are calendar days from the completion of
 * the source RO. `label` is the customer-facing phrasing the AI prompt and
 * the UI both reference.
 */
export const SERVICE_INTERVALS: Record<ServiceCategory, { days: number; label: string }> = {
  oil_change: { days: 90, label: "Oil change" },
  tire_rotation: { days: 180, label: "Tire rotation" },
  brake_inspection: { days: 365, label: "Brake inspection" },
  coolant_service: { days: 730, label: "Coolant service" },
  transmission_service: { days: 730, label: "Transmission service" },
  alignment: { days: 365, label: "Alignment check" },
};

/**
 * Substring keywords that flip the inference hook. Lowercased, plain
 * substring match against the line-item description. Keep this list narrow —
 * adding fuzzy synonyms here will produce false-positive reminders.
 */
export const SERVICE_KEYWORDS: Record<ServiceCategory, readonly string[]> = {
  oil_change: ["oil change", "lof", "oil & filter", "oil and filter"],
  tire_rotation: ["tire rotation", "rotate tires", "rotate tire"],
  brake_inspection: ["brake inspect", "pad", "rotor", "brake service"],
  coolant_service: ["coolant flush", "antifreeze", "coolant service"],
  transmission_service: ["transmission flush", "atf", "transmission service"],
  alignment: ["alignment", "wheel align"],
};

/** Days the dailyScan window allows on either side of `dueAt`. */
export const SERVICE_REMINDER_TOLERANCE_DAYS = 1;
/** How far back the scan will sweep for stale-but-still-relevant reminders. */
export const SERVICE_REMINDER_LOOKBACK_DAYS = 30;

// ── Online booking ─────────────────────────────────────────────
/**
 * Defaults applied when a shop first enables online booking. Owner can override
 * any of these from Settings; the slot algorithm reads from `shop.settings.booking`
 * directly, falling back to these on a missing field.
 */
export const BOOKING_DEFAULTS = {
  slotMinutes: 60,
  maxPerSlot: 1,
  leadTimeHours: 2,
  horizonDays: 14,
} as const;

/** Slug must be lowercase alphanumeric+hyphens, can't start/end with a hyphen, 2-42 chars. */
export const SHOP_SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,40}[a-z0-9])?$/;

// ── Marketing blog ──────────────────────────────────────────────
// `scheduled` posts become publicly visible the moment scheduledFor passes —
// the renderer treats visibility as (published OR scheduled-and-due), so the
// scheduled→published flip is bookkeeping, not a publish gate. `rejected`
// covers both pre-publish rejection and post-publish retraction.
export const BLOG_POST_STATUSES = ["scheduled", "published", "rejected"] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

/** Target size of the forward queue the generation cron maintains. */
export const BLOG_QUEUE_TARGET = 7;
/** Publish cadence: a new post every N days. */
export const BLOG_CADENCE_DAYS = 2;
/** Local wall-clock publish hour in the blog's home timezone. */
export const BLOG_PUBLISH_HOUR_LOCAL = 7;
export const BLOG_TIMEZONE = "America/Chicago";

// ── Shop profile: US states, timezones, slugs, opt-in copy ──────
/** Two-letter USPS codes — the 50 states plus DC. Stored uppercase. */
export const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
  "VT", "VA", "WA", "WV", "WI", "WY",
] as const;
export type UsStateCode = (typeof US_STATE_CODES)[number];

export const US_STATE_NAMES: Record<UsStateCode, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Curated IANA zones offered in the Settings timezone picker. */
export const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix, no DST)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
] as const;

export const DEFAULT_SHOP_TIMEZONE = "America/Chicago";

/**
 * IANA zones observed in each state, dominant zone first. Split states list
 * every zone so a browser-reported zone that matches can win over the default.
 */
export const US_STATE_TIMEZONES: Record<UsStateCode, readonly string[]> = {
  AL: ["America/Chicago"],
  AK: ["America/Anchorage"],
  AZ: ["America/Phoenix", "America/Denver"],
  AR: ["America/Chicago"],
  CA: ["America/Los_Angeles"],
  CO: ["America/Denver"],
  CT: ["America/New_York"],
  DE: ["America/New_York"],
  DC: ["America/New_York"],
  FL: ["America/New_York", "America/Chicago"],
  GA: ["America/New_York"],
  HI: ["Pacific/Honolulu"],
  ID: ["America/Denver", "America/Los_Angeles"],
  IL: ["America/Chicago"],
  IN: ["America/New_York", "America/Chicago"],
  IA: ["America/Chicago"],
  KS: ["America/Chicago", "America/Denver"],
  KY: ["America/New_York", "America/Chicago"],
  LA: ["America/Chicago"],
  ME: ["America/New_York"],
  MD: ["America/New_York"],
  MA: ["America/New_York"],
  MI: ["America/New_York", "America/Chicago"],
  MN: ["America/Chicago"],
  MS: ["America/Chicago"],
  MO: ["America/Chicago"],
  MT: ["America/Denver"],
  NE: ["America/Chicago", "America/Denver"],
  NV: ["America/Los_Angeles", "America/Denver"],
  NH: ["America/New_York"],
  NJ: ["America/New_York"],
  NM: ["America/Denver"],
  NY: ["America/New_York"],
  NC: ["America/New_York"],
  ND: ["America/Chicago", "America/Denver"],
  OH: ["America/New_York"],
  OK: ["America/Chicago"],
  OR: ["America/Los_Angeles", "America/Denver"],
  PA: ["America/New_York"],
  RI: ["America/New_York"],
  SC: ["America/New_York"],
  SD: ["America/Chicago", "America/Denver"],
  TN: ["America/Chicago", "America/New_York"],
  TX: ["America/Chicago", "America/Denver"],
  UT: ["America/Denver"],
  VT: ["America/New_York"],
  VA: ["America/New_York"],
  WA: ["America/Los_Angeles"],
  WV: ["America/New_York"],
  WI: ["America/Chicago"],
  WY: ["America/Denver"],
};

/** True when `tz` is an IANA zone the runtime's Intl database knows. */
export function isValidTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pick a shop timezone from its state, with the browser's zone as a tiebreaker
 * for split states (a Knoxville shop in TN is Eastern, not the Central default)
 * and as the fallback when no state is known. Last resort: Central.
 */
export function resolveShopTimezone(
  state: string | null | undefined,
  browserTz: string | null | undefined
): string {
  const code = (state ?? "").trim().toUpperCase() as UsStateCode;
  const zones = US_STATE_TIMEZONES[code];
  const hint = isValidTimezone(browserTz) ? browserTz : null;
  if (zones && zones.length > 0) {
    return hint && zones.includes(hint) ? hint : zones[0]!;
  }
  return hint ?? DEFAULT_SHOP_TIMEZONE;
}

/**
 * "Mike's Auto & Tire" → "mikes-auto-tire". Lowercases, drops apostrophes,
 * turns any other run of non-alphanumerics into a single hyphen, and trims
 * leading/trailing hyphens. Does NOT enforce length — validate the result
 * against SHOP_SLUG_REGEX afterwards.
 */
export function slugifyShopName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Trim and collapse internal runs of whitespace: "  Mike's   Auto " → "Mike's Auto". */
export function collapseWhitespace(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * The verbal opt-in disclosure stored on each shop. Mirrors the script
 * registered with our 10DLC campaign — keep the frequency, rates, STOP/HELP,
 * and privacy-URL clauses intact. Sender identity is Worxel Lift (the
 * registered 10DLC brand); the shop is the service context. Keep it that way —
 * "texts from [shop]" reads as reseller/ISV messaging to carrier vetting.
 */
export function buildOptInScript(shopName: string): string {
  return (
    `By providing your phone number, you agree to receive text messages from Worxel Lift about your repair order at ${shopName}. ` +
    `Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help. ` +
    `Terms & privacy: lift.worxel.com/privacy`
  );
}
