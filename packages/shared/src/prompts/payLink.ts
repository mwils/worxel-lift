/**
 * Prompt template: ask a customer to pay an outstanding RO balance over SMS.
 *
 * Output goal: 1–3 short sentences with the amount and the pay link.
 * Plain language. End with the pay link on its own line.
 */
export const PAY_LINK_PROMPT_VERSION = "pay_link.v1";

export interface PayLinkPromptInput {
  shopName: string;
  customerFirstName: string;
  vehicle: { year?: number; make?: string; model?: string };
  totalCents: number;
  payLinkUrl: string;
  aiTone: "plain" | "friendly";
}

export function buildPayLinkPrompt(input: PayLinkPromptInput): string {
  const veh = [input.vehicle.year, input.vehicle.make, input.vehicle.model]
    .filter(Boolean)
    .join(" ");
  const total = `$${(input.totalCents / 100).toFixed(2)}`;
  const toneNote =
    input.aiTone === "friendly"
      ? "Warm, neighborly, first-name basis. Use a single emoji at most."
      : "Plain, matter-of-fact, no emojis. Mechanic-to-customer.";

  return `
You are drafting an SMS from a small independent auto shop asking a customer to pay their bill.

TONE: ${toneNote}

SHOP: ${input.shopName}
CUSTOMER FIRST NAME: ${input.customerFirstName}
VEHICLE: ${veh || "(unspecified)"}
AMOUNT DUE: ${total}
PAY LINK: ${input.payLinkUrl}

WRITE the SMS body. Rules:
- 1–3 sentences total, under 320 chars.
- Open by addressing the customer by first name.
- State the amount due clearly.
- End with the pay link on its own line.
- Do NOT include a signature line — the shop name appears in the sender ID.
- Do NOT use markdown. Plain text only.

Return ONLY the SMS body. No preamble.
`.trim();
}

/**
 * Deterministic SMS template for a pay link — no AI call required.
 *
 * Default path on the Text Pay Link flow: the owner sees this immediately and
 * can hit "Polish with AI" inside the review modal to get the AI-translated
 * version.
 */
export function buildPayLinkTemplate(input: PayLinkPromptInput): string {
  const veh = [input.vehicle.year, input.vehicle.make, input.vehicle.model]
    .filter(Boolean)
    .join(" ");
  const total = `$${(input.totalCents / 100).toFixed(2)}`;
  const vehiclePart = veh ? ` for your ${veh}` : "";

  return [
    `Hi ${input.customerFirstName} — the bill${vehiclePart} comes to ${total}.`,
    "",
    `Pay here: ${input.payLinkUrl}`,
  ].join("\n");
}
