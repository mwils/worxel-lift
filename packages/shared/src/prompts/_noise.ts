/**
 * Shared preamble for any voice-extraction prompt where the audio was
 * captured in a noisy shop environment. Tells the model to drop background
 * chatter / radios / partial words and only emit fields the speaker
 * clearly stated.
 *
 * Used by all voice prompts that ingest in-the-bay dictation:
 *   - voiceCustomer
 *   - voiceVehicle
 *   - voiceConcern
 *   - voiceToRo (line items — same constraint applies)
 */
export function noisePreamble(subject: string): string {
  return [
    `The recording was captured in an active auto repair shop. It may`,
    `include background conversation, music, partial words, tool noise,`,
    `or other distractions. Extract ONLY values the speaker explicitly`,
    `stated to describe this ${subject}. Omit any field that wasn't clearly`,
    `stated. Never infer or invent values from context.`,
  ].join(" ");
}
