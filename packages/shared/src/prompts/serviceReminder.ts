import { SERVICE_INTERVALS, type ServiceCategory } from "../constants.js";

/**
 * Prompt template: draft a service-due reminder SMS for a known customer +
 * vehicle. Operational nudge, NOT marketing — one sentence, no URLs, no
 * coupons, no prices.
 */
export const SERVICE_REMINDER_PROMPT_VERSION = "service_reminder.v1";

export interface ServiceReminderPromptInput {
  shopName: string;
  customerFirstName: string;
  vehicle: { year?: number | null; make?: string | null; model?: string | null };
  category: ServiceCategory;
  /** Days since the original service (positive) — for "around 90 days ago" phrasing. */
  daysSinceService: number;
  aiTone: "plain" | "friendly";
}

function vehicleLabel(v: ServiceReminderPromptInput["vehicle"]): string {
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "your car";
}

export function buildServiceReminderPrompt(input: ServiceReminderPromptInput): string {
  const veh = vehicleLabel(input.vehicle);
  const service = SERVICE_INTERVALS[input.category].label.toLowerCase();
  const toneNote =
    input.aiTone === "friendly"
      ? "Warm, first-name basis. Mechanic-to-regular."
      : "Plain, matter-of-fact. Mechanic-to-customer.";

  return `
You are drafting a short SMS from a small independent auto repair shop to a
returning customer. The shop did this customer's ${service} on their ${veh}
about ${input.daysSinceService} days ago. We're nudging them to schedule the
next one.

TONE: ${toneNote}

SHOP: ${input.shopName}
CUSTOMER FIRST NAME: ${input.customerFirstName}
VEHICLE: ${veh}
SERVICE: ${service}

WRITE the SMS body. Rules:
- Exactly ONE sentence.
- Under 160 characters total.
- Address the customer by first name.
- Mention the vehicle (year/make/model is fine).
- Mention the service by name.
- Sign with the shop name at the end (e.g. "— ${input.shopName}").
- Do NOT include any URLs or links.
- Do NOT mention prices, discounts, coupons, or promotions.
- Do NOT use markdown or emoji.

Return ONLY the SMS body. No preamble.
`.trim();
}

/**
 * Deterministic fallback used when Bedrock errors or returns an empty body.
 * Stays within the same rules (one sentence, <160 chars, no URL, no price).
 */
export function buildServiceReminderFallback(input: ServiceReminderPromptInput): string {
  const veh = vehicleLabel(input.vehicle);
  const service = SERVICE_INTERVALS[input.category].label.toLowerCase();
  const body = `Hi ${input.customerFirstName}, your ${veh} is due for a ${service} — reply to book a time. — ${input.shopName}`;
  // Defensive trim: prompts say <160. The fallback should never exceed it,
  // but if vehicle/shop names are long, hard-cap to keep the SMS to a single
  // segment.
  return body.length > 160 ? body.slice(0, 157) + "..." : body;
}
