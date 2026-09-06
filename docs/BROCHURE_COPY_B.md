# Lift — Walk-In Brochure Copy — Version B

Status: **draft copy, not yet designed.** Version A (as printed) is in `BROCHURE_COPY.md`. A and B are both in play — B does not replace A. When B is designed, build it as separate source files (`brochure/source-b/`) so both can be printed and tracked side by side.

**Why B.** A reads like a magazine. Mike reads a headline, a price, and a picture, then decides. B cuts the word count by about 60%, drops every paragraph in favor of a headline + two lines, removes designer labels (§, FIG.), removes repeated lists, and uses Mike's words ("write it up," "get the OK," "is it ready?") instead of ours ("line items at your labor rate," "kill switch," "fleet-heavy book").

**Reading rules for B.** Every line must pass all three:
1. Mike can read it out loud without stumbling.
2. No word he wouldn't say to a customer at the counter.
3. If he only reads the bold lines, he still gets the pitch.

**Format:** two-sided 8.5×11, same as A. Front stands alone. Back is proof, price, and Matthew.

**Word budget:** Front ≤ 110 words of copy outside the figure. Back ≤ 170 words outside the price band and note. A was ~200 / ~330.

---

## FRONT

*Top left, small:* **LIFT** *(wordmark only — no section label)*
*Top right, small:* `For 1–3 bay shops`

### Headline
# RUN THE WHOLE SHOP FROM YOUR PHONE.
# YOU TALK. LIFT WRITES IT UP.
*(second sentence in red, as A)*

### One line under it
**No computer. No paperwork. No phone tag.**

### Three points (bold lead + two plain lines; no numbers)

**Write it up by talking.**
Say what you found. Lift turns it into the repair order.
Type the VIN — the car fills itself in.

**Get the OK by text.**
Lift texts the estimate. The customer taps once to approve.
You read every text before it goes out.

**Stop answering "is it ready?"**
Those texts answer themselves, straight off the job.
Real questions still come to you.

### Price stamp (red outlined box, tilted — keep from A)
`$79 A MONTH. THAT'S IT.`
`NO PER-TECH FEES · NO CONTRACT`
`14-DAY FREE TRIAL · NO CARD`

### Figure: "One car. One day." (keep the timeline from A, trim the labels)

Header: **ONE CAR. ONE DAY.** *(drop "FIG. 01")*

- **8:02 AM · WRITE-UP** — 🎤 *"Front pads and rotors, call it two and a half hours."* → `RO-0142 · $506.00`
- **8:15 AM · APPROVED** — text bubble: *"Estimate for the Camry — $506 parts and labor. Tap to approve."* → stamp `APPROVED`
- **1:47 PM · "IS IT READY?"** — customer: *"Hey is the Camry done yet?"* → Lift: *"In the bay now — on track for pickup by 5."* → tag `ANSWERED ITSELF · 10 SEC`
- **4:50 PM · PAID** — *"Pay link texted. Paid from her phone."* → stamp `PAID`
- **5:00 PM · KEYS CHANGE HANDS.**

Caption under the frame: **You never left the bay.**

### Bottom band (red, full width, QR left)
`SCAN TO START YOUR FREE TRIAL`
**LIFT.WORXEL.COM**
*No card. About 10 minutes to set up.*

---

## BACK

*Top left, small:* **LIFT**
*Top right, small:* `Four texts answered. You never came out from under the hood.`

### Left column — three sections, same shape as the front

**Repair orders, not scrap paper.**
Talk, and it's written up at your rate. Type the VIN, snap photos, done.
Lift drafts the customer text in plain English. You fix anything you want, then send.
Nothing goes to a customer you didn't OK.

**The "is it ready?" texts handle themselves.**
Customer texts your shop number. Lift checks the job and texts back the real status.
It only answers "is it ready?" — anything else comes straight to you.
Every reply is saved so you can see what it said. Turn it off any time.

**Get paid by text.**
When the car's ready, the customer gets a pay link and pays from their phone.
Keys change hands. No chasing checks, no card reader fumbling at the counter.
*Connect your bank once — about 5 minutes — and you're set.*

**Your whole day on one screen.**
Every car, every status, on your phone. No back-office computer. No Sunday-night data entry.

### Right column

*Visual 1: phone-sized screenshot of the **board** (Today view, 4–5 cars across statuses).*
Caption: `Every car. One screen.`

*Visual 2 (smaller): the "Review estimate" dialog.*
Caption: `You OK every text before it sends.`

**Built for you if:** you own a 1–3 bay shop and you're the owner, the tech, and the guy answering every text.

**Not for you if:** you've got more than one location, a service writer up front, or mostly fleet accounts. No hard feelings — better to tell you now.

### Price band (black, full width — keep from A)

**$79 A MONTH. THAT'S IT.**
`UNLIMITED TECHS · UNLIMITED JOBS · UNLIMITED TEXTS`
`NO PER-TECH FEES · NO ADD-ONS · NO CONTRACT`
`SET UP IN ABOUT 10 MINUTES`
`YOUR DATA IS YOURS — DOWNLOAD IT ANY TIME, EVEN IF YOU QUIT`

### Note from Matthew (boxed, signed — keep from A, trimmed)

> "I built Lift, and I'm probably the guy who handed you this. If something's broken or confusing, text me. You'll get me, not a ticket number."
>
> — Matthew · 864-310-0337 · lift@worxel.com

### QR corner
QR + `START YOUR FREE TRIAL` + **LIFT.WORXEL.COM**

---

## Word swaps (A → B), for the designer

| A | B | Why |
|---|---|---|
| § 01 / SHOP TOOL — FOR 1–3 BAY INDEPENDENTS | For 1–3 bay shops | Section marks mean nothing to Mike |
| FIG. 01 | (removed) | Same |
| ROs, approvals, status replies, invoicing… (subhead) | No computer. No paperwork. No phone tag. | A subhead listed the same things twice |
| Scan the VIN | Type the VIN | Honest: today it's a text field + decode, not a camera scan |
| line items at your labor rate | written up at your rate | His words |
| Estimate to invoice to paid… From repair order to approval to payment | (removed) | Said the same thing twice |
| kill switch | Turn it off any time | His words |
| fleet-heavy book | mostly fleet accounts | His words |
| service advisor | service writer | What small shops call the role |
| UNLIMITED ROS | UNLIMITED JOBS | Board copy already says "jobs" in places; "RO" fine in body, but the price band should be plain |
| ONE-CLICK EXPORT | download it any time | Nobody says "export" at a counter |
| AUTO-REPLIED · STATUS CHECK | ANSWERED ITSELF | Plain |
| "You approve every word of anything drafted" (in the same sentence as "10 seconds") | Split: front says texts answer themselves + "real questions still come to you"; back says "It only answers 'is it ready?'" | A read as a contradiction |

## Claims check (against production, 2026-09-03)

Keep these honest or the first call Matthew gets is "where is it?"

| Claim | Status in product | Copy handling |
|---|---|---|
| Talk → repair order | Voice dictation exists on customer, vehicle, and line-item entry | OK |
| VIN fills the car in | NHTSA decode from typed VIN; no camera scan | Say "type," not "scan" |
| One-tap approve, moves to "in repair" | Works | OK |
| "Is it ready?" auto-answer | Setting exists (on by default); not exercised in QA | OK; test before print run |
| Pay link / paid from phone | Requires Stripe connect | Added "connect your bank once — about 5 minutes" |
| "Invoices" | No invoice/receipt in product yet (feature-gaps item 1) | Word removed from B. Re-add when shipped |
| Photos on the RO | Exists | OK |
| Data download any time | Settings → Export CSV exists | OK |
| $79 / no card / 14 days / ~10 min setup | True | OK |
| Every reply saved | True (message thread, tagged) | OK |

## Not changed from A (on purpose)
- Headline. It's the best line on the sheet.
- The "one car, one day" timeline. It shows instead of tells; only the labels were simplified.
- Built-for / not-for box. Trust move; keep it.
- Signed note with the cell number. Keep it forever.
- Price stamp and black price band.

## Design direction for B

A is the "service manual": cream paper, serif body, mono labels, editorial. B is the **parts-counter sign**: the sheet taped next to the register that says what it costs and how it works. It should look like something the shop could have printed itself, done well. Nothing on it should feel designed *at* Mike.

**Stock and ink.** White uncoated, 80–100 lb text or 65 lb cover. Black plus one red — the same red as A so the two sheets read as the same company. No cream, no gradients, no photos of stock-image mechanics. The white is the point: A looks like a magazine, B looks like a sign.

**Type.** Two faces, both free (Google Fonts) so the design source can stay in the same toolchain as A.
- Headlines and bold lead lines: **Barlow Condensed**, weight 700–800, all caps, tight tracking. Reads like a tire-shop banner or a Snap-on catalog header without being a costume.
- Everything else: **Barlow** (regular 400, bold 600), sentence case, never smaller than 11 pt in print. No mono anywhere — the mono labels in A are the "designed" tell. Price and phone number are just Barlow Condensed, big.
- Fallbacks if the designer objects to Barlow: Oswald + Source Sans 3. Not Archivo Black + Spectral (that's A).

**Scale.** Four sizes, no more: headline (~64 pt), section leads (~22 pt), body (~12 pt), fine print (~9 pt). If a fifth size appears, something is over-designed.

**Layout.**
- Front: headline across the top, then a **single column of the three points on the left** and the one-car-one-day figure on the right, exactly as A. Price stamp bottom-left, red QR band across the bottom. Same skeleton as A so the eye finds the same things in the same places; only the dress changes.
- Back: three points down the left in the same headline-plus-two-lines shape; right column is the **board screenshot at real phone size** (about 2.75 in wide) with the estimate dialog small beneath it; built-for box; black price band; note; QR.
- Generous margins (0.75 in) and real white space between sections. Space is what makes it feel simple; do not fill it.

**Rules and boxes.** Plain 1.5 pt black rules and rectangles, square corners. The tilted price stamp from A is the one flourish allowed — keep it, it's the thing people remember. No drop shadows, no rounded cards, no tinted panels other than the red QR band and the black price band.

**Figure.** Same timeline as A, redrawn in black rules with red only on the stamps ("APPROVED", "PAID") and the "answered itself" tag. Handwritten-style quotes stay in italic Barlow, not a script face.

**Screenshots.** Real app, real shop name ("Mike's Auto Repair"), real amounts. Board screenshot must show at least four cars in different statuses so it looks like a working day, not a demo.

**Tests before print.**
- Cover everything but the bold lines with your hand; the pitch should still read.
- Hold it at arm's length; the price and the phone number should be the two things you can read.
- Hand it to someone who's never seen Lift and ask what it costs and what it does. Under ten seconds or it's not done.

## Design notes that apply to both A and B
- Bold lead lines must read as a complete pitch on their own (rule 3 above).
- A phone-sized board screenshot belongs on the back of whichever sheet is in Mike's hand. The estimate dialog is our favorite feature; the board is the one he'll recognize.

## QR / tracking
Same QR target as A, but set `utm_content=trial-qr-b` on the B print run so A and B conversions are separable when both are handed out.
