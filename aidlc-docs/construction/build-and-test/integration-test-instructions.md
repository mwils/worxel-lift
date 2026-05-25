# Integration Test Instructions — Lift

> **Status**: Integration tests not yet scaffolded. This is the planned approach, derived from `docs/PLAN.md` §Verification plan.

## Approach

Integration tests verify **end-to-end business transactions** against real (or near-real) AWS services. We use:

| Layer | Tool | Notes |
|---|---|---|
| API integration | Vitest with `sst dev` running | Hit live Lambdas in dev stage |
| DB | Real MongoDB Atlas dev cluster | Same one `sst secret set MongodbUri` is bound to |
| Bedrock | Real Bedrock calls in dev stage | Cost: ~$0.0005 per test; acceptable |
| SMS | `MOCK_SMS=1` (SES email fallback) | Real SMS only enabled after 10DLC clears |
| Stripe | Stripe test mode | Use 4242 4242 4242 4242 / future date / any CVC |
| S3 | Real S3 dev bucket | TTL on test objects |

## Test plan (per BT — Business Transaction)

| BT | Test scenario |
|---|---|
| BT-1 | Magic-link signup happy path — `POST /auth/magic-link` then click `GET /auth/verify` returns 302 with cookie |
| BT-2 | Onboarding flow — `POST /onboard/shop` creates shop + provisions SMS number; `POST /onboard/sms-verify` confirms |
| BT-3 | Stripe subscription activation — Stripe test card; webhook updates `shop.stripe.status=active` and `currentPeriodEnd` |
| BT-4 | RO lifecycle — `create` → `patch (status)` walks `in → in_repair → ready → picked_up` |
| BT-5 + BT-6 | Estimate over SMS — send, receive on real phone (or SES mock), tap link, approve, verify RO flips to `in_repair` |
| BT-7 | Inbound SMS classifier — simulate SNS event for "is my car ready"; verify auto-reply path; verify `autoReplied=true` log |
| BT-8 | Voice-to-RO — upload sample voice memo to S3; trigger `voiceToRo`; verify line items extracted |
| BT-9 | Photo inspection — upload photos via presigned URL; tag severity; send inspection; verify public page renders |
| BT-10 | Customer payment — `payments/createLink` returns Stripe URL; pay with test card; webhook updates `Payment.status=paid` |
| BT-11 | Public booking — `POST /public/book/:slug` creates customer + vehicle + RO; sends confirmation SMS |
| BT-12 | Service reminder daily scan — seed an RO with a 90-day reminder; advance time; verify SMS sent |
| BT-13 | Manual message draft + send — `messages/draft` returns text; `messages/send` writes outbound `Message` |
| BT-15 | Data export — `POST /data/export` returns zip with all 5 CSVs; verify shop isolation (one shop's data doesn't leak to another) |

## Verification plan (from PLAN.md §"Verification plan")

These are the manual + automated checks already specified in the PRD; each integration test maps to one:

- **Auth** — request magic link, verify cookie, hit `/auth/me`
- **Onboarding** — create shop, confirm SMS number provisions, receive test SMS
- **RO + photos** — create RO, snap photo, confirm S3 object, photo renders
- **Estimate via SMS** — send estimate, receive on phone, tap link, approve, status → `in_repair`
- **Inbound auto-reply** — text "is it ready", confirm classifier + auto-reply <10s
- **Voice-to-RO** — record 20s, confirm structured line items
- **Payment** — pay via Stripe test card, confirm webhook updates `payment.status=paid`
- **Marketing** — Lighthouse mobile ≥90 on Performance + SEO
- **Cost guardrail** — query `aiInteractions` after a day of dogfood; confirm per-RO cost <$0.05

## Running

```bash
# Start sst dev in one terminal
pnpm dev

# Run integration suite against the dev stage in another terminal
pnpm --filter @lift/api test:integration       # (script to be added)
```

## Multi-tenant isolation check

A specific integration test must verify that any authenticated query for shop A never returns shop B's data — even if a body or query parameter attempts to override. This is the most-important security test and should run on every CI build.

## Cost guardrail check

Daily job (post-launch): aggregate `aiInteractions.costCents` per `repairOrderId` for the last 24h; alert if any RO exceeds 500 cents (the $0.05 guardrail).
