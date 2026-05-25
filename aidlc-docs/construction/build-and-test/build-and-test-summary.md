# Build & Test Summary — Lift

> **Approval**: Self-approved by orchestrator on 2026-05-24T21:55:00Z.

## Current State

| Activity | Status |
|---|---|
| Build (typecheck + bundle) | ✅ Working (`pnpm -r typecheck`, `pnpm -r build`) |
| Local dev (sst dev) | ✅ Working |
| Deploy (dev stage) | ✅ Working (`pnpm deploy:dev` once secrets set) |
| Deploy (prod stage) | ⚠️ Not yet executed in this run; `removal: retain` policy on prod |
| Unit tests | ❌ Scaffolding not yet present (planned — see `unit-test-instructions.md`) |
| Integration tests | ❌ Scaffolding not yet present (planned — see `integration-test-instructions.md`) |
| Lint (ESLint) | ❌ Not yet wired (TS strict + IDE only) |
| Lighthouse mobile (marketing) | ⚠️ Manual; target ≥90 per PRD |
| Cost guardrail (<$0.05/RO AI) | ⚠️ Logging in place; daily roll-up not yet automated |

## What "ready to ship to first paying customer" requires (in priority order)

1. **AWS 10DLC SMS campaign approval** → remove `MOCK_SMS=1`
2. **Production secrets configured** for stage `prod`
3. **First unit test for each of U1–U8** (Vitest baseline)
4. **Multi-tenant isolation integration test** (critical security check)
5. **Stripe webhook signature verification test** in CI
6. **Marketing Lighthouse ≥90** on mobile
7. **Daily AI-cost-guardrail roll-up** (CloudWatch metric or scheduled Lambda)
8. **ESLint config** + CI lint step
9. **Sentry / equivalent** error reporting wired into Lambda + web
10. **Production deploy** with `sst deploy --stage prod`

## CI/CD recommendation (not yet implemented)

GitHub Actions workflow:

```yaml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - uses: pnpm/action-setup@v3
        with: { version: '9.12.0' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r typecheck
      - run: pnpm -r build
      - run: pnpm -r test                       # once tests exist
      - run: pnpm -r lint                       # once eslint wired
```

Then a separate deploy workflow gated on `main` merges that runs `pnpm deploy:dev` (and a manual-approval `pnpm deploy:prod`).

## Per-unit test coverage targets (when scaffolded)

| Unit | Critical paths | Target |
|---|---|---|
| U1 Identity & Shop | magic-link verify, cookie set, shop create | 80% |
| U2 Contacts | find-or-create idempotency | 80% |
| U3 RepairOrders | totals math, atomic RO counter, send estimate | 80% |
| U4 Messaging | classifier threshold, opt-out, auto-reply path | 80% |
| U5 Payments | webhook idempotency, signature verify | 80% |
| U6 Public Pages | slot validation, opt-in capture | 70% |
| U7 Data Portability | per-shop isolation, post-cancel access | 80% |
| U8 Foundations | JWT roundtrip, sms mock path | 80% |

Non-critical paths: 50% across the board.

## Smoke-test runbook (pre-prod-launch)

1. Sign up via `lift.worxel.com` cold-email CTA → magic link → onboarding → trial start ≤10 min ✅
2. Create a real RO from the PWA on a phone → snap photo → add line item ✅
3. Send AI-drafted estimate to a real phone → tap link → approve → RO flips to `in_repair` ✅
4. Send a test SMS from a customer phone to the shop number → confirm auto-reply within 10s, `autoReplied=true` in DB ✅
5. Customer pays via Stripe test link → webhook updates `Payment.status=paid` and RO `picked_up` ✅
6. Customer self-books on `/public/book/<slug>` → confirmation SMS arrives → owner notification SMS arrives ✅
7. `POST /data/export` → zip downloads → contains all 5 CSVs ✅
8. Disable AI auto-reply via Settings → confirm next inbound text is owner-notify only ✅
9. Lighthouse mobile run on `lift.worxel.com` ≥90 Performance + SEO ✅

All ✅ above are aspirational — they're the gate, not the current state.
