# Lift — post-QA feature gaps (2026-09-03)

Context for the agent working this: these are missing capabilities a 1–3 bay shop owner ("Mike", see `docs/PERSONA.md`) will ask for in the first month, identified during a live-user walkthrough of production. None are on the v2 deferred list in `docs/PLAN.md`. Items 1–8 are capability gaps found during the walkthrough. Items 9–12 are scale/longevity
gaps — things that work fine today and degrade over a year at five cars a day. Each item states
the user problem, what exists today, scope boundaries, and a suggested shape. The shape is a suggestion — if the codebase points a different way, say so before building. Work in the order given; items 1–4 are prerequisites for 5–7.

Conventions apply throughout (CLAUDE.md): money in cents, `shopId` from session, shared Zod DTOs, `withAuth` / `withErrorBoundary`, public pages token-scoped and unauthenticated.

> **Round-2 status (2026-09-03).** Every item in this document is now implemented on
> `qa/round-2-2026-09-03`, along with the round-2 QA findings in
> `QA-2026-09-03-production-walkthrough.md`. Typecheck and both frontend builds are clean; nothing is
> deployed yet. Four one-off backfills must run against the target stage before retesting — the exact
> commands are in the QA doc's Status section. Each item below keeps its original brief, with a
> "Status: done" note recording what actually shipped and what was deliberately left out.

---

## 1. Payment recording, receipt, and paid/unpaid state — DONE

**Status: done (2026-09-03, branch `qa/round-2-2026-09-03`).** `Payment` rows are now the source of
truth: `stripePaymentIntentId` is optional, and manual rows carry method (`cash | card_in_person |
check | other | stripe`), amount, note, `recordedByUserId` and `paidAt`. RO payment state is derived
(`collectedCents`, `balanceCents`, status `unpaid | partial | paid | refunded`), so a short payment
reads `PARTIAL · $94.50 due` instead of closing the job. Writing off the remainder is an explicit
checkbox that adds a negative "Discount" fee line. The RO shows a payments list with notes; board
cards show unpaid/partial. Customer lifetime spend and vehicle spend sum Payment rows. Public
print-friendly receipt at `/public/receipt/:token` (`GET /public/receipt/{token}`), with "Text
receipt" on the RO. Manual refund/void per row. Backfill: `scripts/backfillPayments.ts`.
Out of scope items stayed out. Known wart: editing a negative Discount line fails DTO validation
(delete works).
**User problem.** After "picked up" the RO shows $294.50 with no way to say it was paid, how, or when. Shops that take cash / card-on-counter / check can never close a job, and customer "Lifetime spend" stays $0 forever.

**Exists today.** `repairOrders.payment.status` (`unpaid | authorized | paid | refunded`) and `payments` collection are in the schema (PLAN.md §Data model) but only Stripe writes them. No UI surfaces payment state.

**Scope.**
- "Mark paid" action on the RO: method (`cash | card_in_person | check | other | stripe`), amount (default = RO total), optional reference/note, `paidAt` default now. Writes a `payments` row and sets `payment.status`. Partial payments allowed; balance shown.
- RO header shows: Paid $X (Cash, Sep 3) / Unpaid $X / Partial ($X of $Y).
- Board card shows an "UNPAID" pill on `ready` and `picked_up` ROs with balance > 0.
- Moving to `picked_up` with balance > 0 prompts: "Balance $294.50 — Mark paid / Pick up unpaid".
- Customer and vehicle "spend" figures sum `payments`, not RO totals.
- Receipt: a public, tokenized, print-friendly page (`/public/receipt/:token`) with shop name/address/phone, RO number, vehicle, line items, tax, total, payment method and date. Reuse the public estimate page layout + `@media print`. "Text receipt" button on the RO after payment; also auto-included in the pickup text if item 6 is built.
- Refund/void: `refunded` status settable manually with a note; do not build Stripe refund UI here.

**Out of scope.** Deposits, split tender across more than one payment row per method, invoice numbering separate from RO number, PDF generation (print CSS is enough).

---

## 2. Tax — DONE

**Status: done (2026-09-03).** Stored as `taxRateBps` + `taxAppliesTo` (`parts` default, `parts_labor`,
`none`), with the round-1 percent fields read as a legacy fallback and converted on next save. The
rate is snapshotted onto each RO at creation (`taxRateBps`, `taxAppliesTo`) so changing the shop rate
never rewrites history; `POST /repair-orders/{id}/apply-tax` re-stamps a stale one. Tax renders on the
RO totals block, the estimate SMS, the public estimate/inspection/receipt pages, and CSV export;
saved-job previews are marked "pre-tax" rather than taxed. A dismissible board banner asks for the
rate when it is unset. Per-customer `taxExempt` was trivial, so it is in. Pre-existing ROs pick up a
snapshot lazily on their next line-item change.
**User problem.** Every estimate, text, public page and CSV export is pre-tax. SC (and most states) tax parts and not labor; Mike files monthly and needs the number.

**Exists today.** `repairOrders.taxTotal` in schema, always 0. No rate anywhere.

**Scope.**
- Settings → Shop: tax rate (percent, 2 decimals) and what it applies to: parts only (default), parts + labor, none. Store as basis points.
- Applied at RO save: `taxTotal = round(taxable subtotal × rate)`. Rate snapshotted onto the RO at creation (`taxRateBps`) so historical ROs don't change if the rate changes. Recompute only when line items change.
- Shown as its own line on: RO totals block, estimate SMS ("Tax: $4.29"), public estimate/inspection/receipt pages, saved-job "~$" previews (mark as pre-tax instead of applying).
- CSV export includes tax columns.
- Onboarding: if state is known, prefill a sensible default rate is **not** required — leave blank and show a one-time banner "Add your sales tax rate so estimates are right" on the board until set.

**Out of scope.** Multiple tax jurisdictions, tax-exempt customers (add a per-customer flag only if trivial), shop-supplies fee taxation rules.

---

## 3. Shop profile in Settings — ALREADY SHIPPED (round-1 QA fixes, 2026-09-03)

**Status: done.** Delivered as part of the QA H3/H4 fixes: Settings → Shop profile now has
name, address, suite, city, state (dropdown), ZIP, shop phone, and timezone (US select +
"Other"), with trim-on-save. Verified in production. Left here for the record; the scope
below is satisfied except *business hours*, which still live only under the booking section —
confirm whether bookable hours should default from a separate shop-hours field or stay as-is.


**User problem.** Shop name, address, phone, hours, and timezone are set once at onboarding (name/city/state only) and can never be changed. Untrimmed name leaks into SMS (QA H3); timezone is wrong (QA H4); receipts and public pages have no shop contact info.

**Exists today.** PLAN.md §9 lists "Shop info, hours" for Settings; not built. `shops` collection exists.

**Scope.**
- Settings → Shop section: name, street, city, state (dropdown), ZIP, shop phone (display number for customers to call — distinct from the Lift texting number), timezone (dropdown, prefilled from state), business hours (reuse the "Bookable hours" grid; booking hours default from these).
- Trim/normalize on save (depends on QA H3 fix).
- Consumed by: SMS templates (name), public booking / estimate / inspection / receipt pages (name, address, phone), booking-window math (timezone, hours), reminders (timezone).

**Out of scope.** Logo upload, multiple locations, custom SMS sender name.

---

## 4. RO history list — DONE

**Status: done (2026-09-03).** New `GET /repair-orders/history` (deliberately separate from the
board-shaped list, which three callers depend on) with `from`/`to`/`status`/`paid`/`q`/`cursor`,
50 per page, sorted on `completedAt ?? updatedAt` behind a new compound index. Page 1 carries a
totals block: count, revenue, collected (summed from payments), outstanding. Page `/ros` with date
presets resolved in shop time, status and paid filters, and search across RO number, customer, plate
and VIN. Nav entry "History" sits between Board and Customers. Board gained a "This month" strip that
links into the matching filter. Global search matches RO numbers. CSV filters were skipped on
purpose — the export is a single all-collections portability zip and filtering only its RO rows would
desync the other files.
**User problem.** Once an RO leaves the board there's no way to find it except the "Recently closed" accordion or the customer page. "You did my brakes in June — what did I pay?" and "how did I do this month?" are both unanswerable.

**Exists today.** Board (`/`), customer page "Recent activity", global search (customers/plates/VINs only, not RO numbers).

**Scope.**
- `/ros` page: table of all ROs, newest first. Columns: RO #, date, customer, vehicle, status, total, paid/unpaid. Filters: date range (presets: today, this week, this month, last month, custom), status, paid state; free-text search across RO number, customer name, plate, VIN. Paginated (cursor), 50/page.
- Totals row for the current filter: RO count, revenue (sum of totals), collected (sum of payments), outstanding.
- Global search also matches RO numbers ("0001" → RO-0001).
- Board gets a small "This month" strip above the columns: ROs closed, collected, outstanding. Tap → `/ros` with month filter.
- Nav entry "History" between Board and Customers.

**Out of scope.** Charts, export from this page (CSV export exists in Settings — add the same filters to it only if cheap), per-tech breakdowns.

---

## 5. Customer history link (tokenized, no login) — DONE

**Status: done (2026-09-03).** `customers.publicToken` minted lazily, rotatable via
`POST /customers/{id}/history-link`; read-only page `/public/account/:token` shows shop contact, the
upcoming booking with its manage link, and each vehicle's past visits with totals, paid state,
mileage where known, and links to that visit's receipt and inspection. Archived vehicles are skipped,
and visits whose vehicle is gone fall into "Other visits" so a receipt never disappears. `noindex`,
token only in the path. The link is appended to the receipt text, and to booking confirmations for
returning customers only — a first-timer's history page would be empty and their confirmation already
carries a URL. Say the word if you want it unconditional.
**User problem.** Customers have no way to see what was done, when, or what they paid. Every link Lift sends is single-purpose and dead-ends.

**Exists today.** Public pages: `/public/estimate/:token`, `/public/inspection/:token`, `/booking/:token`. All per-object.

**Scope.**
- Per-customer public token (`customers.publicToken`, rotatable from the customer page). Page `/public/account/:token` on lift-app: shop name/phone, customer first name, their vehicles, and per vehicle a list of past ROs (date, summary of work, total, paid) each linking to its receipt (item 1) and inspection if one was sent. Upcoming booking shown at top with its manage link.
- Link included in: receipt text, booking confirmation text, and a "Text history link" button on the customer page.
- Read-only. No editing, no messaging from this page (they reply to the SMS thread).
- Token in URL only; no PII in query strings; page sets `noindex`.

**Out of scope.** Logins, passwords, email/SMS verification, self-service profile edits, multiple customers sharing a vehicle.

---

## 6. Status-change texts (ready / picked up) with receipt — DONE

**Status: done (2026-09-03).** Ready/pickup prompts existed from the round-1 QA fixes; this added
`shop.settings.readyTextMode` (`prompt` default | `auto` | `off`), reachable from Settings or the
dialog's "Don't ask again" checkbox, a shop-hours sentence derived from `businessHours`, and a
receipt-flavored pickup text carrying the receipt and history links. Day-before reminders run from a
new hourly `appointmentScan` Lambda that fires at 5 PM shop-local, tracked by
`ro.appointmentReminderSentAt` / `appointmentReminderFor` so a reschedule re-arms it and it cannot
double-send. Bare `C` and `R` replies now work alongside the spelled-out keywords. Automated sends
are tagged so the new inbox rules don't flag them as needing a reply. Auto mode toasts the exact body
it sent with an "Ask me first next time" link, since an SMS can't be recalled.
**User problem.** The product promise is "AI handles your customer texts," but moving an RO to `ready` sends nothing and offers nothing (QA H5). Pickup is the highest-value moment to text.

**Exists today.** Manual "Send estimate", "Send inspection", "Text pay link", free-form inbox. Auto texts: opt-in notice, booking confirmation.

**Scope.**
- On status → `ready`: open the existing review-and-send dialog prefilled: "Hi Dale — your 2013 Ford F-150 is ready. Total $294.50. [pay link if Stripe] We're open until 5 today." Send / Skip. Remember "don't ask again" per shop (setting: auto-send ready texts on/off, default prompt).
- On status → `picked_up` with payment recorded: prefilled receipt text with receipt link (item 1) and history link (item 5).
- On `scheduled` RO the day before `scheduledFor`: reminder text via the existing reminders scheduler ("See you tomorrow at 9:00 AM. Reply C to cancel or R to reschedule" → manage-booking link).
- Log all as `messages` with `aiDrafted=false` unless AI polish used.

**Out of scope.** Fully automatic sends without the shop ever seeing copy (keep the default as prompt-then-send), marketing/review-request texts (deferred v2).

---

## 7. Decline handling and follow-up — DONE

**Status: done (2026-09-03).** The existing path worked end to end; the gaps were that the board had
no decline data, the handler ignored any body and could stamp a decline over an approval, and the
DTO wrongly carried the token. Now: optional customer reason (≤200 chars) on the public decline,
stored and shown to the shop; a system note lands in the customer's thread; the RO shows a red
"Dale declined the $294.50 estimate — text them?" alert with a prefilled follow-up, going grey once
texted (`estimate.declineFollowedUpAt`, also set by any outbound text on that RO); board cards get a
"Declined" badge and the board a "N declined estimates need a reply" banner. Approval clears the
decline block, and re-sending an estimate resets it. **Not done:** inbound SMS has no decline
classification, so a texted "no" isn't recognised; the public inspection page's Decline sends no
reason.
**User problem.** Approval flow was tested; decline was not. A silently declined estimate is a lost job unless Mike notices.

**Exists today.** Public estimate page has a Decline button; `estimate.declinedAt` in schema.

**Scope.**
- Verify the decline path end-to-end (public page → RO → board). Fix anything broken.
- On decline: RO badge "ESTIMATE DECLINED", board card marker, and an inbox item / banner "Dale declined the $294.50 estimate — text them?" with a prefilled follow-up ("Want us to just do the brakes for now?").
- Optional customer reason on the decline page (free text, ≤200 chars) shown to the shop.
- Declined ROs still editable; re-sending a revised estimate clears the declined state.

**Out of scope.** Per-line approve/decline (real feature, but a separate design), automatic discount offers.

---

## 8. Vehicle service history — DONE

**Status: done (2026-09-03).** `mileageIn`/`mileageOut` per RO, prompted optionally at creation
(prefilled from the vehicle's last reading) and on pickup (skippable, chained after the payment and
status-text prompts); `vehicles.mileage` only ever moves forward. Vehicle detail shows a timeline with
per-visit odometer, work-done summary, total and paid state. Reminder inference now prefers a
`reminderCategory` tagged on the job template (new field, selectable in the template form, pre-set on
seven starter templates) and falls back to keyword matching, which previously missed shop shorthand
entirely; reminders record `servicedAt` and `mileageAtService`. Mileage-based triggers stay out of
scope, so mileage is display-only.
**User problem.** "I think the last guy did the plugs" — the vehicle card shows only RO count and spend. The reminders feature (Settings → Service reminders) also depends on knowing what was done at what mileage.

**Exists today.** Vehicle card on customer page: year/make/model, VIN, plate, mileage, RO count, spend. Mileage captured at vehicle creation only.

**Scope.**
- Mileage captured per RO (prompt at RO creation and at `picked_up`; store `mileageIn` / `mileageOut` on the RO; update `vehicles.mileage` from the latest).
- Vehicle detail (expand the card or `/vehicles/:id`): timeline of ROs with date, mileage, line-item descriptions, total, paid. Same data feeds the customer history page (item 5).
- Reminders: when a saved job tagged with a reminder category (oil, tires, brakes…) is on a picked-up RO, create the reminder from that RO's mileage/date. Confirm the existing reminders scheduler reads this; wire it if not.

**Out of scope.** OEM maintenance schedules, mileage-based (vs date-based) reminder triggers, importing history from another system.

---

## 9. Recently closed / board backlog — the first thing that breaks at scale — DONE

**Status: done (2026-09-03).** Capped at the last 10 closed ROs with "See all →" into
`/ros?status=closed`, exactly as the item described, now that item 4 exists. The board itself was not
otherwise changed.
**User problem.** "Recently closed" is a collapsed accordion under the board with no date
filter and no pagination, and it is currently the *only* path from the board to finished
work. At five cars a day it holds ~1,250 ROs after a year. This is the first scale problem a
real shop hits — probably month two, well before anything else on this list.

**Exists today.** Accordion on the board; customer page "Recent activity"; global search.

**Scope.**
- Cap the accordion at the last 10 closed ROs with a "See all →" link into the RO history
  page (item 4). That link is the whole fix; the history page does the work.
- If item 4 is not built yet, at minimum paginate the accordion and add a date-range filter.

**Out of scope.** Rebuilding the board itself — the board is correct. It only shows open
work, so it looks the same in year two as in week one. Do not add closed work to it.

---

## 10. Message inbox at 800 customers — DONE

**Status: done (2026-09-03).** The inbox was previously built client-side: it fetched up to 100
customers and then one conversation request per customer, sorting in the browser. Replaced with a
`Conversation` collection maintained by a `Message` post-save hook (chosen over fields on `Customer`
so hot thread writes don't churn customer records), carrying read state, unread count, needs-reply,
archive and a separate `bumpedAt`. New `GET /messages/inbox` with `filter=needs_reply|unread|all`,
regex search over customer name/phone and message bodies, cursor pagination at 30, plus
read/archive/unarchive routes. UI has a segmented filter (default Needs reply) with counts, search,
unread dots, "Mark done", an archived toggle and Load more. Auto-replied status checks no longer bump
a thread; a failed auto-reply does. Backfill: `scripts/backfillConversations.ts`.
**User problem.** The inbox is a flat list of threads ordered by recency, with no unread
state, no "needs reply", no search, and no way to close or archive a thread. Every customer
who has ever texted stays in the list forever, and auto-replies keep bumping resolved threads
back to the top. For a product whose pitch is "the texts handle themselves," this is the
screen that will feel worst after a year.

**Exists today.** `/messages` Inbox + Reminders tabs; thread view; Draft with AI.

**Scope.**
- Unread state per thread (inbound message since the shop last opened it) and an
  **Unread / Needs reply / All** filter. "Needs reply" = last message is inbound and was not
  auto-answered — that is the queue Mike actually works.
- Search across message bodies and customer names.
- Mark a thread done / archive it; archived threads return to the top on a new inbound.
- Auto-replied threads should not bump to the top unless the reply failed or the message was
  classified as something other than a status check.
- Paginate (cursor); do not load every thread.

**Out of scope.** Team assignment of threads, canned-response library, MMS gallery.

---

## 11. Customer and vehicle records over years — DONE

**Status: done (2026-09-03).** Customer activity and messages are cursor-paginated, grouped by year,
defaulting to the last 12 months with "Show older". Duplicate detection (`lib/findDuplicates.ts`)
matches normalized phone, then last name + first initial, email, or VIN/year-make-model; manual create
returns `possible_duplicates` unless forced and offers Use existing / Create anyway, while booking
only flags `possibleDuplicateOf` and never merges on a name. `POST /customers/{id}/merge` moves
vehicles, repair orders, messages, payments, service reminders and conversations to the survivor,
collapses same-VIN vehicles, keeps the loser's name and number as aliases plus phone history, writes a
thread note, and leaves an alias trail so old links resolve. Vehicles archive via
`POST /vehicles/{id}/archive`, hidden from pickers, booking match and reminders while staying on
historical ROs. All fields are absent-tolerant, so no backfill is needed.
**User problem.** A regular on their fifteenth visit has 60+ messages and 15 ROs on one page
behind "Show 6" expanders with no search and no grouping. Vehicles accumulate (sold cars,
one-time customers) with no archive. Online booking creates near-duplicate customers when the
same person types their name slightly differently, and there is no merge.

**Exists today.** Customer page with Recent activity + Recent messages expanders; vehicle
cards; no archive, no merge, no dedupe.

**Scope.**
- Customer page: paginate activity and messages, group by year, and default to the last 12
  months with "Show older".
- Duplicate detection on customer create (online booking and manual): match on normalized
  phone first, then fuzzy name + vehicle VIN. Offer "Is this the same Dale O'Brien-Reyes?"
  rather than silently merging.
- **Merge customers** (pick a survivor; move vehicles, ROs, messages, payments; keep both
  names as aliases). Irreversible — confirm explicitly.
- **Archive a vehicle** (sold / totalled): hidden from pickers and reminders, still attached
  to its historical ROs.

**Out of scope.** Household/family grouping, company accounts (that is fleet — deferred).

---

## 12. Search and reminders at volume — DONE

**Status: done (2026-09-03).** Global search now caps per group rather than in total, so a common
surname can't crowd out a plate match; group headings carry counts and a "+N more" row into `/customers`
or `/ros`, and archived vehicles are labelled. Reminders gained a due-date filter (overdue, this week,
this month, custom, resolved in shop time), per-status counts on the filter chips, Load more, row
selection with "Select all on this page", and `POST /service-reminders/bulk-dismiss` (max 200, shop
scoped). `SERVICE_REMINDER_STATUS_LABELS` replaces the raw-enum rendering. RO search remains
exact-number-only by design; full-text RO search lives on `/ros`.
**User problem.** Global search returns a flat, ungrouped list — at 800 customers, "Smith"
is a long undifferentiated scroll. The reminders queue (Pending / Sent / Dismissed) has no
pagination and accrues a year of nudges.

**Scope.**
- Group global search results by type (Customers / Vehicles / Repair orders) with counts, and
  make RO numbers searchable ("0142" → RO-0142).
- Paginate reminders; add a date filter; bulk-dismiss.

**Out of scope.** Fuzzy/typo-tolerant search, saved searches.

## Explicitly not doing (keep saying no)
- Customer logins / accounts with passwords
- Fleet or B2B billing, statements, net terms (Dale's "3 trucks" is the pull; resist)
- Parts catalog / pricing lookup
- Native QuickBooks sync (CSV only)
- Anything on the PLAN.md "Explicitly deferred (v2+)" list

## Order of work

**1 → 2 → 4 → 9 → 3 → 5 → 6 → 10 → 7 → 8 → 11 → 12.**

Items 1 and 2 change shared data (payments, tax) that everything after reads — land and
deploy them first. **Item 4 (RO history) moved ahead of item 3**: it is the single highest-value
build here because it answers three separate questions at once — where did that job go, what
did the customer pay, and how did I do this month — and there is no workaround for any of them
today. Item 9 is a two-line change once item 4 exists, so it rides along behind it.

Items 9–12 are the "year two" set, added 2026-09-03 after asking how the UI holds up at five
cars a day for a year. They are not urgent for a shop in week one, and every one of them
becomes urgent somewhere between month two and month twelve. Item 10 (inbox) is the one that
will generate complaints soonest after item 9, because auto-replies keep bumping resolved
threads.

Note that none of items 9–12 require changing the board. The board only ever shows open work,
so it looks the same in year two as in week one — that is the best structural decision in the
product and it should stay that way.
