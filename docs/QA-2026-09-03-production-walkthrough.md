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

## Critical

### C1. Approved estimates are still editable, and the customer's own approval record is rewritten
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

### H3. Deployed fixes don't reach a shop until their second visit
First load after the deploy ran the previous bundle (`index-biQe5qse.js`) while the server
was already serving `index-B2TQ1R_s.js`; one reload picked up the new one. Standard Workbox
precache behavior, but there's no "update available" prompt, so a shop that leaves the PWA
open on a shop tablet can sit on a stale build indefinitely — including through a fix for
something they just reported.

**Fix direction:** `skipWaiting` + `clientsClaim`, or (safer) detect the waiting worker and
show a small "New version — tap to refresh" toast. Also worth confirming `index.html` is
served `no-cache` so the shell revalidates.

---

## Medium

### M1. Changing the shop timezone silently desyncs already-texted appointments
Switching the shop from `America/Chicago` to `America/New_York` re-rendered RO-0002's
booking as **10:00 AM** (stored instant unchanged, label moved) while the confirmation text
already sent to the customer said **9:00 AM**. Correct behavior in isolation, but every shop
that corrects a wrong default hits this on all open scheduled ROs at once.

**Fix direction:** on timezone save, if the shop has scheduled ROs in the future, ask:
"You have 3 upcoming appointments. Keep them at the same clock time (9:00 AM stays 9:00 AM)
or the same instant?" Keep-clock-time is what a shop means. Whichever is chosen, offer to
text affected customers the corrected time.

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

### M3. Public estimate page still missing shop contact and tax
Round 1 added labor hours detail and the shop's city/state (good). Still absent: shop phone
number, any tax line, and an expiry. The phone number is the first thing a customer wants
when they have a question about a quote — right now their only channel is replying to the
text. Depends on the tax work in `FEATURE-GAPS-2026-09-03.md` item 2 for the tax line;
the phone number is available now via the shop profile and can ship immediately.

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
