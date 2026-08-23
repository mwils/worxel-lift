/**
 * Curated topic bank for the AI-generated blog (docs/PLAN + PERSONA-driven).
 *
 * The generation cron draws from this list in bucket rotation and never
 * invents its own topics — human-curated titles are the first quality gate,
 * the admin edit/reject queue is the second. Add topics by commit; when the
 * bank is exhausted the cron logs a warning and stops generating.
 *
 * A topicKey is consumed once a BlogPost exists with it (any status).
 */

export const BLOG_BUCKETS = [
  "shop_ops",
  "communication",
  "buying_seo",
  "business",
  "compliance",
] as const;
export type BlogBucket = (typeof BLOG_BUCKETS)[number];

/**
 * Bucket rotation the generator walks (repeating). Compliance appears once
 * per two full passes — sprinkle, not a pillar.
 */
export const BLOG_BUCKET_ROTATION: BlogBucket[] = [
  "shop_ops",
  "communication",
  "buying_seo",
  "business",
  "shop_ops",
  "communication",
  "buying_seo",
  "business",
  "compliance",
];

export interface BlogTopic {
  /** Stable id — referenced by BlogPost.topicKey. Never rename a used key. */
  key: string;
  bucket: BlogBucket;
  /** Working title; the model may sharpen phrasing but not change the subject. */
  title: string;
  /** Editorial angle handed to the prompt. */
  angle: string;
}

export const BLOG_TOPICS: BlogTopic[] = [
  // ── shop_ops — fixes for Mike's exact daily pains ─────────────
  {
    key: "ops-scrap-paper-quotes",
    bucket: "shop_ops",
    title: "How to stop losing quotes written on scrap paper",
    angle:
      "The yellow legal pad always disappears. A dead-simple system (paper or phone) for writing a quote once and never re-quoting from memory.",
  },
  {
    key: "ops-card-on-file-policy",
    bucket: "shop_ops",
    title: "A card-on-file policy that doesn't annoy your regulars",
    angle:
      "How to ask for a card up front without making good customers feel distrusted. Exact wording to use at drop-off.",
  },
  {
    key: "ops-forgotten-followup",
    bucket: "shop_ops",
    title: "The $400 repair you forgot to follow up on",
    angle:
      "Declined-estimate follow-up is the cheapest revenue in the shop. A two-touch follow-up habit that takes five minutes a week.",
  },
  {
    key: "ops-photo-evidence",
    bucket: "shop_ops",
    title: "Photo evidence that ends 'you scratched my car' disputes",
    angle:
      "Walk-around photos at drop-off, damage photos during the job, where to keep them so they're findable six months later.",
  },
  {
    key: "ops-part-timer-pricing",
    bucket: "shop_ops",
    title: "Keeping pricing consistent when you hire your first part-timer",
    angle:
      "Quoted $380 last month, part-timer quotes $460 this month — trust damage. Saved jobs / a one-page price sheet as the fix.",
  },
  {
    key: "ops-ready-cars-sitting",
    bucket: "shop_ops",
    title: "Cars that sit for days after they're done (and what it costs you)",
    angle:
      "A finished car in the lot blocks a bay's worth of throughput and invites lot damage. Pickup nudges that actually get cars gone.",
  },
  {
    key: "ops-530-text-pile",
    bucket: "shop_ops",
    title: "The 5:30 text pile: digging out without working nights",
    angle:
      "Eleven unread customer texts at close. Triage rules: what needs an answer tonight, what waits, what should never have interrupted you.",
  },
  {
    key: "ops-no-calendar-mondays",
    bucket: "shop_ops",
    title: "Double-booked Mondays without hiring a front desk",
    angle:
      "Owner-operators don't need a scheduling system, they need a day-view and honest lead times. Simple rules for taking appointments solo.",
  },
  {
    key: "ops-estimate-ghosting",
    bucket: "shop_ops",
    title: "When a customer ghosts your estimate",
    angle:
      "They asked for the number and vanished. Why it happens (sticker shock, comparison shopping, life), and the low-pressure re-contact that wins some back.",
  },
  {
    key: "ops-lot-storage",
    bucket: "shop_ops",
    title: "Your lot is not free storage: dealing with abandoned cars",
    angle:
      "The Corolla that's been there since March. Prevention (pickup deadlines in writing), and the escalation path when prevention fails. General guidance, laws vary by state.",
  },

  // ── communication — scripts and templates ─────────────────────
  {
    key: "comm-estimate-texts",
    bucket: "communication",
    title: "5 estimate texts that get same-day approvals (steal these)",
    angle:
      "Word-for-word templates: plain-English problem, the number, one clear question. Why paragraph-long estimates never get answered.",
  },
  {
    key: "comm-bad-news-text",
    bucket: "communication",
    title: "How to text bad news without losing the customer",
    angle:
      "The head-gasket call nobody wants to make. Lead with what they should do, not the diagnosis. Scripts for 'it's worse than we thought.'",
  },
  {
    key: "comm-paid-before-pickup",
    bucket: "communication",
    title: "The pickup text that gets you paid before the keys change hands",
    angle:
      "'She's ready' + a pay link beats the awkward counter moment. Exact wording, and how to introduce it to longtime customers.",
  },
  {
    key: "comm-found-more",
    bucket: "communication",
    title: "The 'found more while we were in there' text",
    angle:
      "Upsell without sounding like an upsell: photo, plain description, price, 'no pressure either way.' What kills trust in this moment.",
  },
  {
    key: "comm-decline-followup",
    bucket: "communication",
    title: "They said no to the repair. Here's the follow-up that wins them back",
    angle:
      "A declined brake job is a future brake job. The 30-day check-in text that doesn't guilt-trip.",
  },
  {
    key: "comm-noshow-rebook",
    bucket: "communication",
    title: "The no-show rebooking text (that doesn't sound annoyed)",
    angle:
      "People forget. A friendly same-day rebook message, and when to stop chasing.",
  },
  {
    key: "comm-review-ask",
    bucket: "communication",
    title: "Asking for a Google review without groveling",
    angle:
      "One text, sent at the right moment (right after a thank-you), with the direct link. What never to do: incentives, mass blasts, review gating.",
  },
  {
    key: "comm-done-not-picked-up",
    bucket: "communication",
    title: "The gentle nudge for a car that's done but not picked up",
    angle:
      "Day 1, day 3, day 7 nudge wording that stays friendly while making the deadline real.",
  },

  // ── buying_seo — what Mike types into Google when it hurts ────
  {
    key: "seo-shopmonkey-alternatives",
    bucket: "buying_seo",
    title: "Shopmonkey alternatives for a 1–3 bay shop (2026)",
    angle:
      "Honest comparison for the shop that looked at $400+/mo and walked. What a small shop actually uses vs. what big platforms ship. May mention public pricing only; no invented figures.",
  },
  {
    key: "seo-one-man-shop-software",
    bucket: "buying_seo",
    title: "Shop management software for a one-man shop: what you actually need",
    angle:
      "The five jobs software must do for an owner-operator (quotes, texts, photos, payment, records) and the ten features he'll never open.",
  },
  {
    key: "seo-texts-without-advisor",
    bucket: "buying_seo",
    title: "How to handle customer texts at a repair shop without a service advisor",
    angle:
      "The interruption math (each text costs more than the 20 seconds it takes), triage rules, and where automation honestly helps vs. hurts.",
  },
  {
    key: "seo-estimates-by-text",
    bucket: "buying_seo",
    title: "Sending car repair estimates by text: the right way",
    angle:
      "Why texted estimates get approved faster than phone tag, what a good one contains, and getting written approval for your records.",
  },
  {
    key: "seo-need-software-at-all",
    bucket: "buying_seo",
    title: "Does a small auto repair shop even need shop software? An honest answer",
    angle:
      "Sometimes no. When pen and paper genuinely works, the three signals it's costing real money, and what to try before paying for anything.",
  },
  {
    key: "seo-dvi-small-shop",
    bucket: "buying_seo",
    title: "Digital vehicle inspections for a small shop, without the enterprise price tag",
    angle:
      "Photo-based inspections build trust and sell legitimate work. What a 2-bay version looks like vs. the 50-point dealership theater.",
  },
  {
    key: "seo-get-paid-before-pickup",
    bucket: "buying_seo",
    title: "Getting paid before pickup: options for small shops compared",
    angle:
      "Pay links, card-on-file, deposits — the mechanics, the card fees, and what customers tolerate. Plain math, public rates only.",
  },
  {
    key: "seo-paper-to-phone",
    bucket: "buying_seo",
    title: "Moving your shop from paper to phone without losing a weekend",
    angle:
      "The migration fear is the real blocker. What to move first (new jobs, not history), what to never migrate, a one-afternoon plan.",
  },

  // ── business — the money side nobody taught at trade school ───
  {
    key: "biz-labor-rate-math",
    bucket: "business",
    title: "Your labor rate: the 10-minute math check",
    angle:
      "Bay cost, tech cost, unbillable hours — a simple worksheet-style walkthrough. No invented benchmark rates; teach the math, not a number.",
  },
  {
    key: "biz-charging-diag",
    bucket: "business",
    title: "Charging for diag time without the argument",
    angle:
      "'You just plugged in a scanner' — how to price diagnosis, explain it up front, and roll it into the repair when they approve.",
  },
  {
    key: "biz-quickbooks-sunday",
    bucket: "business",
    title: "Getting QuickBooks Sunday under 30 minutes",
    angle:
      "The dread is from batching a week of entry. Small habits (daily 5-minute close-out, clean categories, exports) that shrink it.",
  },
  {
    key: "biz-fire-a-customer",
    bucket: "business",
    title: "When to fire a customer (and how to do it politely)",
    angle:
      "The chronic complainer, the never-pays, the parts-supplier. The math on what they cost, and a script for the goodbye.",
  },
  {
    key: "biz-parts-markup",
    bucket: "business",
    title: "Parts markup without apologizing for it",
    angle:
      "Why markup is warranty risk + sourcing time + capital, not greed. Handling 'I can get it cheaper on RockAuto.'",
  },
  {
    key: "biz-warranty-policy",
    bucket: "business",
    title: "A warranty policy that protects you and the customer",
    angle:
      "Parts vs. labor coverage, putting it in writing, and how a clear policy turns a warranty claim from a fight into a process. (Never use the word 'comeback' for repeat customers — in shop slang it means a warranty failure.)",
  },
  {
    key: "biz-slow-season",
    bucket: "business",
    title: "Slow-season cash flow for a small shop",
    angle:
      "The January dip is predictable, so plan for it: reminders to overdue regulars, maintenance pushes, and cutting the right costs (not the wrong ones).",
  },
  {
    key: "biz-part-timer-cost",
    bucket: "business",
    title: "What a part-time tech actually costs (and when hiring pays off)",
    angle:
      "Wage is half the number: payroll tax, insurance, supervision time, redo risk. The utilization question to answer before hiring.",
  },

  // ── compliance — light, practical, only where it touches him ──
  {
    key: "compliance-texting-opt-in",
    bucket: "compliance",
    title: "Texting customers legally: the two-sentence opt-in that covers you",
    angle:
      "Plain-English TCPA basics for a shop: get consent at drop-off, honor STOP, keep a record. Not legal advice; keep it practical.",
  },
  {
    key: "compliance-card-data",
    bucket: "compliance",
    title: "Keep card numbers out of your text messages",
    angle:
      "Customers will text you a card photo if you let them. Why that's a problem (PCI, theft, your liability) and the safe alternatives.",
  },
  {
    key: "compliance-written-estimates",
    bucket: "compliance",
    title: "Written estimates: what most states expect from a shop",
    angle:
      "General patterns (authorization before work, threshold amounts, keeping records) with a clear 'check your state' framing. Not legal advice.",
  },
];
