# CLAUDE.md

Guidance for Claude Code sessions in this repo. Read this first.

## What this is

**Lift** — shop management app for 1–3 bay independent auto repair shops. Owner-operator persona ("Mike"). The wedge is **AI-handled customer SMS** so the owner stays in the bay. Flat **$79/mo**, mobile-first PWA.

- Full v1 product plan: [`docs/PLAN.md`](docs/PLAN.md). Read it before making product decisions.
- Canonical Mike persona: [`docs/PERSONA.md`](docs/PERSONA.md). Read it before writing copy, designing UI, prompt-engineering AI features, or making any audience-facing decision.
- Email campaign brief (voice/tone, anti-features, objections): [`docs/EMAIL_CAMPAIGN_BRIEF.md`](docs/EMAIL_CAMPAIGN_BRIEF.md).

## AI-DLC (AWS AI-Driven Development Life Cycle)

This repo has the [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) rule set installed at [`.aidlc/aidlc-rules/`](.aidlc/aidlc-rules/) (v0.1.8).

**Activation:** When the user begins a request with `"Using AI-DLC, ..."`, treat this as a hard signal to follow the AI-DLC workflow. Read [`.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md`](.aidlc/aidlc-rules/aws-aidlc-rules/core-workflow.md) first, then load the relevant `common/` rules and proceed by phase (Inception → Construction → Operations).

**Rule details path:** `.aidlc/aidlc-rules/aws-aidlc-rule-details/` (this matches the first entry in core-workflow.md's lookup list; no override needed).

**Opt-in extensions installed:** `security/baseline`, `testing/property-based`. The workflow loads only the `.opt-in.md` triggers by default — full extension rules load on user request.

**Not yet installed:** the design-review pre-tool-use hook (experimental — needs Bash 4.0+, optionally `yq` + Python3/PyYAML). Ask the user before installing.

## Stack

- **Frontend (app)** — React 18 + Vite + Mantine v7 + TanStack Query + `vite-plugin-pwa`
- **Frontend (marketing)** — React + Vite + Mantine v7 (CSR, pre-rendering deferred)
- **Backend** — AWS Lambda (Node 20) + API Gateway HTTP API, via **SST v3**
- **DB** — MongoDB Atlas + Mongoose ODM
- **AI** — AWS Bedrock (Sonnet for drafting, Haiku for classification)
- **SMS** — AWS End User Messaging SMS v2 (two-way), inbound published to SNS topic → Lambda
- **Email** — AWS SES
- **Payments** — Stripe
- **Storage** — S3 (photos), CloudFront delivery
- **Auth** — Email magic link + SMS code fallback. JWT in HTTP-only cookie. No third-party auth.
- **Repo** — pnpm workspaces

## Layout

```
lift/
├─ apps/
│  ├─ web/          # PWA — authenticated shop app
│  ├─ marketing/    # lift.com landing page
│  └─ api/          # Lambdas
├─ packages/
│  └─ shared/       # Mongoose models, Zod DTOs, Bedrock prompts, constants
├─ sst.config.ts    # All AWS infra
└─ docs/PLAN.md
```

`packages/shared` is the source of truth for data shapes:
- `src/models/` — Mongoose schemas (always use `mongoose.models.X || mongoose.model(...)` guard for hot-reload)
- `src/dto/` — Zod schemas (used by both client and Lambdas — import the same schema, don't re-declare)
- `src/prompts/` — Versioned Bedrock prompt templates (export a `_VERSION` constant alongside the builder)
- `src/constants.ts` — Status enums, plan price, TTLs
- `src/db.ts` — `connectDb()` with cached mongoose connection (use this at the top of every Lambda)

`apps/api/src/lib/` has the middleware (`withAuth`, `withErrorBoundary`, `parseBody`, `parseQuery`) and the AWS service wrappers (`bedrock`, `sms`, `ses`, `stripe`, `s3`). Use these — don't instantiate clients inline.

## Conventions

- **Money is cents.** Every `total`, `unitPrice`, `rate`, `amountCents` is an integer. Format with `lib/format.ts`'s `formatMoney`.
- **Phone is E.164.** Validate at the boundary with `e164` from `@lift/shared/dto`.
- **Multi-tenancy:** every collection except `users` and `VinDecodeCache` has `shopId`. Every query path has a compound index starting with `shopId`. Always filter by `shopId` from the session — never trust a body-supplied shopId.
- **Lambda handlers:** export `handler` from each file. Wrap with `withAuth` or `withErrorBoundary`. Never `mongoose.connect` directly — middleware calls `connectDb()` first.
- **Stubs:** unimplemented routes use `todoHandler("METHOD /path")` from `apps/api/src/functions/_stub.ts` so wiring is testable. Replace as you implement.
- **AI calls:** always log to `aiInteractions` with `inputTokens`, `outputTokens`, `costCents`, `durationMs`. Cost guardrail is < $0.05/RO.

## Commands

**Node 20 is required** — default shell may be older. Use `nvm use` (`.nvmrc` is set).

```bash
nvm use                                # → Node 20
corepack enable && corepack prepare pnpm@9.12.0 --activate

pnpm install
pnpm -r typecheck                      # all workspaces
pnpm -r build                          # all workspaces

pnpm --filter @lift/web dev            # Vite dev server on :5173
pnpm --filter @lift/marketing dev      # Vite dev server on :5174
pnpm dev                               # `sst dev` — live Lambdas + bound resources
```

## Deploy

```bash
# one-time per stage: set every secret
sst secret set MongodbUri           "mongodb+srv://..."  --stage dev
sst secret set JwtSecret            "..."                --stage dev
sst secret set StripeSecretKey      "sk_test_..."        --stage dev
sst secret set StripePublishableKey "pk_test_..."        --stage dev
sst secret set StripeWebhookSecret  "whsec_..."          --stage dev
sst secret set StripePriceLift79    "price_..."          --stage dev
sst secret set SesFromEmail         "hello@lift.com"     --stage dev
sst secret set SmsPoolId            "..."                --stage dev

pnpm deploy:dev                        # → sst deploy --stage dev
pnpm deploy:prod                       # → sst deploy --stage prod (removal: retain)
```

## Gotchas

- **`vite-plugin-pwa` + Node 18 fails** with "Dynamic require of workbox-build is not supported" and "crypto is not defined". The fix is Node 20, not a plugin version bump.
- **pnpm + workbox-build** requires the `public-hoist-pattern[]=*workbox*` in `.npmrc` — already set.
- **AWS SNS alone is outbound-only.** Two-way SMS goes through **AWS End User Messaging SMS v2**; inbound messages publish to the `SmsInboundTopic` SNS topic which the `snsInbound` Lambda subscribes to.
- **`MOCK_SMS=1`** is set in `sst.config.ts` commonEnv. While enabled, outbound SMS routes through SES (using `mockEmailRecipient` from the caller) instead of End User Messaging — useful while the 10DLC campaign is in review. Drop the env var when ready to send for real.
- **Voice-to-RO uses AWS Transcribe + Bedrock Sonnet** (two-step pipeline; Bedrock Claude doesn't accept audio input today). Lambda needs `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob`, and `s3:GetObject` on the photos bucket — already in `commonPermissions`.
- **Bedrock region & model IDs:** `BEDROCK_MODEL_DRAFT` and `BEDROCK_MODEL_CLASSIFY` env vars are set in `sst.config.ts`. The 4.x Claude models **cannot** be invoked on-demand by their bare ID (`anthropic.claude-...`) — Bedrock returns `"Invocation … with on-demand throughput isn't supported. Retry with the ID or ARN of an inference profile."` Use the cross-region inference profile prefix matching your deploy region: `us.anthropic.claude-haiku-4-5`, `eu.anthropic.…`, `apac.anthropic.…`. Both draft and classify currently point at Haiku 4.5 to stay under the $0.05/RO cost guardrail.
- **Mongoose model overwrite errors** in dev — always use the `mongoose.models.X || mongoose.model(...)` guard pattern shown in existing models.
- **Stripe webhook idempotency:** the handler deduplicates by `stripeEventId`. Don't remove the `SubscriptionEvent` insert.

## What's NOT scaffolded (deferred per plan)

- Native QuickBooks sync (CSV export only)
- Multi-location, tech assignment, time tracking
- Real calendar/scheduling (day-view buckets only)
- Fleet/B2B, marketing automation, review campaigns
- Native iOS/Android (PWA only)

If a request implies any of these, push back — they're explicitly out of v1.

## When asked to implement a route

1. Read the plan section for that feature in `docs/PLAN.md`.
2. Check `packages/shared/dto` — Zod schema probably already exists. Reuse it.
3. Check `packages/shared/models` — Mongoose model probably already exists.
4. Replace the `todoHandler` stub in `apps/api/src/functions/...` with the real implementation.
5. Always: `withAuth` (or `withErrorBoundary` for public/webhook routes), `parseBody(event, ZodSchema)`, filter by `shopId` from `ctx.user`, return via `ok`/`created`/`badRequest`/etc.
6. If it touches AI, use `invokeClaude` from `lib/bedrock.ts` and write to `AiInteraction`.
7. If it touches SMS, use `sendSms` from `lib/sms.ts` and write to `Message`.
