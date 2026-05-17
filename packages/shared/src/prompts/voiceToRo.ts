/**
 * Prompt template: structure a transcribed voice note from the bay into
 * a draft RO concern + suggested line items.
 *
 * Caller provides the transcription (from Bedrock audio Claude OR Amazon
 * Transcribe). This prompt structures the result.
 */
export const VOICE_TO_RO_PROMPT_VERSION = "voice_to_ro.v1";

export interface VoiceToRoInput {
  transcript: string;
  vehicle?: { year?: number; make?: string; model?: string };
  defaultLaborRateCents?: number;
}

export function buildVoiceToRoPrompt(input: VoiceToRoInput): string {
  const veh = input.vehicle
    ? [input.vehicle.year, input.vehicle.make, input.vehicle.model].filter(Boolean).join(" ")
    : "";
  const rate = input.defaultLaborRateCents ?? 12000;
  return `
The owner of a small auto shop is narrating a diagnosis from the bay.
Extract a structured repair order draft.

VEHICLE: ${veh || "(unspecified)"}
DEFAULT LABOR RATE (cents/hr): ${rate}

TRANSCRIPT:
"""
${input.transcript}
"""

Return ONLY a JSON object with this shape:
{
  "concern": "<one-sentence customer-facing concern>",
  "diagnosis": "<one-sentence technical diagnosis>",
  "lineItems": [
    {
      "kind": "labor" | "part" | "fee",
      "description": "<short description>",
      "hours": <number, only for labor>,
      "rate": <cents/hr, only for labor; default to ${rate}>,
      "qty": <number, only for part/fee>,
      "unitPrice": <cents, only for part/fee>,
      "total": <cents>
    }
  ]
}

Rules:
- Be conservative. Only add line items the owner clearly described.
- If the owner mentions a part with no price, set unitPrice to null and total to null and the owner will fill in.
- "total" for labor = round(hours * rate).
- No prose, no markdown fences.
`.trim();
}
