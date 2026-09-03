# Lift — Feature Inventory

What the product actually does today, taken from the shipped UI (`apps/web`,
`apps/marketing`), not the plan. Update this when a screen changes.
Last reviewed: **2026-08-30**.

Companion docs: [`PLAN.md`](PLAN.md) (v1 build plan), [`COMPLETION_PLAN.md`](COMPLETION_PLAN.md)
(slice status), [`PERSONA.md`](PERSONA.md) (who it's for).

---

## Sign-in & onboarding

- **Passwordless email sign-in** (magic link, 15-min expiry). No password, no third-party auth. Phone/SMS-code sign-in exists but is hidden until the 10DLC campaign is approved (`routes/login.tsx`).
- **Instant signup** — a brand-new email creates the account and session on the spot (no email round-trip) and drops straight into onboarding.
- **Confirm-email banner** — until the instant-signup account clicks its confirmation link, all outbound sends (texts, estimates, pay links) are locked; banner offers resend.
- **Three-screen onboarding**: shop name/city/state → shop-number explainer → start trial. Card-on-file via Stripe SetupIntent is optional ("Skip — add card later"). "Wrong email?" restart escape hatch.
- **Cold-email attribution** — `?pid=` tracking id from lift.worxel.com is captured at login and attached to the created shop.

## App shell (PWA)

- Installable **mobile-first PWA** (`vite-plugin-pwa`); responsive Mantine AppShell with burger nav on mobile.
- Nav: **Board · Customers · Messages · Saved jobs · Settings** (+ **Blog admin** for company admins only).
- **Global search** (⌘K / ⌘P spotlight): server-side lookup of customers and vehicles by name, phone, plate, or VIN. Hidden until the shop has its first customer.
- Sign out; route guards (login → onboarding → app).

## Board ("Today")

- ROs grouped into live status columns: **Scheduled, In, Diagnosing, Awaiting parts, In repair, Ready**; card shows RO #, total, customer, vehicle, last-touched time.
- **Scheduled column sorts by drop-off time**; a past-due visit (no-show or never moved off Scheduled) is flagged orange "past due"; undated ROs sink to the bottom.
- **Recently closed** strip, collapsed by default: Picked up / Voided / Cancelled (last 30).
- Starter-library prompt (see Saved jobs) and empty-state "create your first RO" CTA.

## Repair orders

**New RO wizard** (`/ro/new`, 3 steps):
- Customer step: search existing (name/phone) or create new inline; deep-linkable with `?customerId=` (skips to vehicle step).
- Vehicle step: pick from the customer's vehicles or add one inline.
- Concern step: free text + optional **scheduled drop-off** (shop-timezone picker) — sets status `scheduled` instead of `in`.
- **Voice dictation on every step** (see Voice) with **duplicate-detection banners**: dictated customers/vehicles are matched against existing records (exact / maybe) with one-tap "Use existing".

**RO detail** (`/ro/:id`):
- Status dropdown (full lifecycle incl. voided / cancelled by customer); estimate sent/approved badge.
- **Schedule visit** modal — set/change/clear drop-off; offers "move to Scheduled column" when it makes sense.
- **Line items**: labor (hours × $/hr), parts (qty × unit price), fees; inline add/edit/delete; labor/parts/total roll-up. All money in cents, entered as dollars.
- **+ Saved job** — apply a template's line items in two taps (picker shows "most used" + categories).
- **Voice-to-RO**: talk through the job → Transcribe + LLM draft of concern, diagnosis, and line items at the shop's labor rate → review modal → "Accept all".
- **Photos**: camera-first capture (rear camera on mobile), presigned S3 upload, gallery with captions.
- **Send estimate**: deterministic no-AI template draft by default; optional **"Polish with AI"** toggle (and back to "Use my version"); fully editable before sending; sends as SMS with an approval link. Disabled until the RO has line items and a customer.
- **Text pay link**: same review/edit/AI-polish flow; sends an SMS with a Stripe pay URL. Gated on payments setup — if Stripe Connect isn't finished, a setup prompt appears instead.
- **Send inspection**: editable SMS with an optional "include estimate" toggle (customer can approve right off the inspection page).

## Digital vehicle inspection (DVI)

- Per-RO inspection builder: items with **Good / Watch / Needs work** severity, plain-English note, per-item photos (captured directly onto the item), manual reorder, delete with confirm.
- Severity count badges (red/yellow/green); sent + viewed tracking ("Sent · viewed" badge).
- Customer-facing report page (see Public pages).

## Customers

- Searchable list (name / phone / email), add & edit via form (first/last, E.164 phone with SMS-consent copy, email, notes).
- **Customer detail**: tap-to-call phone link, SMS opted-out badge, notes; stats strip (lifetime spend, ROs, vehicles, last visit); vehicles with per-car spend/last-service; **upcoming service reminders** panel; recent RO activity timeline (status + paid badges); recent messages (collapsed, with AI-draft/auto-reply tags); "New RO" shortcut pre-filled with the customer.

## Vehicles

- Vehicle form: **VIN decode** (NHTSA + cache) fills year/make/model/trim/engine; year/make/model/trim/engine/mileage/plate/color/notes.
- **VIN barcode scanner** (BarcodeDetector + camera, Code 39) — built but currently behind a disabled flag (`SCAN_ENABLED = false` in `VehicleForm.tsx`) while iPad Chrome UX is debugged.
- **Vehicle detail**: header with plate badge, copy-VIN button, owner link + call; chips (lifetime spend, visits, last service); paginated **service-history timeline** — each past RO expands to "work done" line items.

## Messaging (the wedge)

- **Inbox** (Messages → Inbox): one thread per customer, latest message preview, sorted by newest activity; "Auto-replied" and "AI draft" badges on the preview.
- **Conversation view**: SMS-style bubbles, 15-second polling, load-older pagination, per-message AI-draft / auto-replied tags.
- **Composer**: type-and-send, or **"Draft with AI"** — drafts from the customer/RO context (optionally seeded by what you typed) and opens a review sheet. **Nothing sends without explicit review**; edits are tracked (char count, "edited" indicator).
- **Auto-reply to status checks** (toggle in Settings): an inbound "is my car ready?" is classified, answered from the real RO status in seconds, and tagged so the owner can read exactly what was sent. Real questions pass through untouched. Kill switch in Settings.
- Estimate / pay-link / inspection sends all land in the same thread.

## Service reminders

- **Auto-created when a qualifying job is closed** (per-category intervals, e.g. oil change / tire rotation — from `SERVICE_CATEGORIES`/`SERVICE_INTERVALS`); texts the customer when they're due back. "One nudge per car — never a blast." Global toggle in Settings.
- **Reminders tab** (inside Messages): Pending / Sent / Dismissed filters, due/sent/dismissed labels, per-reminder menu — **Snooze 30 days, Dismiss, Disable this category for this car**. Opt-outs and failures surfaced as statuses.
- Upcoming reminders also shown on the customer page.

## Voice

Four voice surfaces, all record → S3 → Transcribe → structured extraction:
- **Dictate customer** (new-customer form) — fills name/phone/email/notes, flags likely duplicates.
- **Dictate vehicle** — fills VIN/year/make/model/trim/mileage/plate/color, flags likely duplicates (VIN/plate = exact).
- **Dictate concern** (new-RO step 3) — speech to concern text.
- **Voice-to-RO** (RO detail) — full job talk-through to drafted line items + concern/diagnosis.

## Saved jobs (templates)

- **Starter library**: one-tap import of 12 common jobs (editable prices) offered on the empty board; dismissible.
- Template CRUD: name, category (autocomplete from existing), internal notes, line items with the same editor as ROs; archive with confirm.
- **Default labor rate** ($/hr, in Settings; also prompted inline the first time) seeds labor rows.
- Apply-to-RO picker: search, "Most used" section (use counts tracked), grouped by category; bottom-sheet on mobile.

## Payments & billing

- **Getting paid** (owner-only): lazy **Stripe Connect** onboarding (~5 min, hosted); status shown (not started / unfinished / active); money goes straight to the shop's bank.
- **Pay by text**: customer pays from their phone on a public page (Stripe PaymentElement, 3DS supported, email receipt); RO shows "paid"; webhook is source of truth with quick client-side polling for the "Paid — thanks!" state.
- **Lift subscription**: $79/mo flat, 14-day trial, card via SetupIntent at onboarding (skippable); **Manage billing** opens the Stripe billing portal.

## Online booking

- Settings (per-shop): enable toggle, **public booking link** `lift.worxel.com/book/<slug>` (slug editor with validation + 90-day redirect note, copy button), slot length (15–240 min), lead time, horizon days, per-day bookable hours table seeded from business hours.
- **Public booking page** (3 steps): calendar with closed days greyed, open time slots in shop timezone, name/phone/vehicle/concern form → confirmation code + SMS confirmation. Creates a **scheduled RO** on the board.
- **Manage-booking page** (tokenized link): view booking, **reschedule** (slot picker) or **cancel** (with SMS confirmation).

## Team

- Owner invites techs by email (optional cell for SMS-code sign-in); pending "Invited" badge, re-send handling; remove with confirm (access revoked immediately).
- Techs see the same board, ROs, customers, and texts; **payments, billing, team management, and data export are owner-only**.

## Settings (summary)

AI tone (plain / friendly) · auto-reply toggle · service-reminders toggle · online booking (above) · default labor rate · team · getting paid (Stripe Connect) · manage billing · **Export everything as CSV** (one click, works even mid-cancel).

## Customer-facing public pages (tokenized, no login)

- **Estimate** — line items + total, one-tap **Approve / Decline** (approval moves the RO to "in repair").
- **Inspection report** — severity summary, items with notes + photo carousels and full-screen lightbox, optional embedded estimate with approve/decline, "reply to our text" footer.
- **Pay** — amount due, card payment, paid state; graceful copy when the link is expired/paid or the shop hasn't set up payments.
- **Booking + manage booking** (above).

## Company back office (Lift-the-company, not shops)

- **Blog admin** (`/admin/blog`, company-admin only): Queue / Published / Rejected tabs; **Generate draft** (LLM pipeline; nightly cron behind `BLOG_GENERATION_ENABLED`); edit title/meta/slug/schedule/markdown with preview; reject a draft (replacement is drafted on a new topic) or retract a published post (off the public blog in ~5 min).

## Marketing site (`lift.worxel.com`)

- Pre-rendered landing page, `/privacy` + `/terms`, soft-404 handling, and the server-rendered `/blog`. Hosts the public booking pages above ("powered by Lift" shell).

## Explicitly NOT in the product (deferred per plan)

QuickBooks sync (CSV export only) · multi-location · tech assignment / time tracking · real calendar (day-view buckets only) · fleet/B2B · marketing automation / review campaigns · native iOS/Android (PWA only).
