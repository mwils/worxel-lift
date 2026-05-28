import { noisePreamble } from "./_noise.js";

export const VOICE_CONCERN_PROMPT_VERSION = "voice_concern.v1";

export interface VoiceConcernInput {
  transcript: string;
}

/**
 * Prompt: clean a noisy voice memo into a single-sentence customer-facing
 * concern. The speaker is the shop owner relaying what the customer said
 * was wrong with the car. Output drops the speaker's filler, fixes obvious
 * mishears, and reads naturally as something that would belong on an RO.
 */
export function buildVoiceConcernPrompt(input: VoiceConcernInput): string {
  return `
${noisePreamble("concern")}

The speaker is summarizing what the customer reported about their car.

TRANSCRIPT:
"""
${input.transcript}
"""

Return ONLY the cleaned concern as a single short sentence (under 200 chars).
- Plain text, no quotes, no markdown.
- Don't add a name, vehicle, or diagnosis — just the symptom the customer reported.
- Preserve the speaker's words where possible; don't editorialize.
- If nothing usable was said, return an empty string.

Return ONLY the sentence. No preamble.
`.trim();
}
