# Brochure assets

Captured 2026-08-21 from the real app (Vite dev + mocked API responses, demo shop
"Mike's Auto Repair"). App shots are iPhone-size (390×844 viewport) at 3× scale
(1170×2532 px) — good to ~4" tall at 300 DPI print.

Regenerate: scripts live in the session scratchpad (`capture.mjs`, `assets.mjs`,
`sms-mockup.html`, `wordmark.html`); they run against `pnpm --filter @lift/web dev`
on :5173 with Node 20 + Playwright (system Chrome). Copy them into the repo if we
want them permanent.

## App screenshots (real UI)

| File | What it shows | Brochure slot |
|---|---|---|
| `conversation-auto-reply.png` | In-app thread: AI-drafted estimate ("AI DRAFT" badge), customer "yes go ahead," 1:47 PM "is the camry done yet?" tagged **AUTO-REPLIED**, instant status reply | Panel 1 (owner's view) |
| `board.png` | Today board, six ROs grouped by status | Panel 3 / Scene "one board" |
| `board-full.png` | Same board, full-page (includes Ready bucket) — for design cropping | Panel 3 alt |
| `ro-detail.png` | RO-0142: line items, labor/parts totals, Send estimate + Text pay link buttons | spare |
| `estimate-draft-modal.png` | "Review estimate" sheet: editable draft, **Polish with AI**, Send — the "you approve every word" proof | Panel 2 |
| `public-estimate.png` | Customer's tap-to-approve estimate page ($506.00, Approve/Decline) | Panel 2 (customer side) |
| `public-pay-paid.png` | Customer pay page in "Paid — thanks!" state | Panel 3 |

## Mockups & brand

| File | What it is |
|---|---|
| `sms-thread-customer-phone.png` | Customer-phone SMS thread (iMessage-style). Auto-reply bubble has the brand red 1px border + `AUTO-REPLIED · STATUS CHECK · 10 SEC` mono tag | Front panel / Panel 1 hero |
| `wordmark-ink.png` / `wordmark-red.png` / `wordmark-cream.png` | LIFT wordmark, Archivo Black, −0.02em tracking, transparent background, in ink `#1a1714` / red `#c8261d` / cream `#f4eedf` |

## QR codes (verified — both decode correctly)

| File | Destination |
|---|---|
| `qr-start-trial.svg` / `.png` | **Primary CTA** → `https://lift-app.worxel.com/login?utm_source=brochure&utm_medium=print&utm_campaign=2026-q3-walkins&utm_content=trial-qr` |
| `qr-info-site.svg` / `.png` | Secondary/info → `https://lift.worxel.com?utm_source=brochure&utm_medium=print&utm_campaign=2026-q3-walkins&utm_content=info-qr` |

Use the **SVGs for print** (vector). QRs are warm ink `#1a1714` on transparent —
place on cream or white only; keep the quiet zone (2 modules, already included).
Print no smaller than 0.8" square and test-scan a physical proof before the full run.

## Print notes

- Demo data is fictional (customers, phone numbers, VIN) — safe to print.
- The demo shop is named "Mike's Auto Repair"; if that reads too on-the-nose next
  to persona-driven copy, recapture with a different shop name (one-line change in
  `capture.mjs`).
- App screenshots have light-theme white backgrounds — design should frame them in
  a phone outline or hairline ink border so they sit on the newsprint cream.
