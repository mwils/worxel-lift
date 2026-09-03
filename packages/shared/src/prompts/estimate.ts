/**
 * Prompt template: draft a customer-facing SMS estimate from RO line items.
 *
 * v2 split the job in two so the model can't drop or mangle the money:
 *   - the MODEL writes only the plain-English opener (1–2 sentences) that
 *     translates the line items for the customer;
 *   - the CODE (`assemblePolishedEstimate`) appends the itemized lines with
 *     prices, the total and the "Approve: <link>" line verbatim.
 *
 * QA 2026-09-03 M1: v1 let the model write the whole SMS. It invented a
 * symptom ("to fix the noise") on an RO with no concern, dropped the
 * itemized prices and lost the "Approve:" label before the link.
 */
export const ESTIMATE_PROMPT_VERSION = "estimate.v2";

export interface EstimatePromptInput {
  shopName: string;
  customerFirstName: string;
  vehicle: { year?: number; make?: string; model?: string };
  lineItems: Array<{ kind: "labor" | "part" | "fee"; description: string; total: number }>;
  totalCents: number;
  approveLinkUrl: string;
  aiTone: "plain" | "friendly";
  /** The customer's stated concern on the RO, if any. Never inferred. */
  concern?: string;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function vehicleLabel(input: EstimatePromptInput): string {
  return [input.vehicle.year, input.vehicle.make, input.vehicle.model].filter(Boolean).join(" ");
}

/**
 * The deterministic tail of every estimate SMS: itemized lines with prices,
 * the total, and the approve link. Shared by the template and the AI path so
 * the customer sees the exact same numbers either way.
 */
function estimateBody(input: EstimatePromptInput): string {
  const lines = input.lineItems
    .map((li) => `• ${li.description} — ${money(li.total)}`)
    .join("\n");
  return [lines, "", `Total: ${money(input.totalCents)}`, "", `Approve: ${input.approveLinkUrl}`].join(
    "\n"
  );
}

export function buildEstimatePrompt(input: EstimatePromptInput): string {
  const veh = vehicleLabel(input);
  const lines = input.lineItems
    .map((li) => `- [${li.kind}] ${li.description} (${money(li.total)})`)
    .join("\n");
  const concern = input.concern?.trim();
  const toneNote =
    input.aiTone === "friendly"
      ? "Warm, neighborly, first-name basis. Use a single emoji at most."
      : "Plain, matter-of-fact, no emojis. Mechanic-to-customer.";

  return `
You are writing the OPENING of an SMS estimate from a small independent auto shop to a customer.
The app appends the itemized work with prices, the total and the approve link after your text — you write ONLY the opener.

TONE: ${toneNote}

SHOP: ${input.shopName}
CUSTOMER FIRST NAME: ${input.customerFirstName}
VEHICLE: ${veh || "(unspecified)"}
CUSTOMER'S STATED CONCERN: ${concern ? `"${concern}"` : "(none — the customer did not report a problem)"}
WORK PROPOSED:
${lines}
TOTAL: ${money(input.totalCents)}

WRITE the opener. Rules:
- 1–2 sentences, under 200 characters total.
- Open by addressing the customer by first name${veh ? " and name the vehicle" : ""}.
- Say in plain English what the shop is recommending. Translate jargon (e.g. "resurface rotors" → "smooth the brake discs").
- Describe ONLY the work listed under WORK PROPOSED. Do NOT add symptoms, noises, causes, diagnoses, safety warnings, promises, guarantees or outcomes ("to fix the noise", "so it runs smoothly") that are not written above.
- If the concern is "(none)", do not mention any problem or symptom at all. If a concern is given, you may refer to it using the customer's own words.
- Do NOT list prices, the total, a link, or the word "Approve" — the app adds those.
- Do NOT include a signature line — the shop name appears in the sender ID.
- Do NOT use markdown or bullet points. Plain text only.

Return ONLY the opener sentences. No preamble, no quotes.
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
  const veh = vehicleLabel(input);
  const vehiclePart = veh ? ` for your ${veh}` : "";
  return [`Hi ${input.customerFirstName} — here's the estimate${vehiclePart}:`, "", estimateBody(input)].join(
    "\n"
  );
}

/**
 * Cheap post-check: an estimate SMS must carry the total and the approve link.
 * Exported so callers can guard any owner-edited override the same way.
 */
export function estimateSmsHasRequiredParts(sms: string, input: EstimatePromptInput): boolean {
  return sms.includes(money(input.totalCents)) && sms.includes(input.approveLinkUrl);
}

export interface AssembledEstimate {
  sms: string;
  /** true when the model output was unusable and the template was used instead. */
  usedFallback: boolean;
}

/**
 * Turn the model's opener into the final SMS by appending the deterministic
 * itemized block. Scrubs anything the model wasn't supposed to write (prices,
 * the link, bullets, an "Approve"/"Total" line) so nothing is duplicated, and
 * falls back to the plain template when the opener is empty, too long, or the
 * assembled result is somehow missing the total or link.
 */
export function assemblePolishedEstimate(
  input: EstimatePromptInput,
  modelText: string
): AssembledEstimate {
  const fallback = { sms: buildEstimateTemplate(input), usedFallback: true };

  const opener = modelText
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    // Drop any line the model wrote that belongs to the deterministic block.
    .filter((l) => !/^[•\-*]\s/.test(l))
    .filter((l) => !/\$\d/.test(l))
    .filter((l) => !/https?:\/\//i.test(l))
    .filter((l) => !/^(total|approve)\b/i.test(l))
    .join(" ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (opener.length < 10 || opener.length > 320) return fallback;

  const sms = [opener, "", estimateBody(input)].join("\n");
  if (!estimateSmsHasRequiredParts(sms, input)) return fallback;
  return { sms, usedFallback: false };
}
