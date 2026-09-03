# Lift production QA — live-user walkthrough (2026-09-03)

Context for the agent working this list: these are findings from a manual walkthrough of **production** (lift-app.worxel.com + lift.worxel.com) as a brand-new shop owner. Test account `1matwils+agenttest@gmail.com`, shop "Agent Test Garage & Tire", customer Dale O'Brien-Reyes (864-310-0337), RO-0001 and RO-0002. Each item has repro steps and a suggested fix direction; the fix direction is a suggestion, not a spec. Work top-down by severity. Where a fix touches customer-facing SMS text, keep TCPA opt-in language intact.

## Critical

### C1. Customer reschedule page is broken (availability range error)
- Where: public `/booking/<token>` page on lift.worxel.com → "Pick a new time"
- Symptom: red banner `Range too wide — max 14 days, got 31`; calendar enables every weekday through month end (ignores 14-day booking window); clicking any day → "No times open that day." Customer cannot move the appointment, but the confirmation SMS tells them to use this link.
- Repro: book via `/book/agent-test-garage` → open manage link from SMS → Pick a new time.
- Fix direction: the reschedule calendar requests a whole-month availability range; the initial booking page requests ≤14 days. Reuse the booking page's range/greying logic.

### C2. Line items editable after approval; "ESTIMATE APPROVED" badge persists
- Where: RO page after customer approves via public estimate link.
- Symptom: approved $294.50; edited part $65 → $85; total now $314.50, badge still ESTIMATE APPROVED, no warning. Same for add/delete lines.
- Fix direction: snapshot approved total + line set. On change: badge → "Changed since approval · $294.50 approved", offer "Re-send for approval". Consider locking approved lines and requiring a separate approval for added work.

## High

### H1. No way to record a non-Stripe payment
- "picked up" with $294.50 outstanding asks nothing. Customer lifetime spend and vehicle "$ spent" stay $0.00 forever for cash/in-person-card shops. No paid/unpaid state on RO or board, no invoice number, no tax line.
- Fix direction: "Mark paid" (cash / card / check / other, amount) on RO; warn on "picked up" when balance > 0; tax rate in Settings shown on estimate + public page.

### H2. Public estimate page crashes to blank before the estimate is sent
- The Review-estimate dialog shows the public URL before Send. Opening it pre-send → API 401 → `TypeError: Cannot read properties of undefined (reading 'approvedAt')` in `index-biQe5qse.js` → blank white page. Same URL works after send.
- Fix: handle 401 on the public estimate page ("This estimate isn't ready yet" / "link expired") and null-guard `approvedAt`.

### H3. Shop name stored untrimmed; padded whitespace leaks into every SMS
- Entered shop name with leading/trailing spaces at onboarding. Saved verbatim. Opt-in SMS: `"  Agent Test Garage & Tire   via Worxel Lift: …"`; booking SMS: `"…at   Agent Test Garage & Tire  . Confirmation…"`. Settings has no shop-name field, so the owner can't fix it.
- Fix: trim + collapse whitespace on save for shop name/city/state/customer names; add editable shop profile (name, address, phone, timezone) in Settings.

### H4. Shop timezone defaults to America/Chicago for a Greer, SC shop; not editable
- "Schedule visit" dialog shows `Shop time (America/Chicago)`. No timezone in Settings. Booking page greyed out all of today at 3:40 PM ET despite 2h lead time and a 4 PM slot.
- Fix: derive from state at onboarding (or ask), expose in Settings, use in booking-window math.

### H5. Status → "ready" (and "picked up") sends nothing and offers nothing
- Changing status is silent: no toast, no "Text Dale it's ready?" prompt, nothing in the message thread. Only automated texts observed: opt-in notice and booking confirmation.
- Suggest: on ready/picked-up, one-tap prefilled "Your F-150 is ready — $294.50 due" (+ pay link when Stripe connected).

### H6. Editing a customer's phone number never sends the opt-in notice to the new number
- Consent text went to the original number on creation only. After edit, estimate/inspection/booking texts went to the new number with no opt-in.
- Fix: re-send consent message on phone change; mark old thread as re-numbered.

## Medium

### M1. AI "Polish with AI" invented a symptom
- RO had no concern. Polished estimate said "…lubricating the slides **to fix the noise**". Also dropped itemized prices and the "Approve:" label before the link.
- Fix: only reference the RO concern if present; keep line items and the approve label; add a guardrail prompt ("do not add symptoms/claims not in the source").

### M2. Inbox "Draft with AI" ignores open RO state
- Vehicle in shop on an open, approved RO; draft said "quick check-in on your recent visit… running smoothly". Feed RO status/estimate state into the prompt.

### M3. Line-item delete is instant, no confirm/undo
- Trash icon deletes immediately. Mobile: edit/delete icons ~30px apart. Suggest 5s Undo toast.

### M4. Plate search only matches from the start of the stored string
- Plate stored `SC KLM-4471`. Global search `KLM-4471` and `klm4471` → No matches; only `SC KLM-4471` matches. VIN partial search works.
- Fix: normalize plates (uppercase, strip spaces/dashes) on save and search; substring match.

### M5. Customers list: no-match search shows "No customers yet / Add your first customer"
- Should be "No customers match '<query>'" + add link.

### M6. State field truncates silently; lowercase leaks to public booking page
- Typing "south carolina" → `so` (maxlength 2, no feedback). `sc` saved lowercase → booking page header "Greer, sc".
- Fix: state dropdown, or uppercase + validate against state codes.

### M7. New RO defaults to "Existing customer"/"Existing vehicle" when there are none
- Brand-new shop: step 1 opens on empty search ("No customers match — try a new customer"), step 2 on "No vehicles on file — add one" with New unselected. Default to New when the list is empty.

### M8. Negative hours accepted as 0, creates $0.00 labor line
- Hours `-1` @ $135 → "0h @ $135.00/hr · $0.00", no validation. Reject negatives / zero-hour labor.

### M9. Status dropdown and badges show raw enum values
- "in", "ready", "picked up", "cancelled by customer"; board column titled "IN". Add a label map ("Checked in", "Ready for pickup").

### M10. Estimate has no sent/viewed/approved indicator on the RO
- Inspection card gets `SENT · VIEWED` chip; estimate button looks identical before/after send. Add "Sent 3:55 PM · Approved 3:56 PM".

### M11. Onboarding step 2 shows no shop number; step 3 says "Next: card" after "no card"
- Login page: "No password, no card." Step 2 is an info box + "Next: card"; step 3 leads with "Add card & start trial", "Skip" is secondary. No Back button. Either show/pick the number or drop the step; make Skip equal weight during trial.

### M12. Send-inspection copy stale once estimate is already approved
- Default text says "you can approve right from the page" and "Include estimate" is on by default post-approval. Vary template by approval state.

## Low / polish

- L1. lift.worxel.com "Start trial" CTAs hardcode `utm_source=cold-email&utm_medium=email&utm_campaign=2026-q2-lift-launch` for all visitors — organic signups misattributed.
- L2. VIN stored/displayed lowercase (`1ftfw1et5dfc10312`) in app, SMS and public pages; NHTSA make shown ALL CAPS ("FORD"). Uppercase VIN, title-case make. Decode leaves Engine/Trim blank though NHTSA returns displacement.
- L3. Public booking form: required-field errors just repeat the label ("Vehicle year", "Make", "Model") instead of "Required". Phone reformatted in-field to `+18643100337`; show (864) 310-0337.
- L4. Public booking page `<title>` is the marketing site's ("Lift — Stay in the bay…"); should be "Book · <shop name>".
- L5. Default labor rate blank in Settings while starter jobs are $135/hr; add-line-item Rate field opens empty. Seed at onboarding and use as default.
- L6. Message thread has no delivery status (opt-in text to fictional 555 number shows no failed marker). Outbound opt-in and booking texts tagged `AUTO-REPLIED`, which reads as a customer reply.
- L7. Verify-email link lands on board with banner gone but no "Email confirmed" toast. Board shows "Loading…" text ~2s on every load; app root shows bare spinner ~3s before login form.
- L8. Global search result shows raw E.164 (`+18645550142`) while all other screens show formatted.
- L9. Booking slug: auto-slugify ("Agent Test Garage" → `agent-test-garage`) instead of rejecting; the validation message itself is good.
- L10. Accessibility: hamburger, wizard step circles, starter-job checkboxes (name "on"), Decode VIN (unlabelled while loading), several icon buttons have no accessible name; shop-name input labelled only by placeholder.
- L11. Empty concern accepted at RO creation; RO page then has no Concern section, so it can't be added later. (RO-0002 from booking shows concern fine.)
- L12. Public estimate page lacks shop phone/address, labor hours detail, tax note, expiry.

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
