import { noisePreamble } from "./_noise.js";

export const VOICE_VEHICLE_PROMPT_VERSION = "voice_vehicle.v1";

export interface VoiceVehicleInput {
  transcript: string;
}

/**
 * Prompt: turn a noisy in-the-bay voice memo into structured vehicle fields.
 * Owner says e.g. "2019 F-150, VIN one-F-T-F-W-..., plate ABC-1234, 87,000
 * miles, dark blue" and we extract year/make/model/trim/vin/plate/mileage/color.
 *
 * VIN may be spelled phonetically (alpha-bravo) or one-character-at-a-time;
 * keep the speaker's literal characters — downstream validation enforces
 * the 17-char length.
 */
export function buildVoiceVehiclePrompt(input: VoiceVehicleInput): string {
  return `
${noisePreamble("vehicle")}

TRANSCRIPT:
"""
${input.transcript}
"""

Return ONLY a JSON object with this shape (omit any field the speaker
didn't clearly state):
{
  "vin": "<17-char string if spoken, alphanumeric only — strip dashes/spaces>",
  "year": <number>,
  "make": "<string, capitalized>",
  "model": "<string, capitalized>",
  "trim": "<string>",
  "mileage": <number — integer miles, no commas>,
  "plate": "<string, uppercase, no spaces>",
  "color": "<string, lowercase>",
  "notes": "<anything else about the vehicle worth recording>"
}

Rules:
- If the speaker said the VIN phonetically (e.g. "alpha bravo charlie"), translate to letters A B C.
- If they said it one digit at a time, concatenate without dashes or spaces.
- Do NOT include customer or concern details in notes.
- No prose, no markdown fences. JSON only.
`.trim();
}
