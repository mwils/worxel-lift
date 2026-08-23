/**
 * Prompt template: draft a blog post for the Lift marketing site, aimed at
 * "Mike" — the 1–3 bay owner-operator persona (docs/PERSONA.md). Drafts are
 * queued for human review; the admin edits or rejects before anything goes
 * live, but the prompt still carries the full guardrails so drafts arrive
 * close to publishable.
 */
export const BLOG_POST_PROMPT_VERSION = "blog_post.v1";

export interface BlogPostPromptInput {
  title: string;
  bucket: string;
  angle: string;
  /** Recent post titles, so the draft doesn't retread published ground. */
  existingTitles: string[];
}

export function buildBlogPostPrompt(input: BlogPostPromptInput): string {
  const existing =
    input.existingTitles.length > 0
      ? input.existingTitles.map((t) => `- ${t}`).join("\n")
      : "- (none yet)";

  return `
You write a blog post for Lift, a shop-management app for 1–3 bay independent auto repair shops.

READER:
An owner-operator, 35–55, wrenching 15+ years. He is the owner, the lead tech, the front
counter, and the bookkeeper all at once. No service advisor. He reads on his phone, between
jobs. He is smart, busy, allergic to corporate speak, and has been burned by software before.
You are NOT teaching him how to fix cars — he's better at that than you. You're helping him
run the business side.

TOPIC (write about exactly this — sharpen the title's phrasing if it helps, keep the subject):
Title: ${input.title}
Angle: ${input.angle}
Category: ${input.bucket}

RECENT POSTS (do not retread these):
${existing}

VOICE:
- Plain, blunt, shop-owner-to-shop-owner. Short sentences. Contractions always.
- Specific numbers beat adjectives — but ONLY real, defensible numbers (simple math the
  reader can verify, publicly known prices). Round numbers framed as examples are fine
  ("say your rate is $120/hr").
- "RO" is always written RO, never spelled out. "The bay", "wrench time" are natural.
- NEVER use: platform, solution, leverage, seamless, robust, unlock, supercharge, elevate,
  revolutionize, next-gen, game-changer, "in today's fast-paced world", "in conclusion".
- NEVER use the word "comeback" to mean a returning customer (in shop slang it means a
  warranty failure).
- No emoji. No exclamation-point enthusiasm.

HARD RULES:
- Do NOT invent statistics, studies, survey results, or industry percentages.
- Do NOT invent customer stories, shop anecdotes, testimonials, or named people.
  Hypotheticals must be clearly hypothetical ("say a customer...").
- Do NOT give legal or accounting advice as fact — frame compliance topics as general
  practice plus "check your state".
- Do NOT trash competitors. Public pricing may be referenced factually if the topic calls
  for it; no invented figures.
- At most ONE mention of Lift, near the end, one or two quiet sentences that connect the
  topic to what Lift does. No feature list, no hard sell. Zero mentions is acceptable.

STRUCTURE:
- 800–1200 words of markdown.
- Open with the reader's pain in the first two sentences — a moment he recognizes.
- Use ## section headings (no # H1 — the title is the H1). Short paragraphs, 1–3 sentences.
- If the topic is a script/template topic, give word-for-word copy in blockquotes he can
  steal directly.
- End with something he can do this week, not a summary.

Return ONLY a single JSON object:
{"title": "<final title, sentence case>", "metaDescription": "<search snippet, max 155 characters>", "bodyMarkdown": "<the full post body>"}
No prose, no markdown fences.
`.trim();
}
