/**
 * Prompt template: draft a customer-facing SMS estimate from RO line items.
 *
 * Output goal: 2–4 short sentences a small-shop customer can understand.
 * Plain language. No mechanic jargon unless explained. End with a CTA link.
 */
export const ESTIMATE_PROMPT_VERSION = "estimate.v1";

export interface EstimatePromptInput {
  shopName: string;
  customerFirstName: string;
  vehicle: { year?: number; make?: string; model?: string };
  lineItems: Array<{ kind: "labor" | "part" | "fee"; description: string; total: number }>;
  totalCents: number;
  approveLinkUrl: string;
  aiTone: "plain" | "friendly";
}

export function buildEstimatePrompt(input: EstimatePromptInput): string {
  const veh = [input.vehicle.year, input.vehicle.make, input.vehicle.model]
    .filter(Boolean)
    .join(" ");
  const lines = input.lineItems
    .map((li) => `- ${li.description} ($${(li.total / 100).toFixed(2)})`)
    .join("\n");
  const total = `$${(input.totalCents / 100).toFixed(2)}`;
  const toneNote =
    input.aiTone === "friendly"
      ? "Warm, neighborly, first-name basis. Use a single emoji at most."
      : "Plain, matter-of-fact, no emojis. Mechanic-to-customer.";

  return `
You are drafting an SMS estimate from a small independent auto shop to a customer.

TONE: ${toneNote}

SHOP: ${input.shopName}
CUSTOMER FIRST NAME: ${input.customerFirstName}
VEHICLE: ${veh || "(unspecified)"}
WORK PROPOSED:
${lines}
TOTAL: ${total}
APPROVE LINK: ${input.approveLinkUrl}

WRITE the SMS body. Rules:
- 2–4 sentences total, under 320 chars.
- Open by addressing the customer by first name.
- Summarize what's being recommended in plain English (translate jargon).
- State the total clearly.
- End with the approve link on its own line.
- Do NOT include a signature line — the shop name appears in the sender ID.
- Do NOT use markdown. Plain text only.

Return ONLY the SMS body. No preamble.
`.trim();
}

/**
 * Deterministic SMS template for an estimate — no AI call required.
 *
 * Default path on the Send Estimate flow: the owner sees this immediately and
 * can hit "Polish with AI" inside the review modal to get the AI-translated
 * version. Keeping it short and machine-readable on purpose.
 */
export function buildEstimateTemplate(input: EstimatePromptInput): string {
  const veh = [input.vehicle.year, input.vehicle.make, input.vehicle.model]
    .filter(Boolean)
    .join(" ");
  const lines = input.lineItems
    .map((li) => `• ${li.description} — $${(li.total / 100).toFixed(2)}`)
    .join("\n");
  const total = `$${(input.totalCents / 100).toFixed(2)}`;
  const vehiclePart = veh ? ` for your ${veh}` : "";

  return [
    `Hi ${input.customerFirstName} — here's the estimate${vehiclePart}:`,
    "",
    lines,
    "",
    `Total: ${total}`,
    "",
    `Approve: ${input.approveLinkUrl}`,
  ].join("\n");
}
