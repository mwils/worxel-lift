# Lift — Persona: "Mike, the owner-operator"

This is the canonical persona for Lift. Use it as the north star for **every** product, design, marketing, and support decision. If a feature or a line of copy doesn't land for Mike, cut it.

Related documents:
- `docs/PLAN.md` — full v1 product plan (Mike's success metric is in §1)
- `docs/EMAIL_CAMPAIGN_BRIEF.md` — voice/tone rules and email-channel-specific guidance
- `apps/marketing/src/Landing.tsx` — the landing page is written for Mike

---

## 1. One-paragraph summary

Mike is a 35–55 year old independent auto repair shop owner. His shop has 1–3 bays, sometimes a part-time tech, and definitely no service advisor. He's been wrenching for 15+ years. He owns the business but he's also under a hood most of the day — he is simultaneously the owner, the lead tech, the service advisor, the parts orderer, and the bookkeeper. His biggest daily pain isn't fixing cars (he's great at that); it's the customer-text overhead that breaks his flow every 15 minutes. He looked at Shopmonkey, AutoLeap, and Tekmetric and walked away from the price and complexity. He wants a tool built for him, not for a 10-bay dealership service drive.

---

## 2. Demographics & context

| Trait | Detail |
|---|---|
| **Name** | Mike (placeholder; persona, not a real customer) |
| **Age** | 35–55 |
| **Role** | Owner + lead tech + service advisor + bookkeeper (all four, simultaneously) |
| **Shop size** | 1–3 bays, 0–1 part-time techs |
| **Annual revenue** | <$1M/yr |
| **Years wrenching** | 15+ |
| **Tech comfort** | Smartphone-fluent, paperwork-averse. Will use iOS App Store and Stripe but not curl. |
| **Where he works** | On the shop floor, hands dirty, phone in his pocket, ~80% of his day |
| **Family/life context** | Often a partner who used to "help with the books"; may have kids; weekends and evenings are family time, not "setup time" |
| **Education** | High school + ASE certs; trade school is common |
| **Geographic context** | US suburban/rural — small commercial strip, not a downtown garage |

---

## 3. Pains (ranked by daily impact)

| # | Pain | Frequency | Cost to Mike |
|---|---|---|---|
| 1 | Customers texting "is my car ready" while he's under a hood | 6–10x/day | 5+ min of context-switching per interruption. Loses ~1–2 hours of wrench time/day. |
| 2 | Quotes written on scrap paper or in Notes, then lost | Several/week | Lost revenue, missed follow-ups, customers calling back for "what did you say it would be" |
| 3 | No card on file → chasing payment after the car leaves | Daily | A few hundred dollars of A/R he eats or chases; awkward conversations |
| 4 | Fighting QuickBooks Online — entries, categories, sync errors | Weekly | Frustration; usually pushed to "Sunday night" and dreaded |
| 5 | Forgetting to follow up with regulars on service-due work | Constantly | Repeat revenue left on the table — a customer he could've nudged for an oil change went to a competitor |
| 6 | Disorganized photo evidence — taking shop photos with his personal camera roll | Daily | Customers question charges; insurance disputes can't be substantiated |
| 7 | Pricing inconsistency — quoted $X last time, charged $Y this time | Monthly | Trust hits, occasional refunds |

---

## 4. Fears (what stops him from buying)

- **"I'll waste my weekend setting it up."** Setup time is real money — every hour he's setting up software is an hour he's not in the bay. Past SaaS experiences have included 4+ hour onboardings.
- **"My customers will think the AI texts are weird."** He's protective of his customer relationships, especially with long-time regulars.
- **"They'll lock me in and I'll lose my data."** He's been burned by software vendors before (Mitchell 1 desktop, QuickBooks Desktop sunsets).
- **"Per-seat pricing will explode when I add my part-timer."** Every quote he's gotten from competitors has scaled per user.
- **"This is built for bigger shops than mine."** He's tried Shopmonkey/AutoLeap and felt like he was being sold a service-drive workflow he'd never use.
- **"I'll look unprofessional to my customers."** Anything that feels gimmicky (auto-replies that sound like a chatbot) hits this fear hard.

---

## 5. Gains (what would make him excited)

- More wrench time. Less phone time. **This is the dream outcome.**
- Getting paid faster — cars get picked up, payment is already done
- Customers showing up at the right time without him calling them
- Knowing what every car needs next time it comes in
- Looking *more* professional to customers, not less — clean estimate texts vs greasy scrap paper
- A tool he can actually run from his phone — he doesn't have a back-office desk

---

## 6. Anti-persona (DO NOT build/write for these people)

The brief is blunt: saying no to these is a positioning **feature**, not a hole.

- **Multi-location operators** — they need real ops tooling we won't build
- **Shops with a dedicated service advisor** — the wedge (AI handles customer SMS) goes away if the SA already handles it
- **Fleet/B2B-heavy shops** — billing, contracts, and PO workflows are out of v1
- **Specialty shops** (trans-only, tires-only, body, exhaust) — workflow and parts catalogs differ enough to make Lift a worse fit
- **Shops doing >$1M/yr** — they're scaling past Mike's profile and need real scheduling
- **Dealer service drives** — different universe entirely
- **EV-only or hybrid-only shops** — for v1; not exclusion, just not the wedge audience

If a prospect identifies as one of these, **route them away kindly**. It builds trust with Mike.

---

## 7. Objections (and how to handle each)

| Objection | Counter (in Mike's language) |
|---|---|
| "Will I waste my weekend setting it up?" | 10-minute onboarding, three screens. First AI-drafted estimate sent the same afternoon. |
| "Will customers hate AI texts?" | You approve every word before send. Auto-replies are only status checks — and one tap turns them off. |
| "Will my data be locked in?" | One-click CSV export of everything, anytime — even after cancel. |
| "What about QuickBooks?" | CSV export in QB Import format today. Native sync 2026. |
| "Why not Shopmonkey?" | Built for 10-bay shops. You don't need 90% of what they ship. Lift does one thing — kill text overhead — and does it well. |
| "Is AI going to make my shop look unprofessional?" | The AI rewrites mechanic-speak into plain English. Customers get clearer estimates, not weirder ones. |
| "Do I need a new phone or a new number?" | No. PWA installs to your existing phone. Lift gives your shop a dedicated SMS number that routes into the app — not your personal inbox. |
| "What's the catch with $79?" | No catch. No per-tech, per-message, or per-RO fees. The card processing on customer payments is the only thing you pay extra for, and that's standard Stripe rates passed through at cost. |

---

## 8. Buying triggers (what makes Mike start looking)

Mike doesn't sit at a desk Googling SaaS. He starts looking when one of these happens:

- **A customer left a bad review** because Mike didn't reply to a text fast enough → starts looking for "how to handle customer texts at a shop"
- **He missed a $400 RO** because he forgot to follow up on an estimate → starts looking for "shop management software"
- **His QuickBooks just renewed for the year** at a price that pissed him off → starts looking for cheaper alternatives
- **A buddy mentioned what he's using** at a parts counter conversation → word of mouth is the strongest trigger
- **He hired a part-timer** and realized he can't keep pricing consistent → starts looking for "saved jobs" / "labor guide for indy shop"
- **His phone literally rang during a brake job** and he dropped a caliper → tactile, immediate, "I need this to stop"

---

## 9. Where Mike likely lives online

Inferred (no direct survey data yet — validate as we get real customers):

- **Reddit**: r/MechanicAdvice, r/Justrolledintotheshop, r/AskMechanics, r/AutoRepair (lurks, occasionally comments — won't engage with ads)
- **Facebook**: niche groups for independent shop owners; state-level ASA chapters; "[State] Independent Auto Repair Shop Owners" groups
- **YouTube**: ScannerDanner, South Main Auto (Eric O.), Pine Hollow Auto Diagnostics, Schrodinger's Box, Rainman Ray's Repairs (mostly for diag content, but he watches "shop owner" content too)
- **Podcasts**: Motor Age Garage, Changing the Industry Podcast (Lucas Underwood / David Roman), Remarkable Results Radio (Carm Capriotto)
- **Industry pubs**: Motor Age, Ratchet+Wrench, Tomorrow's Technician (skims, doesn't subscribe)
- **Trade events**: AAPEX, SEMA (he goes once every few years if he can swing the time)
- **Parts counter conversations**: NAPA, WORLDPAC, O'Reilly — peer-to-peer word of mouth happens here

**Where he doesn't live:** LinkedIn (he's not "networking"), Twitter/X (not his thing), TikTok (some watch, won't engage with shop-software ads), Product Hunt (zero awareness).

**Implication for marketing:** cold email and direct mail to acquired-list shop addresses are the most reliable acquisition channels for v1. Paid social to lookalike audiences will burn money. Word-of-mouth referral is the holy grail for v2+.

---

## 10. Decision criteria (how Mike picks software)

In rough priority order:

1. **Price clarity** — "$79 flat, no add-ons" beats "$199 + per-user + per-feature" every time, even if the latter is technically cheaper at his scale
2. **Phone-first** — if it's not usable from the shop floor on a phone, it's dead
3. **Setup time** — "10 minutes to value" matters more than feature count
4. **No lock-in** — explicit "you can leave with your data" lowers the trial activation barrier
5. **Feels like it's for him** — visual and copy cues that the product was built for a 1–3 bay shop, not a dealership
6. **Founder is human and reachable** — replies from a real person, not a ticket system
7. **No per-seat games** — burned by per-seat SaaS before; one flat fee is the deal-closer

He'll forgive missing features if these seven are right. He won't forgive any of these being wrong even if the feature list is twice as long.

---

## 11. Budget authority

- **Has full budget authority** for software <$200/mo — no approval required
- For anything above that, defers (verbally) to the partner who handles the books, but in practice it's his decision
- **Doesn't run formal evaluations or RFPs** — gut feel + a free trial + 1–2 buddy recommendations is the entire process
- Will sign up for a free trial without telling the partner; will only mention it when the bill hits

---

## 12. Success metric — how Mike judges if Lift worked

From `docs/PLAN.md` §1: *"Mike installs in <10 min during a slow afternoon and sends an AI-drafted estimate via SMS the same day."*

Beyond that initial activation, Mike will believe Lift "worked" when:

- He notices, two weeks in, that he hasn't been pulling his phone out of his pocket as often
- A customer compliments him on how clear his last estimate text was
- He gets paid for a job before the car was picked up (card-on-file pre-auth)
- A regular comes in for a 90-day-later oil change because Lift texted them, not because Mike remembered
- He stops thinking about Shopmonkey and AutoLeap

**Lift "failed" for Mike if:**
- Setup took more than one afternoon
- A customer complained that an auto-reply text felt robotic or wrong
- He found himself in QuickBooks fighting an export
- He couldn't find an RO he just created (UX failure)
- He felt like he was getting upsold to a higher tier

---

## 13. Voice Mike uses (so we can mirror it in copy and AI prompts)

**Words Mike says:**
- "the bay", "stay in the bay", "wrench time"
- "RO" (always uppercase, never spelled out)
- "she's ready" (referring to a car)
- "front pads", "rear shoes", "knock-knock", "cap light's on"
- "the customer", "the lady with the Camry", "the kid with the Civic"
- "scrap paper", "the dash", "the lot"
- "good people" / "bad people" (his customers are good people)
- "buddy of mine", "my parts guy"

**Words Mike doesn't say (and we don't either):**
- "platform", "solution", "leverage", "ecosystem"
- "revolutionize", "next-gen", "powerful", "robust", "seamless"
- "unlock", "supercharge", "elevate"
- "stakeholder", "synergy", "alignment"
- "Auto Repair 2.0", "the future of"
- "Service Advisor" capitalized — he says "the guy at the front" if he has one (he doesn't)

**Sentence rhythm:** Short. Direct. He drops articles when he's busy ("Sending Jess the brake quote, back in five"). Active voice. Specific numbers over adjectives. Contractions always.

---

## 14. Mike's day (as a story, for empathy)

7:30am — Opens the shop. Phone already has 3 texts from overnight asking about pickup times.

8:15am — First car on the lift. Customer texts: "is my car ready". Mike pulls out, types reply, gets back to it.

9:00am — Quotes a brake job verbally to the customer at the counter, writes it on a yellow legal pad.

10:30am — Customer texts: "is my car ready". Same customer as 8:15.

11:00am — Two more customers text simultaneously. One is asking about availability for next week.

12:15pm — Eats a sandwich at the counter. Three more texts come in during lunch. Replies to two, forgets the third.

1:00pm — Realizes he hasn't entered yesterday's ROs into QuickBooks. Tells himself he'll do it Sunday.

2:30pm — Customer arrives to pick up a car. No card on file. Mike has to ask, customer has to fumble for a wallet, awkward 90 seconds at the counter.

3:45pm — The yellow legal pad with the brake quote is gone. Mike re-quotes from memory.

5:30pm — Closes the shop. Has 11 unread texts. Replies to 3 on the way home.

8:30pm — Remembers he forgot to text the kid with the Civic about the alternator. Texts now. Kid already booked elsewhere.

**Lift's job:** make this day quieter, more profitable, and end on time.

---

## 15. How to apply this persona

Before shipping anything (a feature, a button, an email, a Tweet, a help-doc paragraph), run it through:

1. **Does Mike understand this in 3 seconds?** (Voice, jargon, density)
2. **Does this help Mike stay in the bay?** (Or does it pull him *out* of the bay?)
3. **Would Mike pay $79/mo if this was the only feature?** (If yes — ship it. If no — is it a delighter or filler?)
4. **Would Mike's partner approve the line item next time it shows up on the credit-card statement?** (Don't trigger family-level friction)
5. **If Mike got hit by a bus tomorrow, could his partner export his data and walk away?** (Lock-in test)
6. **Did we just say "platform"?** (If yes — rewrite)

---

## 16. What we don't know yet (validate post-launch)

- Watering holes (§9) are inferred — confirm via the first 10 trial users
- Buying triggers (§8) are inferred — capture the trigger field during onboarding ("what made you start looking?")
- Real testimonials, quantified outcomes, and customer language samples — all empty until real customers exist
- Whether Mike's partner is actually involved in the decision or just informed after
- Whether referral is as strong a channel as we assume

Update this file as we learn. It's the source of truth — keep it sharp.
