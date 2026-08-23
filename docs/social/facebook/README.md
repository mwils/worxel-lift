# Facebook page asset package

Everything needed to set up and start posting on the Lift Facebook page.
All graphics are in the Service Manual brand system (cream `#f4eedf`, ink `#1a1714`,
Snap-On red `#c8261d`; Archivo Black / Spectral / Space Mono) at Facebook's exact sizes.

## Files → where they go

| File | Use | Notes |
|---|---|---|
| `profile-1024.png` | Page profile picture | Red square, cream LIFT wordmark. Sized so the circle crop never clips the wordmark. |
| `cover-1640x624.png` | Page cover photo | Content sits in the mobile-safe center zone — nothing important gets cropped on phones. |
| `link-preview-1200x630.png` | og:image for lift.worxel.com | Give this to the marketing site as its Open Graph image so shared links show a branded card (also correct size for X/LinkedIn). |
| `post-value-prop-1080.png` | Feed post — the pitch | Headline + three proof points + price. |
| `post-sms-demo-1080.png` | Feed post — the proof | "While you were under a hood…" + SMS thread with the red-bordered auto-reply. |
| `post-price-1080.png` | Feed post — the price | $79/mo. That's it. |

## Page setup copy

- **Page name:** Lift
- **Username / handle:** `@liftshopapp` (suggestion — check availability)
- **Category:** Software company (or App page)
- **CTA button:** "Sign Up" → `https://lift-app.worxel.com/login?utm_source=facebook&utm_medium=social&utm_campaign=page-cta`
- **Website:** `https://lift.worxel.com`
- **Short description (≤155 chars):**
  > Shop app for 1–3 bay independent auto repair shops. Run the whole shop from your phone — you talk, it service-writes. $79/mo flat, 14-day free trial.
- **About (long):**
  > Lift is built for the owner-operator: the shop where you're the tech, the front counter, and the bookkeeper all at once. Dead-simple repair orders, invoices, and customer status checks, all from the phone in your pocket. Say the job out loud and it becomes line items at your rate. Scan the VIN and the vehicle fills itself in. "Is it ready?" texts answer themselves off the real RO — and you approve every word before anything sends. $79/mo flat. No per-tech fees, no add-ons, no contract. Built by one guy who answers his own email: lift@worxel.com.

## Post captions (pair with the matching graphic)

**post-value-prop:**
> New here, so the short version: Lift is a shop app for 1–3 bay independents. You run the whole shop from your phone — say the job out loud and it becomes line items, scan the VIN and the vehicle fills itself in, and "is it ready?" texts answer themselves. $79/mo flat, 14-day free trial, no card. lift.worxel.com

**post-sms-demo:**
> This is a real exchange in Lift. Customer asks if the car's done, Lift answers off the actual RO status in under 10 seconds, and the owner's hands never left the caliper. It only auto-answers status checks — real questions come straight to you, and you approve every word of anything drafted. lift.worxel.com

**post-price:**
> $79 a month, flat. Unlimited techs, unlimited ROs, unlimited texts. No per-tech fees, no add-ons, no contract — and your data exports in one click, anytime, even if you cancel. 14-day free trial, no card needed. lift.worxel.com

## Posting notes

- No emoji, no hashtag walls — the brand voice is plain and blunt. One link per post, at the end.
- These three posts seed the page so it doesn't look empty when group members click through from outreach posts (see `../../FB_GROUP_OUTREACH.md` — the page is the posting identity behind that plan).
- UTM any link you post: `?utm_source=facebook&utm_medium=social&utm_campaign=page-post`.
- No fabricated testimonials or engagement bait — pre-launch, product mechanics are the only proof (brief §15).

## Regenerating

Source is `source.html` in this folder (HTML → Playwright element screenshots at exact sizes;
needs Node 20 + Playwright with system Chrome). The SMS mockup is referenced from
`../../brochure/assets/sms-thread-customer-phone.png` by absolute path — update the `src` if
the repo moves.
