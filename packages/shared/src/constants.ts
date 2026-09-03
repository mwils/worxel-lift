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
