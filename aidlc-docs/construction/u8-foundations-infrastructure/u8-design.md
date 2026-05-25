# U8 — Foundations & Infrastructure

> **Status**: Documenting existing code. Self-approved on 2026-05-24T21:30:00Z.
> **Scope**: Everything cross-cutting — `packages/shared/`, `apps/api/src/lib/`, `sst.config.ts`, plus the frontend shells (`apps/web/`, `apps/marketing/`).

## Functional Design

This unit is the **plumbing** every other unit depends on. It owns:

1. **Shared contracts** (`packages/shared/`): Mongoose models, Zod DTOs, versioned Bedrock prompts, constants (status enums, plan price, TTLs), and the cached `connectDb()`.
2. **API middleware** (`apps/api/src/lib/`): `withAuth`, `withErrorBoundary`, `parseBody`, `parseQuery`, `handleKnownErrors`, standardized `ok`/`created`/`badRequest`/`notFound`/`conflict` response helpers.
3. **AWS adapters** (`apps/api/src/lib/`): `bedrock`, `sms`, `ses`, `s3`, `stripe` — single instantiation per lambda invocation, no direct SDK use in handlers.
4. **Infrastructure-as-code** (`sst.config.ts`): the entire AWS stack — HTTP API, ~70 Lambdas, S3 photos bucket, CloudFront photos CDN, SNS topic for inbound SMS, IAM `commonPermissions`, `commonEnv` env vars, secret bindings, and the domain custom mappings.
5. **Shop PWA** (`apps/web/`): React + Vite + Mantine v7 + TanStack Query + Router + `vite-plugin-pwa`. App shell, theme, auth context, route guards, feature modules.
6. **Marketing site** (`apps/marketing/`): React + Vite + Mantine v7. Single-page landing with hero, wedge demo, anti-persona, features, pricing, FAQ.

**Key business rules / conventions (these are mandatory for any future feature work):**

- **Money is integer cents.** No floats.
- **Phone is E.164.** Validate at boundary with `e164` from `@lift/shared/dto`.
- **Multi-tenancy**: every authenticated handler uses `ctx.user.shopId`; never trusts body-supplied shopId.
- **Mongoose hot-reload guard**: `mongoose.models.X || mongoose.model(...)` — required to avoid dev-mode model-overwrite errors.
- **Bedrock prompt versioning**: every prompt template exports a `_VERSION` constant alongside the builder. AI interactions store the version used.
- **Cents-money formatting**: client-side via `apps/web/src/lib/format.ts` `formatMoney`.
- **AI cost guardrail**: every Bedrock call writes to `AiInteraction`; per-RO target <$0.05.

## NFR Requirements (in scope)

All 32 NFRs touch this unit. Most cross-cutting NFRs are implemented here.

| NFR | How U8 satisfies it |
|---|---|
| NFR-1, NFR-2 | Lambda warm-cache via `connectDb`; bundles via esbuild via SST |
| NFR-10 | Cached `mongoose.connect` |
| NFR-12, NFR-13 | API Gateway HTTPS-only; cookie flags in `lib/auth.ts` |
| NFR-14 | `withAuth` middleware extracts `shopId` |
| NFR-15 | Public token mints use `randomBytes` (Node crypto) |
| NFR-16 | Stripe webhook signature in `lib/stripe.ts` |
| NFR-20 | `sst secret set` for all 8 secrets |
| NFR-21, NFR-27 | `Customer.smsOptOutAt` honored in `lib/sms.ts` |
| NFR-29, NFR-30, NFR-32 | TS strict; all infra in `sst.config.ts`; pnpm monorepo |

## NFR Design

- **Auth helper** (`lib/auth.ts`): `signJwt` and `verifyJwt` use HS256 with `JwtSecret`. `withAuth` wraps the handler, extracts cookie, verifies, populates `ctx`.
- **Bedrock wrapper** (`lib/bedrock.ts`): `invokeClaude({ modelId, system, messages })` — handles inference-profile model IDs (cross-region), parses Anthropic-style JSON output, logs `AiInteraction`. Caller supplies `repairOrderId` / `shopId` for tracking.
- **SMS wrapper** (`lib/sms.ts`): `sendSms({ to, from, body, mockEmailRecipient })` — primary path uses End User Messaging; if `MOCK_SMS=1`, falls back to SES email to `mockEmailRecipient`. Always returns `{ messageId }`.
- **DB cache** (`packages/shared/src/db.ts`): `connectDb()` caches the mongoose connection in a global so warm Lambdas reuse it. First call awaits the connection; subsequent calls resolve immediately.
- **Error boundary** (`lib/middleware.ts`): `withErrorBoundary` wraps the handler, catches all errors, formats via `response.ts`, logs to CloudWatch.

## Infrastructure Design

`sst.config.ts` defines:

| Component | Resource |
|---|---|
| HTTP API | `sst.aws.ApiGatewayV2` |
| Lambdas | One per file in `apps/api/src/functions/**/*.ts` (excluding `_*.ts` helpers and `_stub.ts`) |
| S3 photos | `sst.aws.Bucket` with CloudFront distribution |
| SNS inbound topic | `sst.aws.SnsTopic` for `SmsInboundTopic` |
| Scheduled invocations | `sst.aws.Cron` for daily/hourly scans |
| Secrets | 8 secrets bound to Lambdas |
| Custom domains | `lift.worxel.com` (marketing), `lift-app.worxel.com` (web), `api-lift.worxel.com` (API) |

**`commonPermissions`** (IAM): `bedrock:InvokeModel`, `ses:SendEmail`, `sms-voice:SendTextMessage`, `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob`, `s3:GetObject` on photos.
**`commonEnv`**: `BEDROCK_REGION`, `BEDROCK_MODEL_DRAFT`, `BEDROCK_MODEL_CLASSIFY`, `MOCK_SMS=1`.

## Code Map

| Concern | Files |
|---|---|
| Models | `packages/shared/src/models/*.ts` (12 schemas) |
| DTOs / Zod | `packages/shared/src/dto/index.ts` |
| Prompts | `packages/shared/src/prompts/index.ts` |
| Constants | `packages/shared/src/constants.ts` |
| DB | `packages/shared/src/db.ts` |
| Middleware | `apps/api/src/lib/middleware.ts` |
| Auth helpers | `apps/api/src/lib/auth.ts` |
| Response helpers | `apps/api/src/lib/response.ts` |
| Bedrock wrapper | `apps/api/src/lib/bedrock.ts` |
| SMS wrapper | `apps/api/src/lib/sms.ts` |
| SES wrapper | `apps/api/src/lib/ses.ts` |
| S3 wrapper | `apps/api/src/lib/s3.ts` |
| Stripe wrapper | `apps/api/src/lib/stripe.ts` |
| Infrastructure | `sst.config.ts` |
| PWA app | `apps/web/src/` |
| Marketing site | `apps/marketing/src/Landing.tsx`, `theme.ts` |
