export const RO_STATUSES = [
  "scheduled",
  "in",
  "diagnosing",
  "awaiting_parts",
  "in_repair",
  "ready",
  "picked_up",
  "voided",
] as const;
export type RoStatus = (typeof RO_STATUSES)[number];

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
