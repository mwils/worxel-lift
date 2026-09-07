# Lift production QA — open issues (round 2)

Last updated 2026-09-03, 8:15 PM ET. This file was cleared and rewritten after the round-1
fix deploy; the round-1 findings and their verification results are in git history
(`git log --follow docs/QA-2026-09-03-production-walkthrough.md`).

Context for the agent working this: these are the issues **still open** after re-testing
production (`lift-app.worxel.com`, bundle `index-B2TQ1R_s.js`) as a live user. Test shop
"Agent Test Garage & Tire" (Eastern, SC), customer Dale O'Brien-Reyes (864) 310-0337,
RO-0001 (picked up, paid) and RO-0002 (ready for pickup, $132.00).

Work top-down by severity. Before changing anything, find the code path and say in 2–3
sentences what's actually causing it; if the suggested fix is wrong given the code, say so
and propose the right one. Follow CLAUDE.md conventions (shared Zod DTOs, `shopId` from
session, money in cents, `withAuth`/`withErrorBoundary`). Anything touching customer-facing
SMS must keep the opt-in / STOP / HELP language intact and show before/after copy.
When an item is done, append "— FIXED (branch qa/...)" to its heading.

---

## Status — round 2 complete (2026-09-03, later same day)

All six open items (C1, H1–H3, M1–M3) are resolved on `qa/round-2-2026-09-03`, along with every
capability gap in `FEATURE-GAPS-2026-09-03.md`. `pnpm -r typecheck`, `@lift/web build` and
`@lift/marketing build` are clean on the merged tree. Not yet deployed — retest as a whole after
`pnpm deploy:dev`.

### Run these backfills once against the target stage before retesting
Dry run first (no `--apply`), then repeat with `--apply`:
```
MONGODB_URI="<MongodbUri secret>" pnpm --filter @lift/api exec tsx scripts/backfillPayments.ts
MONGODB_URI="…" pnpm --filter @lift/api exec tsx scripts/backfillEstimateSnapshots.ts
MONGODB_URI="…" pnpm --filter @lift/api exec tsx scripts/backfillConversations.ts
MONGODB_URI="…" pnpm --filter @lift/api exec tsx scripts/backfillVehicleSearchFields.ts   # from round 1, if not yet run
```
- `backfillPayments` creates a `Payment` row from each RO's existing `payment` block. **RO-0001 will
  correctly become `PARTIAL · $94.50 due`.**
- `backfillEstimateSnapshots` snapshots approved ROs that predate the snapshot code. RO-0001's
  snapshot will be its current $294.50 lines, which is what Dale actually approved.
- `backfillConversations` builds the new inbox thread rows; without it the inbox looks empty.
  Existing history is treated as read, but "needs reply" is computed honestly.

### Behavior changes to expect during retest
- Board gains a "This month" strip (closed / collected / outstanding) and a "History" nav entry
  (`/ros`). "Recently closed" is capped at 10 with "See all →".
- The inbox defaults to a **Needs reply** filter, so a quiet shop's inbox can look empty at first —
  switch to All. Auto-replied status checks no longer bump threads.
- A short payment now reads `PARTIAL · CASH · $200.00 of $294.50` with "$94.50 due". Writing off the
  remainder is an explicit checkbox that adds a negative "Discount" line.
- Ready texts still prompt by default; "Don't ask again" in the dialog is the only path to auto-send.
- A day-before appointment reminder now goes out around 5 PM shop-local.
- First load after the deploy may still show the old bundle once; from then on the update toast handles it.

### Known follow-ups (not blockers)
- Line-locking on approved estimates awaits Matthew's decision (see C1).
- Inbound SMS has no "no"/decline classification, so a texted decline isn't recognised.
- Editing a negative "Discount" line fails DTO validation; deleting it works.
- Ready/pickup copy uses an em-dash, which forces UCS-2 SMS encoding and shortens segments. Dropping
  it repo-wide is a house-style call.
- CSV export has no date/status filters (deliberately skipped — the export is an all-collections zip).

## Critical

### C1. Approved estimates are still editable, and the customer's own approval record is rewritten — FIXED (branch qa/round-2-2026-09-03)
*(carried over from round 1 as C2 — the fix did not land, and the defect is worse than first reported)*

**Repro**
1. RO-0001, customer approved at $294.50 via the public estimate link.
2. Edit the "Front brake pad set" line, $65.00 → $85.00, save.
3. RO total becomes $314.50. The badge still reads a plain green **ESTIMATE APPROVED**.
   The "Estimate sent … viewed … approved …" line still shows the original approval time
   with no indication anything changed.
4. Open the public estimate link the customer already has. It now renders
   **`Total $314.50`** directly above **"Approved — thanks! (Sep 3, 3:55 PM)"**.

**Why this is critical.** Step 4 is the dispute scenario: the customer's own record of what
they agreed to is silently rewritten to a number they never saw. Step 3 alone is a trust
problem; step 4 is a chargeback.

**Fix direction**
- Snapshot the approved state on approval: total, and the line set (description, qty/hours,
  unit price/rate, line total) — not just a number.
- The public estimate page must render **the snapshot**, not live lines, once `approvedAt`
  is set. Add a line like "Approved Sep 3 at 3:55 PM" and, if the RO has since changed,
  "The shop has since updated this estimate — they'll send a new one to approve."
- On the RO, when live lines differ from the snapshot: badge becomes
  **"Changed since approval · $294.50 approved"** (amber, not green) and the primary action
  becomes **"Re-send for approval"**.
- Re-sending replaces the snapshot and clears the changed state.
- Consider (ask before building): lock approved lines from edit entirely and require added
  work to go on as new lines needing their own approval. That's the ShopMonkey/Tekmetric
  behavior and it's what a shop owner expects, but it's a bigger change — flag it and let
  Matthew decide.

**Resolution.** Root cause was two-part. The round-1 snapshot code shipped, but `estimateChangedSinceApproval` returned false whenever the snapshot was absent, so RO-0001 (approved before that deploy) could never flip to amber; separately `GET /public/estimate/{token}` returned live line items regardless of `approvedAt`, and the page rendered them. Now: the approval snapshot stores per-line hours/rate/qty/unit price plus `approvedTaxTotal`; the public estimate and inspection pages substitute the snapshot for live numbers once approved and show "Approved Sep 3 at 3:55 PM" in shop time, plus "The shop has since updated this estimate — they'll send a new one to approve." when it has changed. Legacy approvals are healed on first read (`ensureApprovalSnapshot`) and in bulk by `scripts/backfillEstimateSnapshots.ts`. The RO badge goes amber "Changed since approval · $294.50 approved" with "Re-send for approval" as the primary action, and the trail gains "· changed <time>" from a new `lineItemsChangedAt`. **Line-locking was not built** — the doc asked for a decision first. Proposal for Matthew: reject PATCH/DELETE on line ids present in `approvedLineItems` (409), allow new lines but mark them `pendingApproval` and exclude them from the approved total, turn the action into "Send added work for approval", and grey locked rows with an "Unlock & re-send" escape hatch. Roughly a day's work.

---

## High

### H1. A short payment is recorded as payment in full — FIXED (branch qa/round-2-2026-09-03)
**Root cause:** `POST /repair-orders/{id}/mark-paid` wrote only `ro.payment.{status:"paid",
amountCents}` and never a `Payment` row (the model required a unique
`stripePaymentIntentId`), so "paid" was a flag, not a sum, and any amount flipped it.
**Fix:** `Payment` rows are the source of truth (manual rows: `method`, `note`,
`recordedByUserId`, `paidAt`; `stripePaymentIntentId` now optional, sparse unique). The RO's
`payment.{status,collectedCents}` is derived from the rows; `balanceCents = total − collected`;
`PAYMENT_STATUSES` gains `partial`. RO-0001 reads `PARTIAL · CASH · $200.00 of $294.50 /
$94.50 due`; a second Mark paid settles it. The dialog's "Write off the rest ($94.50)"
checkbox adds a negative `fee` line "Discount" — never inferred. Undo/refund are per payment
row (`POST /repair-orders/{id}/payments/{paymentId}/void`, `kind: void | refund`). Backfill
for round-1 ROs (dry run, then `--apply`):
`MONGODB_URI=… pnpm --filter @lift/api exec tsx scripts/backfillPayments.ts`. Read paths
tolerate un-backfilled ROs (collected = `amountCents ?? total`).

The Mark paid dialog accepts an amount less than the balance, warns
*"$94.50 less than the total — fine if you knocked something off. The RO still closes as
paid,"* and then sets the RO to `PAID · CASH`.

**Repro:** RO-0001 ($294.50 balance) → Mark paid → Cash → amount $200.00 → note
"Partial — cash at counter, balance Friday" → Mark paid → RO shows `PAID · CASH`, no balance
anywhere.

**Why it matters.** Two different real situations collapse into one state. "I knocked $20
off" and "half now, half Friday" are not the same event, and today the second one silently
forgives $94.50. A 1–3 bay shop carrying a couple of these a month has no way to find them.

**Fix direction**
- Sum `payments` for the RO. If collected < total, the RO is **`PARTIAL · $94.50 due`**, not
  paid; keep it out of "closed" reporting until settled. Allow a second Mark paid to clear it.
- If the shop genuinely discounted, that should be an explicit action — either a
  "Discount / write off the rest" checkbox in the dialog that records a negative line item
  (so the RO total and the collected amount agree and the books are clean), or a separate
  "Write off $94.50" control. Do not infer a discount from a short amount.
- Keep the current copy's honesty ("Recording this here doesn't move any money") — it's good.

### H2. Lifetime spend and vehicle spend sum RO totals, not payments — FIXED (branch qa/round-2-2026-09-03)
**Root cause:** `customers/history.ts` and `vehicles/history.ts` aggregated
`$cond[payment.status == "paid", $total, 0]` over repair orders — the RO total, gated by the
H1 flag. **Fix:** both sum `payments` rows (`status: "succeeded"`, per customer / per
`vehicleId`, which is now denormalized onto the row), plus a legacy fallback for round-1 ROs
until the backfill runs. `GET /repair-orders/{id}` and the list endpoint expose
`collectedCents` / `balanceCents` / `payments[]` for the RO history page.

After collecting $200.00 against a $294.50 RO, the customer header reads **Lifetime spend
$294.50** and the vehicle card reads **$294.50 spent**.

**Fix direction:** both figures should sum the `payments` collection for that customer /
vehicle. This is the same underlying model change as H1 — do them together. Any revenue
figure surfaced later (the RO history totals row in the feature-gaps doc) must use payments
too, or the shop's monthly number will overstate every time a payment is short.

### H3. Deployed fixes don't reach a shop until their second visit — FIXED (branch qa/round-2-2026-09-03)
First load after the deploy ran the previous bundle (`index-biQe5qse.js`) while the server
was already serving `index-B2TQ1R_s.js`; one reload picked up the new one. Standard Workbox
precache behavior, but there's no "update available" prompt, so a shop that leaves the PWA
open on a shop tablet can sit on a stale build indefinitely — including through a fix for
something they just reported.

**Fix direction:** `skipWaiting` + `clientsClaim`, or (safer) detect the waiting worker and
show a small "New version — tap to refresh" toast. Also worth confirming `index.html` is
served `no-cache` so the shell revalidates.

**Resolution.** Root cause: `registerType: "autoUpdate"` plus a single `registerSW({ immediate: true })` call at load meant the app only ever checked for a new worker on startup, while Workbox served the precached old shell; SST also served `sw.js` and the manifest as immutable for a year. Now the app registers in `prompt` mode with a persistent "New version available — Refresh" toast (`features/pwa/UpdatePrompt.tsx`), re-checks hourly and whenever the tab becomes visible, and `sst.config.ts` sets `assets.fileOptions` so HTML, `sw.js`, `registerSW.js` and the manifest are `no-cache` while hashed assets stay immutable. Takes effect on the next deploy.

---

## Medium

### M1. Changing the shop timezone silently desyncs already-texted appointments — FIXED (branch qa/round-2-2026-09-03)
Switching the shop from `America/Chicago` to `America/New_York` re-rendered RO-0002's
booking as **10:00 AM** (stored instant unchanged, label moved) while the confirmation text
already sent to the customer said **9:00 AM**. Correct behavior in isolation, but every shop
that corrects a wrong default hits this on all open scheduled ROs at once.

**Fix direction:** on timezone save, if the shop has scheduled ROs in the future, ask:
"You have 3 upcoming appointments. Keep them at the same clock time (9:00 AM stays 9:00 AM)
or the same instant?" Keep-clock-time is what a shop means. Whichever is chosen, offer to
text affected customers the corrected time.

**Resolution.** Root cause: `PATCH /shop` set the timezone blindly, and every label derives wall-clock from `shop.timezone` at render time, so all upcoming visits re-labelled while the customer's sent text kept the old clock. Now a timezone change with future scheduled ROs opens a modal asking to keep the same clock time (default) or the same instant; keep-clock re-anchors each `scheduledFor` via luxon `keepLocalTime`. When the instant did change, a single confirmation sends corrected times through `POST /shop/appointment-notices` (never automatically): "Correction from Mike's Auto: your visit is Thu Sep 10 at 10:00 AM (not 9:00 AM). Need to change it? <manage link>".

### M2. The PAID pill shows method but not amount collected — FIXED (branch qa/round-2-2026-09-03)
**Root cause:** the badge rendered only `payment.method`; `amountCents` and `note` were
saved but never read back. **Fix:** pill reads `PAID · CASH · $294.50` /
`PARTIAL · CASH · $200.00 of $294.50` (+ "$94.50 due"), latest note under it, and a new
Payments card on the RO lists every row (method, amount, date, note, undone/refunded) with
Collected / Balance. Board `PaidMark` shows `Partial · $X due`. Public receipt page
`/public/receipt/:token` + "Text receipt" button (via `POST /messages/send`).

Reads `PAID · CASH`. With H1 fixed this should read `PAID · CASH · $294.50`, or
`PARTIAL · CASH · $200.00 of $294.50`. The payment note ("Check #1042…") is captured but
isn't visible anywhere on the RO after saving — surface it near the pill or in the payment row.

### M3. Public estimate page still missing shop contact and tax — FIXED (branch qa/round-2-2026-09-03)
Round 1 added labor hours detail and the shop's city/state (good). Still absent: shop phone
number, any tax line, and an expiry. The phone number is the first thing a customer wants
when they have a question about a quote — right now their only channel is replying to the
text. Depends on the tax work in `FEATURE-GAPS-2026-09-03.md` item 2 for the tax line;
the phone number is available now via the shop profile and can ship immediately.

**Resolution.** Shop phone was being read from `shop.sms.phoneNumber` (the texting number, unset for this shop) rather than the front-desk `shop.phone` added in round 1. The public estimate now shows "Questions? Call <shop> at (864) …" as a `tel:` link, with an `sms:` fallback. The tax line always renders when the shop's rate is above zero, labelled "Tax (parts)" or "Tax" per the applies-to setting, and the estimate SMS carries a "Tax:" line. **No expiry was added** — there is no `estimate.expiresAt` concept and the doc said not to invent one.

---

## Verified fixed in round 1 — do not regress

Re-tested against production and confirmed working. Listed so this round's changes don't
undo them.

- Public reschedule page (no range error, slots load, move persists, confirmation text sent)
- Mark paid dialog exists with Cash / Card / Check / Other, amount, note, and Undo mark paid
- Pre-send public estimate link shows "This estimate isn't ready yet" instead of a blank page
- Shop name trimmed; new outbound texts have no padded whitespace
- Shop profile in Settings (name, address, city, state dropdown, ZIP, phone, timezone)
- Status → Ready prompts "Text Dale it's ready?" with prefilled copy and a Not now option
- Phone change re-sends the opt-in **and** writes an audit NOTE row recording old → new
- AI polish no longer invents symptoms; keeps line items and the "Approve:" label; adds
  "Use my version" to revert
- Plate search matches `klm4471` against `SC KLM-4471`
- Customer search no-match shows "No customers match "…"" instead of the empty state
- Status labels read "Checked in" / "Ready for pickup" instead of raw enums
- Estimate sent / viewed / approved timestamps shown on the RO
- VIN uppercase, make title-cased ("2013 Ford F-150")
- Booking page title is "Your appointment · <shop>"
- Automated sends tagged AUTOMATED rather than AUTO-REPLIED
- "Add concern" available on an RO created without one

## Not yet tested (unchanged from round 1)
Inbound SMS / auto-reply ("is my car ready" from the customer side), sign-out/re-login,
team invite, Stripe connect, photo upload, voice dictation, CSV export, Manage billing,
estimate decline path.

## Test data currently in the account
- RO-0001 — picked up, `PAID · CASH`, $200.00 collected against $294.50, payment note
  "Partial — cash at counter, balance Friday". Pad set line reverted to $65.00.
- RO-0002 — Ready for pickup, $132.00 (oil-change saved job), scheduled Wed Sep 9 2:00 PM.
- Dale O'Brien-Reyes — (864) 310-0337 restored; thread contains two extra opt-in notices and
  a phone-change NOTE from H6 testing.
