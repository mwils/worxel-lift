# Lift — Email Campaign Brief

Everything an agent (or human marketer) needs to plan, write, and ship email campaigns for **Lift**, the shop management app for independent auto repair shops, currently live at **https://lift.worxel.com**.

---

## 1. Product in one line

Lift is a **mobile-first PWA** for **1–3 bay independent auto repair shops**: dead-simple repair orders, invoices, and customer status checks — **you run the whole shop from your phone. You talk, it service-writes.** Flat **$79/mo**, **14-day free trial**, no card required to start.

## 2. The main value proposition (lead with this)

Every competitor (Shopmonkey, AutoLeap, Tekmetric, Mitchell 1) is built for multi-bay shops with a service advisor and a front desk — big, desk-bound, typing-heavy. Lift is built for the owner-operator who is the tech, the SA, *and* the bookkeeper: **the whole shop runs from the phone in his pocket. He talks, it service-writes.**

- Say the job out loud — it becomes line items at your labor rate.
- Scan or say the VIN — the vehicle fills itself in.
- "Is it ready?" texts answer themselves off the real RO status.
- Estimate → invoice → paid, all by text link.

**Lead with simplicity and phone-first, prove it with the mechanisms above. Don't lead with feature parity.** The AI-answered status texts are the sharpest single demo of the you-talk-it-types promise — keep using the line:

> "While you were under a hood, Lift answered 4 texts."

---

## 3. Persona — "Mike, the owner-operator"

Use Mike as a north star for every email. If the line doesn't land for him, cut it.

| Trait | Detail |
|---|---|
| Role | Owner + lead tech + service advisor (he's all three) |
| Shop size | 1–3 bays, no dedicated SA, sometimes 1 part-time tech |
| Revenue | <$1M/yr |
| Age | 35–55, has been wrenching for 15+ years |
| Tech comfort | Smartphone-fluent, paperwork-averse |
| Where he works | On the floor, hands dirty, phone in pocket |
| Biggest daily pain | Customers texting "is my car ready" 8x/day, breaking flow |
| Other pains | Quotes on scrap paper, lost ROs, no card-on-file, fights with QuickBooks |
| What he's tried | Shopmonkey trial — quit because "90% of it I'll never use and it costs $400/mo" |
| What he fears | Wasted weekend on setup; customers thinking AI texts are weird; data lock-in |
| What gets him excited | More wrench time, less phone time, getting paid faster |

### Anti-persona (DO NOT write for these people)

- Multi-location operators
- Shops with a dedicated service advisor
- Fleet/B2B-heavy shops
- Specialty shops (trans-only, tires, body)
- Anyone >$1M/yr revenue

Saying no to these in the copy is a positioning *feature*, not a hole — it builds trust with Mike that the product is for him.

---

## 4. Brand voice & tone

- **Plain. Blunt. Mechanic-shop direct.** No SaaS jargon ("synergy", "platform", "solution suite"). No emojis unless explicitly approved.
- Talk like a co-worker who's done time in the bay, not a marketing team in San Francisco.
- Short sentences. Active voice. Specific numbers (`$284`, `10 minutes`, `4 texts`) beat adjectives.
- Acknowledge the user's intelligence: don't oversell, don't fake urgency, don't drop fake testimonials.
- Use contractions ("don't", "we'll", "it's").
- Title case sparingly. Sentence case for most subjects/headlines.

**Phrases that fit:** "stay in the bay", "stop drowning in texts", "you approve every word", "no per-tech fees", "10-minute setup", "one-tap approval".

**Phrases to avoid:** "revolutionize", "next-gen", "powerful", "robust", "seamless", "unlock", "supercharge", "elevate", "Auto Repair 2.0".

---

## 5. Core value props (rank order)

1. **Run the whole shop from your phone. You talk, it service-writes.** Dead-simple ROs and invoices: say the job out loud and AI turns it into line items at your rate; scan the VIN and the vehicle fills itself in; snap photos straight onto the RO.
2. **Customer status checks handle themselves.** Auto-replies to "is it ready?" texts off the real RO status in under 10 seconds. Every other message is AI-drafted for one-tap send — you approve every word.
3. **10-minute setup.** Three screens: shop info → test SMS → trial start.
4. **$79/mo flat.** Unlimited techs, ROs, SMS. No add-ons, no overages.
5. **Get paid faster.** Pay links in SMS. Card-on-file with pre-auth. Cars get picked up, payment is already done.
6. **You own your data.** One-click CSV export of customers, vehicles, ROs, messages, payments — anytime.

---

## 6. Anti-features (the "we don't do this" list)

Saying these out loud in emails (especially the cold + trial-start emails) wins Mike's trust:

- No multi-location support.
- No tech time-clock / payroll.
- No real calendar (day-view only).
- No fleet/B2B account billing.
- No native QuickBooks sync yet — CSV export today, native sync **2026**.
- No native iOS/Android — it's a PWA you install from the browser.

Frame these as **focus**, not gaps: *"You don't need 90% of what Shopmonkey ships. You need to stop drowning in texts. That's all Lift does — well."*

---

## 7. Top objections (handle proactively in nurture emails)

| Objection | Counter |
|---|---|
| "Will I waste my weekend setting it up?" | 10-minute onboarding, three screens, AI drafts your first estimate the same afternoon. |
| "Will customers hate AI texts?" | You approve every word before send. Auto-replies are *only* status checks — and you can switch them off. |
| "Will my data be locked in?" | One-click CSV export, always. Customers, vehicles, ROs, messages, payments. |
| "What about QuickBooks?" | CSV export in QB-import format today. Native sync 2026. |
| "Why not Shopmonkey?" | Built for bigger shops. You don't need 90% of what they ship. Lift is the simple version — the whole shop from your phone, you talk, it service-writes — at $79 flat. |
| "Is AI going to make my shop look unprofessional?" | The AI rewrites mechanic-speak into plain English. Customers get clearer estimates. Mike still hits send. |

---

## 8. Pricing & offer

- **$79/mo** flat.
- **14-day free trial.**
- **No credit card required to start the trial.**
- Unlimited: techs, ROs, customers, SMS, photos.
- Card-on-file payments via Stripe (separate from Lift's $79 — these are *Mike's customers* paying *Mike*).

When writing pricing copy, always pair the price with what's *not* charged extra ("no per-tech fees, no per-message fees, no per-RO fees"). Owner-operators in this segment have been burned by per-seat SaaS.

---

## 9. URLs & CTAs

| Purpose | URL |
|---|---|
| Marketing site / landing page | `https://lift.worxel.com` |
| Pricing section anchor | `https://lift.worxel.com/#pricing` |
| Features section anchor | `https://lift.worxel.com/#features` |
| FAQ section anchor | `https://lift.worxel.com/#faq` |
| App login | `https://lift-app.worxel.com/login` |
| Start free trial (primary CTA) | `https://lift-app.worxel.com/login` (login → magic link → onboarding) |
| Support / from address | `lift@worxel.com` (alias, forwards to Matthew) |
| Status page (link in footer) | not yet live — omit until launched |

> Note: production marketing copy on the landing page still references `lift.com` and `hello@lift.com` — those are aspirational. The live host is `lift.worxel.com` and the real contact address is **`lift@worxel.com`**. Use both of these in email copy until the apex `lift.com` switches over.

**Primary CTA wording (rotate sparingly):**
- "Start your 14-day trial"
- "Try Lift free for 14 days"
- "Stop drowning in texts — start your trial"

Avoid: "Click here", "Learn more", "Get started today!"

---

## 10. Visual identity

The landing page (`apps/marketing/src/Landing.tsx`) uses a **"Service Manual"** aesthetic — 1970s Haynes repair manual crossed with garage signage and editorial magazine. Cold email should match this visual language so the transition from inbox to landing page feels like one brand, not two.

- **Logo / wordmark:** plain **"LIFT"** wordmark set in Archivo Black, all caps, tight negative letter-spacing (`-0.02em`). No bolt icon, no enclosing square — the previous `IconBolt` motif has been retired.
- **Palette ("Service Counter"):**
  - Background: newsprint cream `#f4eedf` (and a slightly aged shade `#ecdfca` for alternating section bands)
  - Ink (text and rules): warm black `#1a1714` (never pure `#000`)
  - Soft ink (dimmed text): `#605849`
  - Hairline / faint ink: `#8c8270`
  - Spot accent — **Snap-On enamel red** `#c8261d` for primary CTAs, highlighted words, and "AI" markers
  - Stamp blue `#1e3a6b` for secondary editorial accents (used sparingly)
- **Type:**
  - Display / headlines: **Archivo Black** (Google Fonts), all caps, tight `letter-spacing: -0.02em`
  - Body / editorial: **Spectral** (Google Fonts), regular + italic for pull quotes
  - Technical / labels / section numbers / specs: **Space Mono** (Google Fonts), uppercase, `letter-spacing: 0.15em–0.2em`
  - Email fallback: most email clients don't honor webfonts reliably. Spec: `font-family: 'Archivo Black', 'Helvetica Neue', Helvetica, Arial, sans-serif` for headers and `font-family: Spectral, Georgia, 'Times New Roman', serif` for body — clients that support webfonts will get them; the rest fall back gracefully.
- **Layout cues to reuse in email:**
  - Numbered mono section labels: `§ 01 / THE WEDGE`, `§ 02 / THE PERSONA`
  - Hairline horizontal rules (1px ink) between sections
  - Hard, square corners — `border-radius: 0` everywhere. No pills, no rounded cards.
  - CTAs: solid `#c8261d` background, paper-cream text, square corners, hard 4px offset shadow in ink black, mono uppercase label
  - Optional "printer's registration crosshair" (+) marks at card corners for emphasis (decorative only)
- **Imagery:** phone mockups of SMS threads outperform stock shop photos. If you need a shop photo, prefer a single-bay independent garage with one car on a lift — *not* a 10-bay dealership service drive. Halftone-dot textures are on-brand; gradients and glow effects are not.
- **Tone of UI screenshots:** show the AiDraftSheet with editable text and a "Send" button; show inbound SMS auto-reply tagged "Auto-replied · status check". Auto-reply bubbles get a red 1px border to mark AI-touched messages — preserve that convention.

---

## 11. Audience segments & lifecycle emails

Plan around these segments. Each gets its own campaign.

### a) Cold outbound (acquired list — independent shop owners)
- Goal: get them to read 2 sentences and click to the landing page.
- Tone: blunt, problem-first ("How many times did a customer text you today?").
- Subject lines should reference *their* day, not Lift's features.

### b) Trial signup — Day 0 (welcome)
- Confirm magic-link login, link to the app.
- Tell them what to do *first*: create a customer, add a vehicle, send their first AI-drafted estimate.
- Set the expectation: "You'll be sending your first AI estimate this afternoon."

### c) Trial Day 2 — activation nudge
- Trigger when shop is created but no RO sent yet.
- One specific next step + the value behind it.

### d) Trial Day 7 — midpoint
- Highlight the auto-reply feature (most owners haven't seen it fire until they get a real inbound text).
- Show a screenshot of an actual auto-reply they sent.

### e) Trial Day 12 — conversion
- "Two days left." Soft, factual. Mention card-on-file is set up via Stripe portal in one click.
- Address the data-export fear directly ("you can take your data with you anytime, even if you cancel").

### f) Trial expired — win-back (Day 14 + 7)
- One email. Ask what didn't fit. Short.

### g) Paying customer — monthly product update
- One feature ship + one mechanic-shop tip. Keep it under 200 words.
- Never bury the unsubscribe.

### h) Churned — quarterly resurrection
- New features only. No discounts (we don't discount — it would erode the "no surprises" promise).

---

## 12. Subject-line patterns that fit the voice

- "While you were under a hood, Lift answered 4 texts"
- "Stop fielding 'is my car ready' calls"
- "Your shop, your phone, your AI service advisor"
- "10 minutes to set up. Done by lunch."
- "$79/mo. That's it. No per-tech games."
- "Two days left on your Lift trial"

Avoid clickbait, emojis (unless explicitly approved later), and ALL CAPS. Keep under 50 characters where possible — Mike reads on his phone.

---

## 13. Compliance & deliverability

- **From address:** `lift@worxel.com` (alias forwarding to Matthew; SES-verified). Display name guidance:
  - Cold + lifecycle / system emails: `Lift <lift@worxel.com>`
  - Nurture / personal-touch emails: `Matthew at Lift <lift@worxel.com>` (branded address, human voice — only use a real person's name, never a fabricated persona).
- **Reply-to:** must be a monitored inbox. Use `lift@worxel.com`.
- **CAN-SPAM:** every email needs a postal address in the footer + a one-click unsubscribe link.
- **Trial expiration + billing emails are transactional** — they don't need unsubscribe (but should still be respectful).
- **GDPR:** Lift isn't actively marketing in the EU. If a list contains EU contacts, require explicit opt-in.
- **TCPA does not apply to email** but Lift's product *does* handle SMS; never imply in marketing email that we'll text the recipient without separate explicit consent.
- **SES sandbox** — confirm the sending account is out of sandbox before sending to a list. In sandbox, you can only send to verified addresses.
- Use a single unique tracking domain (e.g. `links.lift.worxel.com` once configured); do not use bare-link tracking from a different domain than the brand.

---

## 14. Competitive landscape (for positioning, not for direct comparison ads)

| Competitor | Price | Why Mike rejects them |
|---|---|---|
| Shopmonkey | $400+/mo | Built for bigger shops. 90% unused features. Per-user pricing. |
| AutoLeap | $200+/mo + per-user | Same — sales-led, not self-serve. |
| Tekmetric | $200+/mo | Solid but assumes a dedicated SA workflow. |
| Mitchell 1 / Manager SE | $150+/mo desktop | Desktop-bound, dated UX, expensive add-ons. |
| Pen + paper + texts | $0 | Free but loses Mike 1–2 hours/day on customer comms. |

**Don't name competitors in cold acquisition emails.** Reserve direct comparison for the FAQ + sales-assist replies when a prospect asks.

---

## 15. Proof points & social proof

The product is **pre-launch / early beta**. There are **no real customer testimonials yet** — do not fabricate them. Until real testimonials exist:

- Use **specific product mechanics** as the proof ("AI classifies inbound SMS in <2s using Claude Haiku 4.5; auto-reply sent in under 10s").
- Use **process clarity** as proof ("you approve every word", "one-click data export").
- Use **price clarity** as proof ("$79 flat — no per-tech fees, no per-message fees").

Once real customers exist, add a `### Testimonials` section here and reference quotes from real Mikes only.

---

## 16. Glossary — terms to use correctly

- **RO** — Repair Order. Always all-caps. Never spell out unless writing for someone unfamiliar with shops (in which case, you're talking to the wrong audience).
- **Bay** — one stall in the shop. "1–3 bay" is the segment.
- **SA** — Service Advisor. The person who'd normally do customer comms. Mike doesn't have one.
- **10DLC** — the SMS provisioning regime for branded business texting. Mention only in onboarding/support copy, not marketing.
- **Estimate** — quote sent to customer. In Lift, estimates are SMS with a tap-to-approve link.
- **Trial** — 14 days, no card. Use "free trial" or "14-day trial" — not "free demo" (we have no demos).

---

## 17. Reference files in this repo

If you need product detail beyond this brief:

- `docs/PLAN.md` — full v1 product plan (features, scope, what's deferred).
- `apps/marketing/src/Landing.tsx` — current landing-page copy and section structure.
- `apps/marketing/src/theme.ts` — exact brand color tokens.
- `sst.config.ts` — production domain configuration (current truth: `lift.worxel.com`, `lift-app.worxel.com`, `api-lift.worxel.com`).
- `CLAUDE.md` — repo-level engineering conventions (not needed for email work, but useful if you're generating links or asset paths).

---

## 18. Quick checklist before sending any campaign

- [ ] Subject line under 50 characters and written for Mike, not for Lift.
- [ ] First line is a problem, not a feature.
- [ ] One CTA. Primary CTA goes to `https://lift-app.worxel.com/login` (trial) or `https://lift.worxel.com` (info).
- [ ] No fabricated testimonials, logos, or stats.
- [ ] Plain text version included.
- [ ] Unsubscribe + physical address in footer (CAN-SPAM).
- [ ] From `lift@worxel.com`, reply-to monitored.
- [ ] Tested on mobile first (Mike reads on his phone, in the bay).
- [ ] No emoji (unless explicitly approved).
- [ ] Numbers are specific: `$79`, `14 days`, `10 minutes`, `1–3 bays`.
