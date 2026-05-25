# Lift — Product Requirements Document (v1)

**Product:** Lift
**Audience:** Mike, the owner-operator (1–3 bay independent auto repair shop)
**Status:** Draft for review
**Last updated:** May 24, 2026

> **The one-line job:** Make Mike's day quieter, more profitable, and end on time — by killing the customer-text overhead that breaks his flow every 15 minutes.

---

## 1. Why this exists

Mike is the owner, lead tech, service advisor, parts orderer, and bookkeeper — all at once, all day, with his hands under a hood. His biggest daily pain isn't fixing cars; he's great at that. It's everything *around* fixing cars: the texts asking "is my car ready," the brake quote scribbled on a legal pad that goes missing, chasing payment after the car already left, and dreading QuickBooks on Sunday night.

He's looked at Shopmonkey, AutoLeap, and Tekmetric and walked away from the price and the complexity. Those are built for a 10-bay dealership service drive. Mike needs a tool built for *him*.

Lift does one thing and does it well: it takes the busywork off Mike's plate so he can stay in the bay. AI handles the typing, the drafting, and the remembering. Mike approves and gets back to work.

### Success looks like

- Mike installs in under 10 minutes during a slow afternoon and sends an AI-drafted estimate via SMS the same day.
- Two weeks in, he notices he's not pulling his phone out of his pocket as often.
- A customer compliments him on how clear his last estimate text was.
- He gets paid for a job *before* the car is picked up.
- A regular comes in for a 90-day oil change because Lift texted them, not because Mike remembered.
- He stops thinking about Shopmonkey and AutoLeap.

### Failure looks like

- Setup took more than one afternoon.
- A customer said an auto-reply text felt robotic.
- Mike found himself fighting an export.
- He couldn't find an RO he just created.
- He felt like he was being upsold to a higher tier.

---

## 2. Design principles

These are non-negotiable. Every feature, button, and line of copy gets checked against them.

1. **Automation over features.** The win is AI doing the work, not Mike learning a new tool. If a feature adds a button instead of removing one, it's suspect.
2. **Phone-first, always.** Mike has no back-office desk. If it isn't usable one-handed on a phone on the shop floor, it doesn't ship.
3. **Mike approves, AI drafts.** AI never speaks to a customer in Mike's name without Mike tapping send. This is the answer to "will customers think the AI texts are weird."
4. **10 minutes to value.** Three onboarding screens. First estimate sent the same afternoon. No 4-hour setup, ever.
5. **No lock-in.** One-click CSV export of everything, anytime, even after cancel. Stated loudly, because it lowers the barrier to trying.
6. **One flat price.** $79/mo. No per-tech, per-message, or per-RO fees. The only extra is standard Stripe processing on customer payments, passed through at cost.
7. **Say no on purpose.** The anti-persona (§8) is a positioning feature. We don't build for 10-bay shops, and Mike can feel that the product was made for him.
8. **No diagnosis.** Mike is the diagnostician. AI helps him *write* the estimate, never tells him what's wrong with the car. (See §6.)

---

## 3. Who we are NOT building for

Out of scope for v1, by design. If a prospect is one of these, route them away kindly — it builds trust with Mike.

- Multi-location operators
- Shops with a dedicated service advisor (the AI-SMS wedge disappears)
- Fleet/B2B-heavy shops (POs, contracts, net-30 billing)
- Specialty shops — trans-only, tires-only, body, exhaust
- Shops doing more than $1M/yr
- Dealer service drives
- EV/hybrid-only shops (not excluded forever — just not the wedge audience)

---

## 4. The v1 feature set

I've cut this tight to Mike's actual day. Each feature maps directly to a ranked pain from the persona. Anything that didn't map got left out (see §7, Explicitly Not Building).

The shape of v1 is six features:

1. AI Text Assistant (the wedge)
2. Estimates & ROs
3. Card-on-File Payments
4. Service-Due Follow-Ups
5. Job Photos
6. Saved Jobs & Consistent Pricing

Plus the connective tissue: a dedicated shop SMS number, a phone-first home screen, onboarding, and CSV export.

---

### 4.1 AI Text Assistant — *the wedge*

**Solves:** Pain #1 — customers texting "is my car ready" 6–10x/day, costing 1–2 hours of wrench time.

This is the reason Lift exists. Every inbound customer text lands in one place. For routine status questions, AI drafts a reply in plain, human English and shows it to Mike. He glances, taps send, back to the bay. Two seconds instead of two minutes of context-switching.

**What it does:**

- Gives the shop a **dedicated SMS number** that routes into the app — never Mike's personal inbox, no new phone, no new number for him to manage.
- All customer texts land in one threaded inbox, tied to the customer and their vehicle.
- For common questions ("is it ready," "how much longer," "what do I owe"), AI drafts a reply pulling real status from the active RO. Mike approves with one tap.
- AI **rewrites Mike's mechanic-speak into clear customer English.** Mike types "front pads + rotors done, ready 3pm" → customer sees a clean, friendly, professional message.
- **Auto-reply for status checks only**, and only if Mike turns it on. One tap turns it off. It never improvises beyond car-status facts.

**Guardrails (directly answering Mike's fears):**

- AI drafts; **Mike sends.** Nothing goes out in his name without his tap (unless he explicitly enables status-only auto-reply).
- AI only handles status and logistics — never price negotiation, never diagnosis, never anything that could sound like a chatbot.
- Tone is plain and human. No emoji spam, no "Thank you for reaching out!" corporate filler. It sounds like a competent shop, because that protects the customer relationships Mike is protective of.

---

### 4.2 Estimates & Repair Orders

**Solves:** Pain #2 (quotes on scrap paper, then lost) and Pain #7 (pricing inconsistency).

The yellow legal pad is dead. Mike builds an estimate on his phone in under a minute, and AI turns his shorthand into something a customer can read and trust.

**What it does:**

- Mike adds line items by typing the way he talks — "front pads, rotors, hour labor." AI structures it into a clean estimate with parts, labor, and a total.
- **AI drafts the customer-facing estimate text** — mechanic-speak in, plain English out — ready to send over SMS with one tap.
- An estimate becomes an **RO** with one tap when the customer approves. Same object, just a status change — no re-entry.
- Customer can **approve the estimate by replying to the text** ("yes," "go ahead"). AI recognizes the approval and flips the RO status; Mike sees it without lifting a finger.
- Every estimate and RO is saved, searchable, and tied to the customer and vehicle. Nothing gets lost. Nothing gets re-quoted from memory.

**The "find an RO" test:** Mike must be able to find any RO he just created in two taps from the home screen. If he can't, this feature failed.

---

### 4.3 Card-on-File Payments

**Solves:** Pain #3 — no card on file, chasing payment after the car leaves, the awkward 90 seconds at the counter.

Powered by Stripe. When the estimate is approved, Mike can text a secure link for the customer to **save a card on file** — so when the work's done, the car gets picked up and payment is already handled.

**What it does:**

- Secure Stripe-hosted card capture via a texted link. Mike never sees or handles raw card data.
- **Pre-authorization / card on file** so payment clears when the job is done, not after a chase.
- One-tap charge against the RO total when work is complete; receipt texted automatically.
- Standard Stripe rates, passed through at cost. Stated plainly so there's no "what's the catch."

**Boundary:** Lift facilitates the Stripe flow; it never stores card numbers itself and never asks Mike to type a customer's card. The customer enters their own card on Stripe's secure page.

---

### 4.4 Service-Due Follow-Ups

**Solves:** Pain #5 — forgetting to nudge regulars on service-due work; repeat revenue walking to a competitor.

The kid with the Civic who needed an alternator and booked elsewhere because Mike texted at 8:30pm — this feature is for that.

**What it does:**

- When an RO closes, Lift quietly notes what's likely due next and roughly when (e.g., oil change ~90 days out) based on the work just done.
- At the right time, **AI drafts a friendly "you're about due" text** to that customer. Mike reviews a simple queue of suggested nudges and sends with a tap — or batches them.
- Nudges are suggestions Mike approves, never automatic blasts. Protects the relationship; avoids feeling spammy.

**Note:** This is a follow-up engine, not a service-interval database. We keep it simple — based on the work done and sensible defaults, not a per-vehicle OEM maintenance schedule. That depth is for later if Mike asks for it.

---

### 4.5 Job Photos

**Solves:** Pain #6 — shop photos buried in his personal camera roll; customers questioning charges; no evidence for disputes.

**What it does:**

- Snap photos straight into the RO from the phone. They live with the job, not in Mike's camera roll.
- Attach a photo to an estimate or text so the customer *sees* the worn pads or the leak — fewer "why am I paying for this" conversations.
- Photos stay attached to the RO for the record. If a charge or an insurance question ever comes up, the evidence is right there.

Deliberately simple: capture, attach, done. No annotation studio, no markup tools in v1.

---

### 4.6 Saved Jobs & Consistent Pricing

**Solves:** Pain #7 (quoted $X last time, charged $Y) and a key buying trigger (hired a part-timer, can't keep pricing consistent).

**What it does:**

- Mike saves his common jobs — "front brake job," "synthetic oil change," "diagnostic hour" — with his parts and labor baked in.
- Building an estimate becomes picking a saved job and tweaking, not rebuilding from scratch.
- Same job = same price, every time, whether Mike or his part-timer writes it up. Trust stays intact; no awkward refunds.

---

### 4.7 The connective tissue

**Phone-first home screen.** Opens to today: cars in the shop, unread texts, estimates waiting on approval, payments due. Everything one or two taps away. Built thumb-first for a guy holding a phone in a greasy hand.

**10-minute onboarding.** Three screens: shop name + your number, claim your Lift SMS number, connect Stripe. That's it. First AI-drafted estimate goes out the same afternoon. We also capture one optional field — *"what made you start looking?"* — to learn Mike's real buying trigger.

**CSV export — the no-lock-in promise.** One click exports everything (customers, vehicles, ROs, payments) in a clean CSV, formatted for QuickBooks import. Available anytime, even after cancel. This is the answer to "they'll lock me in and I'll lose my data," and it's stated loudly because saying it lowers the barrier to trying Lift at all.

---

## 5. Where AI does the work

Mike asked for AI everywhere it genuinely saves time. Here's exactly where it earns its $79 — and where it stays out.

| AI does this | It looks like | Why it's safe |
|---|---|---|
| Drafts replies to customer status texts | "Hey, she's ready — picks up anytime before 6." | Mike approves; facts pulled from the real RO |
| Rewrites mechanic-speak into customer English | "front pads + rotors" → clear estimate line | Clarity, not interpretation; Mike sees it first |
| Turns shorthand into a structured estimate | "pads rotors hr labor" → itemized estimate | Mike reviews every line before it's sent |
| Recognizes a customer's "yes" as approval | Reply "go ahead" → RO status flips | Status change only; Mike sees the result |
| Drafts service-due follow-up nudges | "You're about due for an oil change." | Suggestion in a queue; Mike sends it |
| Summarizes a thread so Mike catches up fast | "Jess asked about pickup; owes $340." | Read-only summary, no action taken |

**Where AI deliberately stays out:**

- **No diagnosis.** AI never tells Mike (or the customer) what's wrong with the car. Mike has 15+ years under the hood; a wrong AI guess is exactly the "makes my shop look unprofessional" fear. AI helps him *write the estimate*, not *make the call*.
- **No autonomous customer conversation.** Beyond opt-in status-only auto-replies, AI never carries on a back-and-forth in Mike's name.
- **No pricing decisions.** AI structures and presents Mike's prices; it never sets or negotiates them.

---

## 6. Explicitly not building (v1)

Saying no keeps Lift simple and keeps it Mike's. Cut from v1:

- **AI diagnosis from symptoms.** Powerful, but liability- and trust-risky, and Mike doesn't need it. Stays out.
- **Native QuickBooks sync.** CSV export in QB-import format covers Mike on day one without blocking launch on Intuit's API. Native sync is a roadmap candidate, not a v1 promise.
- **A full scheduling/calendar engine.** Mike runs 1–3 bays from his head and a text. A dealership scheduling grid is anti-persona. (A lightweight "when can you take my car" reply is handled inside the Text Assistant.)
- **Inventory / parts management.** He orders from his parts guy as he goes. Tracking stock is a 10-bay problem.
- **Multi-user roles & permissions.** Solo or one part-timer. Per-seat anything is the exact trap Mike's been burned by.
- **Fleet/B2B billing, POs, net-30.** Anti-persona.
- **Photo annotation studio, OEM service-interval database, marketing/review automation.** All delighters at best; none clears the "would Mike pay $79 if this were the only feature" bar. Revisit only if real customers ask.

---

## 7. Constraints & guardrails

- **Price:** $79/mo flat. No per-tech, per-message, per-RO fees. Stripe processing passed through at cost. No tiers to get upsold into.
- **Platform:** Web-based PWA, installs to Mike's existing phone. No app-store dependency for core use; no new phone or number.
- **Setup ceiling:** 10 minutes, 3 screens. If onboarding creeps past one slow afternoon, we've failed the core promise.
- **Data portability:** One-click CSV export of everything, anytime, including after cancellation.
- **Voice:** Plain, direct, Mike's language. Never "platform," "solution," "seamless," "supercharge." Short sentences. Specific numbers over adjectives. (See persona §13.)
- **Privacy/payments:** Lift never stores raw card data; all card capture is Stripe-hosted. Customers enter their own cards.

---

## 8. How we'll know it worked

**Activation (the make-or-break metric):**
- % of trials that send an AI-drafted estimate via SMS within 24 hours of signup.

**Engagement / value:**
- Texts handled per shop per week (the overhead being absorbed).
- % of customer status texts answered via an AI-drafted reply.
- Estimates sent → approved-by-text rate.
- % of ROs with a card on file before pickup.
- Service-due nudges sent → bookings.

**Retention / trust:**
- Monthly retention.
- Customer complaints about a text sounding robotic — **target: zero.** This is a tripwire, not just a metric.
- Support handled by a reachable human, not a ticket queue (a persona decision criterion).

---

## 9. Open questions

- **Native QuickBooks sync** — confirmed out of v1 (CSV only). Revisit timing once we have real customers asking.
- **Service-due intelligence depth** — is "based on work done + sensible defaults" enough, or will Mike want per-vehicle intervals sooner than expected? Validate with first users.
- **Auto-reply comfort** — how many Mikes actually turn on status-only auto-reply vs. approve-every-send? This tells us how far to push automation in v2.
- **Buying trigger** — the persona's triggers are inferred. The onboarding "what made you start looking?" field validates them with real data.
- **Partner involvement** — is Mike's book-keeping partner actually in the buying decision, or just informed when the bill hits? Affects nothing in v1, but shapes pricing comms.

---

*This PRD is written to the persona. Before anything ships, run it through the persona's six tests: Does Mike get it in 3 seconds? Does it keep him in the bay? Would he pay $79 if it were the only feature? Would his partner approve the line item? Could he export and walk away? Did we just say "platform"?*
