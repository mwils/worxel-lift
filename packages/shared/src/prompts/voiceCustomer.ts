import { noisePreamble } from "./_noise.js";

export const VOICE_CUSTOMER_PROMPT_VERSION = "voice_customer.v1";

export interface VoiceCustomerInput {
  transcript: string;
}

/**
 * Prompt: turn a noisy in-the-bay voice memo into a structured customer
 * record. Owner says e.g. "Add Matthew Wilson, phone 555-0142, drives a..."
 * and we want firstName, lastName, phone, email, notes extracted.
 *
 * The phone is returned as-spoken; the e164 Zod transform on the DTO
 * boundary will normalize and validate it.
 */
export function buildVoiceCustomerPrompt(input: VoiceCustomerInput): string {
  return `
${noisePreamble("customer")}

TRANSCRIPT:
"""
${input.transcript}
"""

Return ONLY a JSON object with this shape (omit any field the speaker
didn't clearly state):
{
  "firstName": "<string>",
  "lastName": "<string>",
  "phone": "<string as spoken — digits + separators are fine>",
  "email": "<string>",
  "notes": "<string — anything noteworthy the speaker mentioned about the customer that isn't another field>"
}

Rules:
- If the speaker only said a single name, put it in firstName.
- Do NOT include "vehicle" or "concern" details in notes — those go elsewhere.
- No prose, no markdown fences. JSON only.
`.trim();
}
