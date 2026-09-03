/**
 * Prompt template: short auto-reply to a customer "is my car ready" check.
 */
export const STATUS_REPLY_PROMPT_VERSION = "status_reply.v1";

export interface StatusReplyInput {
  customerFirstName: string;
  shopName: string;
  roStatus: string;
  etaText?: string; // e.g. "today by 4pm" — owner-supplied
  aiTone: "plain" | "friendly";
}

/** Customer-facing phrase per RO status. Shared with the freeform draft prompt. */
export const RO_STATUS_PHRASES: Record<string, string> = {
  scheduled: "scheduled to come in",
  in: "in the shop and getting looked at",
  diagnosing: "being diagnosed right now",
  awaiting_parts: "waiting on a part to arrive",
  in_repair: "in repair right now",
  ready: "done — ready for pickup",
  picked_up: "already picked up",
};

export function buildStatusReplyPrompt(input: StatusReplyInput): string {
  const phrase = RO_STATUS_PHRASES[input.roStatus] ?? "in progress";
  const tone =
    input.aiTone === "friendly"
      ? "Warm, neighborly. At most one emoji."
      : "Plain and direct. No emoji.";
  return `
Draft a one-sentence SMS reply to a customer asking about their car.

CUSTOMER FIRST NAME: ${input.customerFirstName}
SHOP: ${input.shopName}
CURRENT STATUS: ${phrase}
${input.etaText ? `ETA: ${input.etaText}` : "ETA: not given — do not invent one."}
TONE: ${tone}

Rules:
- One sentence. Under 160 chars.
- Address the customer by first name.
- If ETA is missing, say the shop will follow up with one shortly.
- Do not promise a time that wasn't given.
- Return ONLY the SMS body.
`.trim();
}

/**
 * Deterministic SMS template for a status update — no AI call required.
 */
export function buildStatusReplyTemplate(input: StatusReplyInput): string {
  const phrase = RO_STATUS_PHRASES[input.roStatus] ?? "in progress";
  const eta = input.etaText
    ? ` ETA ${input.etaText}.`
    : " We'll follow up with an ETA shortly.";
  return `Hi ${input.customerFirstName} — your car is ${phrase}.${eta}`;
}
