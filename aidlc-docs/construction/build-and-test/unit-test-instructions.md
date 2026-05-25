# Unit Test Instructions — Lift

> **Status**: Unit-test scaffolding does **not yet exist in v1**. This document describes the planned approach so the first unit test can be added without ambiguity. See `docs/PLAN.md` §Verification plan.

## Approach

| Layer | Framework | Reason |
|---|---|---|
| API handlers (Lambda) | Vitest | Same runtime as the rest of the TS ecosystem; fast; ESM-native; pnpm-friendly |
| Shared models (Mongoose) | Vitest + `mongodb-memory-server` | Test schema validation + indexes without a live Atlas connection |
| Shared DTOs (Zod) | Vitest | Pure-function tests; no Mongo needed |
| Shared prompts | Vitest + snapshot | Verify prompt builders produce stable output |
| Web app | Vitest + @testing-library/react + jsdom | Component-level tests |
| Marketing | n/a — visual regression / Lighthouse only | Marketing is static; visual + perf is what matters |

## Directory convention

```text
apps/api/src/functions/<domain>/<handler>.ts
apps/api/src/functions/<domain>/<handler>.test.ts        # colocated tests
packages/shared/src/models/<model>.ts
packages/shared/src/models/<model>.test.ts               # colocated tests
```

## Per-unit test scope (what to write first)

| Unit | First tests to add |
|---|---|
| U1 Identity & Shop | `auth/verify.ts` magic-link happy path + expired token; `onboard/shop.ts` creates exactly one shop |
| U2 Contacts | `customers/create.ts` find-or-create idempotency by (shopId, phone); `vehicles/decodeVin.ts` cache hit vs miss |
| U3 RepairOrders | `repairOrders/_totals.ts` recompute correctness in cents; `repairOrders/create.ts` per-shop atomic counter |
| U4 Messaging | `webhooks/snsInbound.ts` classifier confidence threshold; auto-reply path; opt-out path |
| U5 Payments | `webhooks/stripe.ts` idempotency on duplicate `stripeEventId`; signature verification failure path |
| U6 Public Pages | `public/book.ts` slot validation; opt-in capture; owner-notify path |
| U7 Data Portability | `data/export.ts` includes all per-shop collections; works on canceled subscription |
| U8 Foundations | `lib/auth.ts` JWT sign+verify roundtrip; `lib/sms.ts` MOCK_SMS path |

## Running

```bash
pnpm -r test                              # all workspaces (once scripts exist)
pnpm --filter @lift/api test              # API-only
pnpm --filter @lift/api test -- file.ts   # single file
```

## Coverage target (v1)

- **Critical paths**: auth, payments webhook, inbound SMS classifier — **80% line coverage**.
- **Non-critical paths**: 50% line coverage.
- **Models**: 100% — schema validation should be exhaustive.

Coverage reporting via Vitest's built-in `c8` integration.

## Property-based testing

Per the workflow-planning decision, `testing/property-based` extension is **disabled** for v1. Revisit if v2 needs invariant testing on totals/cents math.
