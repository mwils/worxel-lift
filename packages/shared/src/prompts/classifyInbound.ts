/**
 * Prompt template: classify an inbound customer SMS so we can decide
 * whether to auto-reply (status check, approval) or escalate to the owner.
 */
export const CLASSIFY_INBOUND_PROMPT_VERSION = "classify_inbound.v1";

export interface ClassifyInboundInput {
  body: string;
  hasOpenEstimate: boolean;
  hasActiveRo: boolean;
}

export function buildClassifyInboundPrompt(input: ClassifyInboundInput): string {
  return `
You classify an inbound SMS from a customer of an auto repair shop.

MESSAGE:
"""
${input.body}
"""

CONTEXT:
- Customer has an active repair order in the shop: ${input.hasActiveRo}
- Customer has a pending estimate awaiting approval: ${input.hasOpenEstimate}

Classify into exactly ONE category:
- "status_check" — asking about progress / ETA / "is my car ready"
- "approval" — affirmative reply to an estimate ("yes", "go ahead", "approved", "do it")
- "question" — substantive question requiring the shop owner's judgment
- "other" — anything else (chit-chat, off-topic, unclear)

Return ONLY a single JSON object: {"classification": "<one of the four>", "confidence": 0.0-1.0}
No prose, no markdown fences.
`.trim();
}
