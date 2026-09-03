# Lift — Walk-In Brochure Copy (as printed)

This is the copy **as shipped** in the two-sided 8.5×11 one-sheet — the source of truth is
the design itself ([`brochure/source/Main.dc.html`](brochure/source/Main.dc.html) and
[`Back.dc.html`](brochure/source/Back.dc.html); files + print spec in
[`brochure/README.md`](brochure/README.md)). Keep this doc in sync when the design changes.

**Format:** two-sided one-sheet. The front carries the whole pitch and works standalone;
the back carries §02–§04, the qualifier box, pricing, and the personal note.

**Distribution context:** Matthew hands these out in person at shops. The brochure is the
leave-behind for a ~30-second human interaction — it must survive being read hours later,
cold, by someone who forgot the conversation.

---

## FRONT (must work alone)

*Mono label, top (LIFT wordmark right):*
`§ 01 / SHOP TOOL — FOR 1–3 BAY INDEPENDENTS`

*Headline (Archivo Black; second sentence in red):*
# RUN THE WHOLE SHOP FROM YOUR PHONE.
# YOU TALK. LIFT WRITES IT UP.

*Subhead (Spectral):*
Easy-to-use repair orders, invoices, and customer status checks — ROs, approvals,
status replies, invoicing, and getting paid—all from your phone.

*Proof points (numbered, red mono labels):*
1. **Repair orders** — Say what you found — Lift writes the repair order. Scan the VIN and the vehicle fills itself in.
2. **Approvals** — Lift texts the estimate to the customer. They review the work, tap once to approve, and the RO moves itself to "in repair."
3. **Customer check-ins** — "Is it ready?" texts get answered off the real RO in under 10 seconds — and you approve every word of anything drafted.
4. **Getting paid** — Estimate to invoice to paid, all by text. From repair order to approval to payment.

*Price stamp (red outlined box, tilted, mono):*
`$79/MO FLAT`
`NO PER-TECH FEES · NO ADD-ONS`
`14-DAY FREE TRIAL — NO CARD`

*Visual: "ONE CAR, ONE DAY" workflow figure (vector, `FIG. 01`) — dashed service-lane timeline, four numbered stations matching the proof points:*
- `01 REPAIR ORDER · 8:02 AM` — mic + "Front pads and rotors, call it two and a half hours." → `RO-0142 · PARTS + LABOR — $506.00`
- `02 APPROVED · 8:15 AM` — estimate text bubble + tilted `✓ APPROVED · ONE TAP` stamp
- `03 STATUS CHECK · 1:47 PM` — "Hey is the Camry done yet?" → "In the bay now — on track for pickup by 5:00." + `AUTO-REPLIED · STATUS CHECK · 10 SEC` tag
- `04 PAID · 4:50 PM` — "pay link texted · paid from her phone," `TOTAL $506.00` + red `PAID` stamp
- *terminal:* `5:00 PM · KEYS CHANGE HANDS.` — caption under the frame: `YOU NEVER LEFT THE BAY`

*Bottom band (red, full width): QR code +*
`SCAN TO START YOUR 14-DAY TRIAL`
**LIFT.WORXEL.COM**
*No card needed to start. Set up in about 10 minutes.*

---

## BACK

*Mono label, top (LIFT wordmark right):*
`§ 02 / WHILE YOU WERE UNDER A HOOD, LIFT ANSWERED 4 TEXTS`

### 02 · ROs AND INVOICES, NOT SCRAP PAPER

Say what you found out loud, and Lift turns it into line items at your labor rate.
Scan the VIN and the vehicle fills itself in; snap photos straight onto the RO. Then
Lift drafts the customer text in plain English. **You read it, change anything you
want, and hit send — nothing goes to a customer you didn't approve.** They tap once
to approve, and the RO moves itself to "in repair."

### 03 · THE TEXTS HANDLE THEMSELVES

A customer texts your shop number: "is my car ready?" Lift reads it, checks the RO,
and texts back the real status — in under 10 seconds. You never touched your phone.
It only auto-answers status checks; a real question comes straight to you, untouched.
Every auto-reply is tagged so you can read exactly what it said, and there's a kill
switch if you ever want it off.

### 04 · PAID BEFORE PICKUP

When she's ready, the customer gets a text with a pay link and pays from their phone
before they show up. Keys change hands, done — no wallet fumbling at the counter, no
chasing checks. Your whole day lives on one board, on your phone. No back-office
computer, no Sunday-night data entry.

### Sidebar (right column)

*Visual: "Review estimate" app screenshot, captioned (mono):*
`YOU APPROVE EVERY WORD BEFORE IT SENDS`

*Qualifier box:*
**Built for you if:** you own a 1–3 bay shop and you're the owner, the tech, AND the
guy answering every text.
**Not for you if:** you've got multiple locations, a service advisor working the front,
or a fleet-heavy book. No hard feelings — we'd rather tell you now.

### Price band (ink flood, full width)

**$79/MO. THAT'S IT.**
`UNLIMITED TECHS · UNLIMITED ROS · UNLIMITED TEXTS`
`NO PER-TECH FEES · NO ADD-ONS · NO CONTRACT`
`SETUP: THREE SCREENS, ABOUT 10 MINUTES`
`YOUR DATA: ONE-CLICK EXPORT, ANYTIME — EVEN IF YOU CANCEL`

### Personal note (boxed, signed) + QR corner

> "I built Lift, and I'm probably the guy who handed you this. I'm not a call center —
> if something's broken or confusing, text or email me and you'll get me, not a ticket
> number."
>
> — Matthew · 864-310-0337 · lift@worxel.com

*QR corner:* QR code + `START YOUR 14-DAY TRIAL` + **LIFT.WORXEL.COM**

---

## QR / tracking

- QR target (both sides, primary CTA): `https://lift-app.worxel.com/login?utm_source=brochure&utm_medium=print&utm_campaign=2026-q3-walkins&utm_content=trial-qr`
- The **printed** URL is the human-typeable `LIFT.WORXEL.COM` (info site); the QR goes
  straight to the trial/login page. Intentional — see [`brochure/assets/README.md`](brochure/assets/README.md).
- A secondary info-site QR (`utm_content=info-qr`) exists in assets but is not on the printed piece.
- If we print batches for different towns/routes later, vary `utm_content` per batch to see which routes convert.

## Copy rules honored (verified against the printed one-sheet, 2026-08-30)

- [x] Front panel works with zero other panels read.
- [x] Specific numbers: $79, 10 seconds, 10 minutes, 14 days, 1–3 bays, three screens.
- [x] "You approve every word" appears before any customer-facing AI claim sinks in (front proof point 2 + back sidebar caption).
- [x] Anti-persona stated plainly (trust move).
- [x] No fabricated testimonials, stats, or logos (pre-launch — we have none).
- [x] No "platform / solution / seamless / powerful / revolutionize."
- [x] Data-export promise present (lock-in fear).
- [x] Founder is named, human, and reachable.

## Deltas from the v1 trifold draft (for the record)

The copy was drafted for a half-fold/trifold; the shipped one-sheet condensed it:

- Inside panels §02–§04 tightened to fit one back page — cut the spoken-example quote
  ("front pads and rotors…"), "No phone tag. No lost legal pad…", "no awkward 90
  seconds", and "You'll send your first estimate the same afternoon."
- Front proof point 3: "Estimate → invoice → paid" became "Estimate to invoice to paid" (reads aloud better).
- Section numbering: the back page's top strip carries the "while you were under a
  hood" line as §02's flavor label; old §02–§05 collapsed into back sections 02–04 + price band.
- Price stamp gained "no add-ons"; setup/data-export moved from prose into the price band's mono lines.
- QR target changed from the marketing site to the app login/trial page (see QR / tracking above).

## Next steps (the "steps" plan)

1. ~~Copy~~ ← this doc
2. ~~Design~~ — done as a two-sided 8.5×11 one-sheet. Files + print spec: [`brochure/README.md`](brochure/README.md)
3. ~~Print spec~~ — in the same README (uncoated stock, duplex long-edge, proof + QR test-scan before the run)
4. Walk-in script — the 30 seconds Matthew says while handing it over (should mirror the front panel, not add to it)
