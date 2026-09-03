# Lift production QA — live-user walkthrough (2026-09-03)

Context for the agent working this list: these are findings from a manual walkthrough of **production** (lift-app.worxel.com + lift.worxel.com) as a brand-new shop owner. Test account `1matwils+agenttest@gmail.com`, shop "Agent Test Garage & Tire", customer Dale O'Brien-Reyes (864-310-0337), RO-0001 and RO-0002. Each item has repro steps and a suggested fix direction; the fix direction is a suggestion, not a spec. Work top-down by severity. Where a fix touches customer-facing SMS text, keep TCPA opt-in language intact.

## Status (2026-09-03, same day)

All 32 items resolved in code on `cycle/10dlc-resubmission` (merge `daeb609` and parents). Work was done by 8 parallel agents grouped by area; `pnpm -r typecheck`, `@lift/web build` and `@lift/marketing build` pass on the merged tree. Nothing has been deployed yet — retest as a whole after `pnpm deploy:dev`.

### Follow-ups before / during retest
- **Deploy:** new Lambda route `POST /repair-orders/{id}/mark-paid`; new shop fields (`phone`, `settings.taxRatePct`, `settings.taxLabor`), RO fields (`estimate.approvedTotal/approvedLineItems/viewedAt`, `payment.method/amountCents/note`), vehicle `plateNormalized`, customer `phoneHistory`, message `kind/automated/deliveryStatus`. All optional; no migration required.
- **Vehicle backfill (once, against prod):** `MONGODB_URI="<MongodbUri secret>" pnpm --filter @lift/api exec tsx scripts/backfillVehicleSearchFields.ts` (dry run), then add `--apply`. Fills `plateNormalized`, uppercases VINs, title-cases ALL-CAPS makes. Search works before the backfill via a JS fallback.
- **Existing shops:** untrimmed names, lowercase states, `America/Chicago` and stale `optInScript` persist until the owner saves the Shop profile once in Settings. For the test shop, do that first.
- **SMS delivery receipts (L6):** done for the dev stage on 2026-09-03. Configuration set `lift-dev-sms-events` has an SNS event destination (TEXT_ALL → `SmsDeliveryTopic`); `sst.config.ts` defaults `SMS_CONFIGURATION_SET` to `lift-<stage>-sms-events`. For a new stage, create the set once:
  ```
  aws pinpoint-sms-voice-v2 create-configuration-set --configuration-set-name lift-<stage>-sms-events
  aws pinpoint-sms-voice-v2 create-event-destination --configuration-set-name lift-<stage>-sms-events \
    --event-destination-name sns-delivery --matching-event-types TEXT_ALL \
    --sns-destination TopicArn=<SmsDeliveryTopic ARN from `aws sns list-topics`>
  ```
- **Prompt versions:** `estimate.v2`, `freeform.v2`.

### Behavior changes worth a look during retest
- Onboarding is now two steps (shop-number step removed).
- Board column badge reads "CHECKED IN" (Mantine Badge uppercases).
- Legacy sessions without the new `lift_session` hint see the login form flash once before redirecting.
- Line-item Undo toast runs 5s on touch; hover pauses it on desktop.

## Critical

### C1. Customer reschedule page is broken (availability range error)
- Where: public `/booking/<token>` page on lift.worxel.com → "Pick a new time"
- Symptom: red banner `Range too wide — max 14 days, got 31`; calendar enables every weekday through month end (ignores 14-day booking window); clicking any day → "No times open that day." Customer cannot move the appointment, but the confirmation SMS tells them to use this link.
- Repro: book via `/book/agent-test-garage` → open manage link from SMS → Pick a new time.
- Fix direction: the reschedule calendar requests a whole-month availability range; the initial booking page requests ≤14 days. Reuse the booking page's range/greying logic.
- **Resolution (2026-09-03):** Fixed. New shared `useSlotWindow` hook (`apps/marketing/src/routes/bookingSlots.ts`) drives both the booking and reschedule calendars with the shop's `horizonDays` window; `GET /public/booking/{token}` now returns `horizonDays`, and slot lookup accepts `exclude=<token>` so the RO being moved doesn't count against its own slot. Verified slot math reads `shop.timezone` + `leadTimeHours`.

### C2. Line items editable after approval; "ESTIMATE APPROVED" badge persists
- Where: RO page after customer approves via public estimate link.
- Symptom: approved $294.50; edited part $65 → $85; total now $314.50, badge still ESTIMATE APPROVED, no warning. Same for add/delete lines.
- Fix direction: snapshot approved total + line set. On change: badge → "Changed since approval · $294.50 approved", offer "Re-send for approval". Consider locking approved lines and requiring a separate approval for added work.
- **Resolution (2026-09-03):** Fixed. Approval snapshots `approvedTotal` + `approvedLineItems` (both public-link and SMS-"yes" paths). Any later line change flips the RO badge to "Changed since approval · $X approved" with a "Re-send for approval" action; re-sending resets approval/decline/viewed state. Legacy approvals without a snapshot are never flagged.

## High

### H1. No way to record a non-Stripe payment
- "picked up" with $294.50 outstanding asks nothing. Customer lifetime spend and vehicle "$ spent" stay $0.00 forever for cash/in-person-card shops. No paid/unpaid state on RO or board, no invoice number, no tax line.
- Fix direction: "Mark paid" (cash / card / check / other, amount) on RO; warn on "picked up" when balance > 0; tax rate in Settings shown on estimate + public page.
- **Resolution (2026-09-03):** Fixed. New `POST /repair-orders/{id}/mark-paid` (cash/card/check/other, amount defaults to balance, reversible). RO header shows Paid·method / Unpaid·$; board cards get a paid mark; picked_up with a balance prompts "Mark paid / Pick up anyway". Tax: `settings.taxRatePct` + "Also tax labor" in Settings; `taxTotal` computed on parts (and labor if enabled) and shown on the RO and public estimate. Invoice reference = RO number. Lifetime spend now accrues for non-Stripe payments.

### H2. Public estimate page crashes to blank before the estimate is sent
- The Review-estimate dialog shows the public URL before Send. Opening it pre-send → API 401 → `TypeError: Cannot read properties of undefined (reading 'approvedAt')` in `index-biQe5qse.js` → blank white page. Same URL works after send.
- Fix: handle 401 on the public estimate page ("This estimate isn't ready yet" / "link expired") and null-guard `approvedAt`.
- **Resolution (2026-09-03):** Fixed. `GET /public/estimate/{token}` returns 404 `estimate_not_sent` pre-send; the public page has explicit not-ready / invalid-link / server-error states and null-guards throughout. Approve/decline also match `estimate.publicToken`, which fixes approval from the inspection page.

### H3. Shop name stored untrimmed; padded whitespace leaks into every SMS
- Entered shop name with leading/trailing spaces at onboarding. Saved verbatim. Opt-in SMS: `"  Agent Test Garage & Tire   via Worxel Lift: …"`; booking SMS: `"…at   Agent Test Garage & Tire  . Confirmation…"`. Settings has no shop-name field, so the owner can't fix it.
- Fix: trim + collapse whitespace on save for shop name/city/state/customer names; add editable shop profile (name, address, phone, timezone) in Settings.
- **Resolution (2026-09-03):** Fixed. Shop name/address DTOs trim + collapse whitespace; saving a new name regenerates `sms.optInScript` (TCPA wording unchanged). Settings gains a Shop profile section (name, address, city, state, ZIP, phone, timezone). Existing shops need one Settings save (or a one-off script) to clean stored values.

### H4. Shop timezone defaults to America/Chicago for a Greer, SC shop; not editable
- "Schedule visit" dialog shows `Shop time (America/Chicago)`. No timezone in Settings. Booking page greyed out all of today at 3:40 PM ET despite 2h lead time and a 4 PM slot.
- Fix: derive from state at onboarding (or ask), expose in Settings, use in booking-window math.
- **Resolution (2026-09-03):** Fixed. Timezone derived from state at onboarding (`resolveShopTimezone`, browser zone as tiebreaker for split states), editable in Settings via a US zone select + "Other". Booking slots and the Schedule-visit dialog already read `shop.timezone`.

### H5. Status → "ready" (and "picked up") sends nothing and offers nothing
- Changing status is silent: no toast, no "Text Dale it's ready?" prompt, nothing in the message thread. Only automated texts observed: opt-in notice and booking confirmation.
- Suggest: on ready/picked-up, one-tap prefilled "Your F-150 is ready — $294.50 due" (+ pay link when Stripe connected).
- **Resolution (2026-09-03):** Fixed. Every status change toasts. Ready / Picked up open a one-tap, editable prefilled text (amount line omitted at $0, pay link appended when Stripe Connect charges are enabled), sent through the normal message path so it lands in the thread. Never auto-sends.

### H6. Editing a customer's phone number never sends the opt-in notice to the new number
- Consent text went to the original number on creation only. After edit, estimate/inspection/booking texts went to the new number with no opt-in.
- Fix: re-send consent message on phone change; mark old thread as re-numbered.
- **Resolution (2026-09-03):** Fixed. Phone change on PATCH re-sends the exact existing opt-in text to the new number (skipped if the customer has opted out), rejects numbers owned by another customer, records `phoneHistory`, and drops a system note into the thread. Customer/vehicle free-text fields are also trimmed.

## Medium

### M1. AI "Polish with AI" invented a symptom
- RO had no concern. Polished estimate said "…lubricating the slides **to fix the noise**". Also dropped itemized prices and the "Approve:" label before the link.
- Fix: only reference the RO concern if present; keep line items and the approve label; add a guardrail prompt ("do not add symptoms/claims not in the source").
- **Resolution (2026-09-03):** Fixed. Prompt `estimate.v2`: the model writes only the opener, receives the concern (or "none") and is forbidden from adding symptoms/claims; the itemized lines, total and `Approve:` link are assembled in code, with a fallback to the plain template if anything is missing.

### M2. Inbox "Draft with AI" ignores open RO state
- Vehicle in shop on an open, approved RO; draft said "quick check-in on your recent visit… running smoothly". Feed RO status/estimate state into the prompt.
- **Resolution (2026-09-03):** Fixed. Prompt `freeform.v2` (new `prompts/freeform.ts`) gets a "current situation" block: open ROs with vehicle, status, estimate state, appointment, total, plus the last 6 thread messages and per-status guidance.

### M3. Line-item delete is instant, no confirm/undo
- Trash icon deletes immediately. Mobile: edit/delete icons ~30px apart. Suggest 5s Undo toast.
- **Resolution (2026-09-03):** Fixed. Delete hides the row and shows a 5s Undo toast; the DELETE fires only when the toast closes or the editor unmounts. Edit/delete icons are 44px with wider spacing on small screens.

### M4. Plate search only matches from the start of the stored string
- Plate stored `SC KLM-4471`. Global search `KLM-4471` and `klm4471` → No matches; only `SC KLM-4471` matches. VIN partial search works.
- Fix: normalize plates (uppercase, strip spaces/dashes) on save and search; substring match.
- **Resolution (2026-09-03):** Fixed. Vehicles store `plateNormalized` (indexed with shopId); lookup and customer search do substring matches on it, and still normalize legacy rows in JS until the backfill runs (see Follow-ups).

### M5. Customers list: no-match search shows "No customers yet / Add your first customer"
- Should be "No customers match '<query>'" + add link.
- **Resolution (2026-09-03):** Fixed. Shows "No customers match “<query>”." with an Add a customer link.

### M6. State field truncates silently; lowercase leaks to public booking page
- Typing "south carolina" → `so` (maxlength 2, no feedback). `sc` saved lowercase → booking page header "Greer, sc".
- Fix: state dropdown, or uppercase + validate against state codes.
- **Resolution (2026-09-03):** Fixed. Searchable state select in onboarding and Settings; DTO uppercases and validates against US state codes.

### M7. New RO defaults to "Existing customer"/"Existing vehicle" when there are none
- Brand-new shop: step 1 opens on empty search ("No customers match — try a new customer"), step 2 on "No vehicles on file — add one" with New unselected. Default to New when the list is empty.
- **Resolution (2026-09-03):** Fixed. New RO defaults to New customer when the list is empty, and vehicle mode re-seeds per customer (New when they have no vehicles).

### M8. Negative hours accepted as 0, creates $0.00 labor line
- Hours `-1` @ $135 → "0h @ $135.00/hr · $0.00", no validation. Reject negatives / zero-hour labor.
- **Resolution (2026-09-03):** Fixed. `hours` and `qty` must be positive in the shared line-item DTO (server-enforced); editor shows inline errors.

### M9. Status dropdown and badges show raw enum values
- "in", "ready", "picked up", "cancelled by customer"; board column titled "IN". Add a label map ("Checked in", "Ready for pickup").
- **Resolution (2026-09-03):** Fixed. `RO_STATUS_LABELS` in shared constants, used on the board, RO select/badge, customer detail and vehicle timeline.

### M10. Estimate has no sent/viewed/approved indicator on the RO
- Inspection card gets `SENT · VIEWED` chip; estimate button looks identical before/after send. Add "Sent 3:55 PM · Approved 3:56 PM".
- **Resolution (2026-09-03):** Fixed. Estimate gets `viewedAt` on first public open; RO page shows "Estimate sent … · viewed … · approved …" in shop time.

### M11. Onboarding step 2 shows no shop number; step 3 says "Next: card" after "no card"
- Login page: "No password, no card." Step 2 is an info box + "Next: card"; step 3 leads with "Add card & start trial", "Skip" is secondary. No Back button. Either show/pick the number or drop the step; make Skip equal weight during trial.
- **Resolution (2026-09-03):** Fixed. The empty shop-number step was dropped (two steps now), Back button added, "Skip for now" and "Add card" are equal weight, step 1 says "Next: start trial".

### M12. Send-inspection copy stale once estimate is already approved
- Default text says "you can approve right from the page" and "Include estimate" is on by default post-approval. Vary template by approval state.
- **Resolution (2026-09-03):** Fixed. Send-inspection copy and the Include-estimate default vary by approval state; sending an inspection with the estimate embedded marks the estimate sent.

## Low / polish

- L1. lift.worxel.com "Start trial" CTAs hardcode `utm_source=cold-email&utm_medium=email&utm_campaign=2026-q2-lift-launch` for all visitors — organic signups misattributed.
  - **Resolution (2026-09-03):** Fixed. CTAs forward the visitor's own `utm_*` params; without any they use `utm_source=lift.worxel.com&utm_medium=organic`.
- L2. VIN stored/displayed lowercase (`1ftfw1et5dfc10312`) in app, SMS and public pages; NHTSA make shown ALL CAPS ("FORD"). Uppercase VIN, title-case make. Decode leaves Engine/Trim blank though NHTSA returns displacement.
  - **Resolution (2026-09-03):** Fixed. VINs uppercased at the DTO and in the input; NHTSA make title-cased (keeps GMC/BMW/RAM/MINI); engine built from displacement + cylinders, trim falls back to Series. Backfill script covers existing rows.
- L3. Public booking form: required-field errors just repeat the label ("Vehicle year", "Make", "Model") instead of "Required". Phone reformatted in-field to `+18643100337`; show (864) 310-0337.
  - **Resolution (2026-09-03):** Fixed. Empty required fields say "Required" with specific copy for malformed year/phone; phone displays as (864) 310-0337 on blur and still submits E.164.
- L4. Public booking page `<title>` is the marketing site's ("Lift — Stay in the bay…"); should be "Book · <shop name>".
  - **Resolution (2026-09-03):** Fixed. `/book/:slug` → "Book · <shop>", `/booking/:token` → "Your appointment · <shop>".
- L5. Default labor rate blank in Settings while starter jobs are $135/hr; add-line-item Rate field opens empty. Seed at onboarding and use as default.
  - **Resolution (2026-09-03):** Fixed. Onboarding asks for labor rate (default $135) and seeds `settings.defaultLaborRate`; new line-item rows open at the shop rate.
- L6. Message thread has no delivery status (opt-in text to fictional 555 number shows no failed marker). Outbound opt-in and booking texts tagged `AUTO-REPLIED`, which reads as a customer reply.
  - **Resolution (2026-09-03):** Fixed in code. Messages carry `automated` (opt-in, booking, reminders) vs `autoReplied` (real AI replies) and a `deliveryStatus`; thread shows "Automated", "Delivered", or red "Not delivered". Failed opt-in sends are recorded instead of vanishing. Delivery receipts need the End User Messaging configuration set described in Follow-ups.
- L7. Verify-email link lands on board with banner gone but no "Email confirmed" toast. Board shows "Loading…" text ~2s on every load; app root shows bare spinner ~3s before login form.
  - **Resolution (2026-09-03):** Fixed. "Email confirmed" toast after verify; board renders skeletons and a per-shop cached snapshot instead of "Loading…"; the login form renders immediately when there is no session hint.
- L8. Global search result shows raw E.164 (`+18645550142`) while all other screens show formatted.
  - **Resolution (2026-09-03):** Fixed. Global search uses `formatPhone`.
- L9. Booking slug: auto-slugify ("Agent Test Garage" → `agent-test-garage`) instead of rejecting; the validation message itself is good.
  - **Resolution (2026-09-03):** Fixed. Slug auto-slugifies as you type and on save (client and DTO); the existing validation message stays for genuinely invalid results.
- L10. Accessibility: hamburger, wizard step circles, starter-job checkboxes (name "on"), Decode VIN (unlabelled while loading), several icon buttons have no accessible name; shop-name input labelled only by placeholder.
  - **Resolution (2026-09-03):** Fixed. aria-labels on the hamburger, stepper steps, Decode VIN, conversation back button; starter checkboxes get name/value/aria-label; shop-name input gets id/name.
- L11. Empty concern accepted at RO creation; RO page then has no Concern section, so it can't be added later. (RO-0002 from booking shows concern fine.)
  - **Resolution (2026-09-03):** Fixed. Concern and Diagnosis cards are always present with inline Add/Edit editors.
- L12. Public estimate page lacks shop phone/address, labor hours detail, tax note, expiry.
  - **Resolution (2026-09-03):** Fixed. Public estimate shows shop name/phone/address, labor hours @ rate, parts qty × unit, and a tax line when tax > 0. No expiry invented (there is no expiry concept).

## Worked well (don't regress)
- Passwordless signup → setup → board in <2 min; starter-jobs picker; saved jobs two-tap apply.
- VIN decode; phone normalization `(864) 555-0142`; mileage `142,350` accepted.
- Estimate approve → RO auto-advances to "in repair" with badge.
- Online booking matched existing customer AND vehicle by phone + VIN.
- "Text pay link" without Stripe → clear setup prompt.
- Inspection `SENT · VIEWED`; clean public inspection page.
- Mobile (375px) board and RO layouts; line-item math correct throughout.

## Not tested
- Inbound SMS / auto-reply ("is my car ready"), sign-out/re-login, team invite, Stripe connect, photo upload, voice dictation, CSV export, Manage billing.
