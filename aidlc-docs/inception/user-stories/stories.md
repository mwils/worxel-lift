# User Stories — Lift v1

> **Format**: `As [persona], I want [capability], so that [outcome]. (Acceptance criteria as a list. FR refs.)`
> **Personas**: P1 = Mike; P2 = "Jess" (Mike's customer). See [`personas.md`](personas.md).
> **Tracing**: Every story references one or more FRs from `requirements/requirements.md`. Stories drive Construction-phase work selection.
> **Approval**: Self-approved by orchestrator on 2026-05-24T21:00:00Z (autonomous run).

---

## Epic A — Get into Lift

### US-A1: Sign up self-serve
- **As Mike, I want to enter my email and get a magic-link to start a trial, so that I can try Lift without a sales call.**
- **AC**:
  - I enter only an email on `/login`
  - I receive an email within 60 seconds with a clickable link
  - Clicking the link logs me in and sends me to onboarding
  - I do NOT need a credit card
- **FR**: FR-1, FR-2, FR-10

### US-A2: 10-minute setup
- **As Mike, I want onboarding in three screens, so that I can finish during a slow afternoon.**
- **AC**:
  - Screen 1: shop name + address + timezone
  - Screen 2: SMS number verification (receive a test text)
  - Screen 3: trial start confirmation
  - End-to-end ≤10 minutes for typical user
- **FR**: FR-6, FR-7, FR-9, FR-11

### US-A3: SMS-code fallback for delayed email
- **As Mike, when my magic-link email doesn't arrive, I want to log in via an SMS code.**
- **AC**:
  - "Send code via SMS instead" option on `/login` (after a delay timer)
  - Code arrives within 60 seconds
- **FR**: FR-3

---

## Epic B — Run the shop from my phone

### US-B1: See my work at a glance
- **As Mike, I want a board showing all my ROs in columns by status, so that I can see what's left to do in 3 seconds.**
- **AC**:
  - `/app/board` is the default landed view post-login
  - Columns: `in`, `in_repair`, `ready`, `picked_up`
  - Mobile-first (single-column scroll on phones)
  - Tapping a card opens the RO detail
- **FR**: FR-23

### US-B2: Create a new RO in <30 seconds
- **As Mike, when a customer drops a car off, I want to create an RO fast.**
- **AC**:
  - "+ New RO" button on board
  - Inline customer search (typeahead) — if no match, create-and-attach
  - Inline vehicle pick or create (Y/M/M, optional VIN decode)
  - Status defaults to `in`
  - RO number auto-increments per shop
- **FR**: FR-14, FR-15, FR-19, FR-22, FR-24

### US-B3: Type or talk a job
- **As Mike, I want to add line items by either typing or dictating, so that I don't have to type with greasy hands.**
- **AC**:
  - Tap "+" to add a line item by typing
  - Tap microphone to record voice memo
  - Voice memo gets transcribed and structured into line items I can edit
- **FR**: FR-27, FR-30

### US-B4: Snap photos
- **As Mike, I want to take photos with the phone camera and have them attach to the RO, so that I have proof for customers and insurance.**
- **AC**:
  - Tap the camera icon → photo capture
  - Photo uploads to S3; appears in the RO photo list within 3 seconds
  - Photos can be tagged with inspection severity (green/yellow/red)
- **FR**: FR-28, FR-29

### US-B5: Saved jobs in two taps
- **As Mike, I want to drop my common jobs onto an RO in two taps.**
- **AC**:
  - "Apply saved job" button on RO detail
  - List shows my saved jobs + a search box
  - Tap a job → all its lines appear on the RO
- **FR**: FR-52, FR-53

### US-B6: Starter library
- **As Mike, on my first day, I want a set of common jobs pre-built so I'm not starting from blank.**
- **AC**:
  - Settings page exposes "Import starter library" once
  - Imports ~20 common-shop jobs into `JobTemplate`
- **FR**: FR-54

---

## Epic C — The wedge: AI handles customer SMS

### US-C1: AI auto-replies to "is my car ready"
- **As Mike, when a customer texts me asking for status, I want the system to reply for me with the actual state of the RO.**
- **AC**:
  - Inbound SMS classified within 2s
  - If classified `status_check` with confidence ≥0.85: auto-reply with current RO status
  - Reply tagged `autoReplied=true` in the message log
  - End-to-end (inbound → outbound) within 10s
- **FR**: FR-36, FR-37, FR-38; NFR-3, NFR-4, NFR-9, NFR-25

### US-C2: One-tap kill-switch
- **As Mike, when I want to handle a customer manually, I want to turn auto-reply off in one tap.**
- **AC**:
  - Settings → "AI auto-reply" toggle
  - Toggling off takes effect immediately for subsequent inbound SMS
- **FR**: FR-13, NFR-26

### US-C3: AI-drafted reply for everything else
- **As Mike, when a customer texts a question or anything non-routine, I want a draft reply waiting for me to approve.**
- **AC**:
  - Inbound message classified as `question` or `other` triggers a push notification
  - Conversation view shows the inbound message + an AI-drafted reply preview
  - I can edit, send, or discard
- **FR**: FR-34, FR-35, FR-40

### US-C4: See the full thread
- **As Mike, I want one thread per customer, sorted chronologically.**
- **AC**:
  - `/app/messages/conversation/:customerId` shows all messages
  - Auto-replies are visually distinguished from owner-sent
- **FR**: FR-33

---

## Epic D — Estimates over SMS

### US-D1: Send an AI-drafted estimate
- **As Mike, when an RO is quoted, I want to send the customer an estimate via SMS that they can approve with one tap.**
- **AC**:
  - "Send estimate" button on RO detail
  - AI drafts the SMS in plain English; mechanic-speak is rewritten
  - Owner reviews and can edit before send
  - Sent SMS contains a tap-to-approve link
- **FR**: FR-31, FR-64

### US-D2: Customer approves without logging in
- **As Jess (customer), when I get an estimate SMS, I want to approve or decline with one tap.**
- **AC**:
  - SMS link opens a token-scoped page (no login)
  - Page shows line items, total in $, and approve/decline buttons
  - Tap "Approve" → RO flips to `in_repair`; I see a confirmation
  - Tap "Decline" → owner is notified
- **FR**: FR-41, FR-42

### US-D3: Photo inspection with severity
- **As Mike, I want to send the customer a photo inspection grouped by green/yellow/red items.**
- **AC**:
  - RO detail has "Send inspection" once at least one inspection item exists
  - AI drafts the SMS summary
  - Customer page renders photos under each severity bucket with notes
- **FR**: FR-32, FR-43

---

## Epic E — Get paid

### US-E1: Send a Stripe pay link
- **As Mike, when work is done, I want to send the customer a pay link in an SMS.**
- **AC**:
  - "Send pay link" button on a `ready` RO
  - SMS contains a Stripe-backed payment URL
- **FR**: FR-48, FR-44

### US-E2: Save card on file
- **As Mike, I want returning customers to be able to save a card so I can pre-auth charges.**
- **AC**:
  - Card-on-file flow (Setup Intent) during/after first payment
  - Subsequent ROs can be pre-authorized
- **FR**: FR-49, FR-50

### US-E3: Payment webhook updates the RO
- **As Mike, when the customer pays, I want the RO to show `paid` automatically.**
- **AC**:
  - Stripe webhook updates `Payment.status=paid` and RO status to `picked_up`
  - Webhook is idempotent (no double-update if Stripe retries)
- **FR**: FR-51; NFR-8, NFR-16

---

## Epic F — Customer-initiated booking

### US-F1: Customer self-books
- **As Jess, I want to book my shop appointment online instead of calling.**
- **AC**:
  - Visit `https://lift.worxel.com/public/book/<shop-slug>` (or my shop's branded URL)
  - Pick a day → see available slots
  - Fill in name + phone + vehicle + concern → submit
  - I get an SMS confirmation immediately
- **FR**: FR-45, FR-46

### US-F2: Customer manages the booking
- **As Jess, I want to be able to reschedule or cancel my booking without calling.**
- **AC**:
  - Booking confirmation SMS contains a manage-booking link
  - Link opens a page where I can pick a new slot or cancel
- **FR**: FR-47

### US-F3: Owner notified of new bookings
- **As Mike, when a booking comes in, I want a text on my personal phone.**
- **AC**:
  - Owner's personal SMS receives a notification with customer + vehicle + time + concern snippet
- **FR**: FR-46

---

## Epic G — Stay-in-touch: service-due reminders

### US-G1: Auto-remind based on the work I just did
- **As Mike, after I finish an oil change, I want Lift to text the customer in 90 days reminding them.**
- **AC**:
  - Finishing certain line-item types schedules a service reminder
  - 90 days later (or N days based on the line-item config), reminder is sent via SMS
  - Reminder text references the specific vehicle by year/make/model
- **FR**: FR-55, FR-56

### US-G2: See and edit reminders
- **As Mike, I want to see what reminders are scheduled and edit/cancel them.**
- **AC**:
  - Settings → "Service reminders" list view
  - Each reminder shows: customer, vehicle, type, date, action
- **FR**: FR-57

### US-G3: Suppress for a vehicle
- **As Mike, if a customer sells a car, I want to disable all reminders for that vehicle.**
- **AC**:
  - One-tap "Disable reminders for this vehicle" from the vehicle detail
- **FR**: FR-58

---

## Epic H — Settings, billing, and trust

### US-H1: Edit shop settings from my phone
- **As Mike, I want to edit shop name, hours, timezone, AI tone, and the auto-reply toggle, all from my phone.**
- **AC**:
  - `/app/settings` is mobile-first
  - Saving any field triggers an immediate API PATCH
- **FR**: FR-12, FR-13

### US-H2: Manage my subscription
- **As Mike, I want to update my payment method, see invoices, or cancel — without contacting support.**
- **AC**:
  - Settings → "Manage billing" opens Stripe Customer Portal
- **FR**: FR-59, FR-60

### US-H3: Export everything anytime
- **As Mike, I want to download a zip of all my data with one tap, so that I know I'm not locked in.**
- **AC**:
  - Settings → "Export data" produces a zip of CSVs (customers, vehicles, ROs, messages, payments)
  - Export works even after I cancel
- **FR**: FR-61, NFR-22, NFR-23

---

## Epic I — Customer-facing pages

### US-I1: Estimate page
- **As Jess, I want to see what work is proposed and the total without logging in.**
- **AC**: see US-D2.
- **FR**: FR-41, FR-42

### US-I2: Inspection page
- **As Jess, I want to see the photos of what's wrong and why it costs what it costs.**
- **AC**: photos grouped green/yellow/red with notes; estimate visible.
- **FR**: FR-43

### US-I3: Pay page
- **As Jess, I want to pay without creating an account.**
- **AC**: Stripe payment surface, RO total displayed.
- **FR**: FR-44

---

## Epic J — Marketing site (lift.worxel.com)

### US-J1: Convert cold-email traffic to trials
- **As prospect Mike, when I click a cold-email link, I want to immediately see whether Lift is for me.**
- **AC**:
  - Hero H1 matches the cold-email subject (message-match)
  - "This is for you if / NOT for you if" appears above the fold on mobile
  - $79/mo flat + 14-day trial + no card visible
- **FR**: (marketing — not in API FR set; covered by `apps/marketing/src/Landing.tsx`)

### US-J2: Land on a clear CTA
- **As prospect Mike, I want one button to start the trial.**
- **AC**:
  - Hero CTA → `${VITE_WEB_APP_URL}/login` with UTMs
  - No competing CTAs near the primary
- **FR**: see US-A1 for what happens after click

---

## Story Coverage Matrix

| FR ID | Covered by stories |
|---|---|
| FR-1, FR-2, FR-10 | US-A1 |
| FR-3 | US-A3 |
| FR-6, FR-7, FR-9, FR-11 | US-A2 |
| FR-12, FR-13 | US-H1, US-C2 |
| FR-14–22 | US-B2 |
| FR-23 | US-B1 |
| FR-24, FR-27 | US-B2, US-B3 |
| FR-25, FR-26 | (RO detail; implicit in B-series) |
| FR-28, FR-29 | US-B4 |
| FR-30 | US-B3 |
| FR-31 | US-D1 |
| FR-32 | US-D3 |
| FR-33 | US-C4 |
| FR-34, FR-35 | US-C3 |
| FR-36–40 | US-C1, US-C2, US-C3 |
| FR-41 | US-D2, US-I1, US-I2, US-I3 |
| FR-42 | US-D2 |
| FR-43 | US-D3, US-I2 |
| FR-44 | US-E1, US-I3 |
| FR-45–47 | US-F1, US-F2 |
| FR-46 | US-F1, US-F3 |
| FR-48–51 | US-E1, US-E2, US-E3 |
| FR-52–54 | US-B5, US-B6 |
| FR-55–58 | US-G1, US-G2, US-G3 |
| FR-59, FR-60 | US-H2 |
| FR-61 | US-H3 |
| FR-62–66 | (cross-cutting; tested per-unit) |

Coverage: 100% of FRs are referenced by at least one user story.
