# Code Structure — Lift

## Build System
- **Type**: pnpm workspaces (root `package.json` + `pnpm-workspace.yaml`) + Vite for frontends + SST v3 / esbuild for backend.
- **TS config base**: `tsconfig.base.json` (strict mode, ESM, NodeNext).
- **Node version**: 20 (required — see `.nvmrc`). Bedrock + `vite-plugin-pwa` both fail on Node 18.
- **Package manager**: pnpm 9.12.0 (pinned via `corepack`).
- **CI**: Not yet wired (one of the deferred items in PLAN.md verification plan).

## Repository Layout

```text
lift/
├─ apps/
│  ├─ api/              # AWS Lambda handlers (Node 20, TS)
│  │  ├─ src/
│  │  │  ├─ functions/  # Handler files grouped by domain
│  │  │  │  ├─ auth/                # magic link, verify, me, smsCode, logout
│  │  │  │  ├─ billing/             # stripe portal
│  │  │  │  ├─ customers/           # CRUD + history
│  │  │  │  ├─ data/                # CSV export
│  │  │  │  ├─ jobTemplates/        # saved jobs CRUD, apply, starter library
│  │  │  │  ├─ messages/            # conversation, AI draft, send
│  │  │  │  ├─ onboard/             # shop create, SMS verify, Stripe setup
│  │  │  │  ├─ payments/            # createLink, charge, saveCard
│  │  │  │  ├─ public/              # token-scoped, no auth: estimate, inspection, pay, book*
│  │  │  │  ├─ repairOrders/        # CRUD + line items, photos, voice-to-RO, send estimate/inspection
│  │  │  │  ├─ serviceReminders/    # daily scan + list/patch/disable
│  │  │  │  ├─ shop/                # get + patch settings
│  │  │  │  ├─ vehicles/            # CRUD + VIN decode + history
│  │  │  │  ├─ webhooks/            # SNS inbound SMS, SNS delivery, Stripe
│  │  │  │  ├─ _stub.ts             # todoHandler for unimplemented routes
│  │  │  │  └─ lookup.ts            # cross-collection lookup
│  │  │  └─ lib/
│  │  │     ├─ auth.ts              # withAuth middleware + JWT helpers
│  │  │     ├─ bedrock.ts           # invokeClaude — model selection + AiInteraction logging
│  │  │     ├─ middleware.ts        # withErrorBoundary, parseBody, parseQuery, handleKnownErrors
│  │  │     ├─ response.ts          # ok, created, badRequest, notFound, conflict, ...
│  │  │     ├─ s3.ts                # presigned URLs, get/put
│  │  │     ├─ ses.ts               # email sender
│  │  │     ├─ sms.ts               # sendSms — End User Messaging + MOCK_SMS=1 SES fallback
│  │  │     └─ stripe.ts            # Stripe client wrapper
│  │  ├─ package.json
│  │  └─ tsconfig.json
│  │
│  ├─ web/              # Authenticated shop PWA (React + Vite + Mantine v7 + TanStack Query)
│  │  ├─ src/
│  │  │  ├─ routes/                 # File-route style (login, verify, onboarding, /app/*, /public/*)
│  │  │  ├─ features/               # Per-domain UI: ro, customer, vehicle, messaging, jobTemplates, payments, inspection, history, reminders
│  │  │  ├─ lib/                    # auth, api client, format, hooks
│  │  │  ├─ App.tsx
│  │  │  └─ main.tsx
│  │  ├─ index.html
│  │  ├─ package.json
│  │  └─ vite.config.ts
│  │
│  └─ marketing/        # lift.worxel.com landing page (React + Vite + Mantine v7)
│     ├─ src/
│     │  ├─ Landing.tsx             # Single-page editorial layout
│     │  ├─ theme.ts                # Lift brand tokens
│     │  ├─ main.tsx
│     │  └─ App.tsx
│     ├─ index.html
│     └─ package.json
│
├─ packages/
│  └─ shared/           # Cross-app contracts
│     ├─ src/
│     │  ├─ models/                 # 12 Mongoose schemas (with hot-reload guard)
│     │  │  ├─ aiInteraction.ts
│     │  │  ├─ customer.ts
│     │  │  ├─ jobTemplate.ts
│     │  │  ├─ message.ts
│     │  │  ├─ payment.ts
│     │  │  ├─ repairOrder.ts
│     │  │  ├─ serviceReminder.ts
│     │  │  ├─ shop.ts
│     │  │  ├─ subscriptionEvent.ts
│     │  │  ├─ user.ts
│     │  │  ├─ vehicle.ts
│     │  │  └─ index.ts             # barrel
│     │  ├─ dto/                    # Zod schemas (request/response validators)
│     │  ├─ prompts/                # Versioned Bedrock prompt builders + _VERSION constants
│     │  ├─ constants.ts            # Status enums, plan price, TTLs
│     │  ├─ db.ts                   # connectDb() with cached mongoose connection
│     │  └─ index.ts                # public barrel
│     └─ package.json
│
├─ sst.config.ts        # All AWS infrastructure
├─ pnpm-workspace.yaml
├─ package.json         # root: scripts (deploy:dev, deploy:prod, dev, typecheck, build)
├─ tsconfig.base.json
├─ pnpm-lock.yaml
├─ .nvmrc               # 20
├─ .npmrc               # pnpm public-hoist-pattern for workbox-*
├─ CLAUDE.md            # Repo conventions + AI-DLC pointer
├─ docs/
│  ├─ PLAN.md           # Canonical v1 product plan (the PRD)
│  ├─ PERSONA.md        # Canonical Mike persona
│  ├─ EMAIL_CAMPAIGN_BRIEF.md
│  └─ COMPLETION_PLAN.md
├─ .aidlc/aidlc-rules/  # AI-DLC ruleset (this workflow's source)
├─ scripts/aidlc-designreview/  # Design-review hook tooling
└─ aidlc-docs/          # ← AI-DLC artifacts (this directory)
```

## File Inventory (high-traffic files, by domain)

> Full file count: **171 TS/TSX files** in apps/ and packages/. Below are the load-bearing files — these are the candidates most likely to be touched during Construction-phase modifications.

### Backend handlers (`apps/api/src/functions/`)

| Path | Purpose |
|---|---|
| `auth/magicLink.ts` | Generate + email magic link |
| `auth/verify.ts` | Validate magic link token; set JWT cookie |
| `auth/me.ts` | Current session info |
| `auth/smsCode.ts` | SMS code fallback flow |
| `auth/logout.ts` | Clear cookie |
| `onboard/shop.ts` | Create shop, provision SMS number, create Stripe customer |
| `onboard/smsVerify.ts` | Confirm shop owner received test text |
| `onboard/stripeSetup.ts` | Stripe Checkout / Setup Intent for the trial |
| `shop/get.ts`, `shop/patch.ts` | Shop settings (timezone, AI tone, auto-reply toggle, booking enabled) |
| `customers/{create,get,patch,list,history}.ts` | Customer CRUD + paged search + history view |
| `vehicles/{create,patch,decodeVin,history}.ts` | Vehicle CRUD + VIN decode (cached) + history |
| `repairOrders/{create,get,patch,list}.ts` | RO core CRUD |
| `repairOrders/lineItems.ts` | Line item CRUD (within an RO) |
| `repairOrders/{photosPresign,photosConfirm}.ts` | S3 presigned URL flow for photo upload |
| `repairOrders/{voicePresign,voiceToRo}.ts` | S3 upload + Transcribe + Bedrock structure-extraction |
| `repairOrders/inspectionItem.ts` | Inspection item CRUD on an RO |
| `repairOrders/{sendEstimate,sendInspection}.ts` | AI draft + SMS to customer |
| `repairOrders/_totals.ts`, `_inferReminders.ts` | Internal helpers |
| `messages/{conversation,draft,send}.ts` | Conversation view, AI draft preview, send |
| `payments/{createLink,charge,saveCard}.ts` | Customer payment endpoints (Mike's customers paying Mike) |
| `public/{getEstimate,approveEstimate,declineEstimate}.ts` | No-auth, token-scoped: customer estimate flow |
| `public/{getInspection,getPay,pay}.ts` | No-auth: inspection view + pay flow |
| `public/{getBook,getBookSlots,book,getBooking,rescheduleBooking,cancelBooking}.ts` | No-auth: online booking flow |
| `public/_slots.ts` | Booking slot validation helper |
| `webhooks/snsInbound.ts` | Inbound SMS handler (SNS topic subscriber) |
| `webhooks/snsDelivery.ts` | SMS delivery status updates |
| `webhooks/stripe.ts` | Stripe events — idempotent dedup by stripeEventId |
| `serviceReminders/dailyScan.ts` | Scheduled scan; sends due reminders |
| `serviceReminders/{list,patch,disableForVehicle}.ts` | Per-shop reminder management |
| `jobTemplates/{create,get,list,patch,del,apply,starterLibrary,importStarter}.ts` | Saved jobs CRUD + library |
| `data/export.ts` | CSV bundle export |
| `billing/portal.ts` | Stripe Customer Portal redirect |
| `lookup.ts` | Cross-collection search (customers + vehicles + ROs) |

### Backend library (`apps/api/src/lib/`)

| Path | Purpose |
|---|---|
| `auth.ts` | `withAuth` middleware + JWT helpers (HS256, HTTP-only cookie) |
| `middleware.ts` | `withErrorBoundary`, `parseBody`, `parseQuery`, `handleKnownErrors` |
| `response.ts` | Standardized API responses (ok, created, badRequest, notFound, conflict, etc.) |
| `bedrock.ts` | `invokeClaude` — model selection (`BEDROCK_MODEL_DRAFT`/`CLASSIFY` env vars), AiInteraction logging |
| `sms.ts` | `sendSms` — End User Messaging primary; SES fallback when `MOCK_SMS=1` |
| `ses.ts` | Email sender |
| `s3.ts` | Presigned URL helpers |
| `stripe.ts` | Stripe client wrapper |

### Shared models (`packages/shared/src/models/`)

12 Mongoose schemas, all with the `mongoose.models.X || mongoose.model(...)` hot-reload guard. Each except `users` and `VinDecodeCache` includes `shopId` with a compound index starting with `shopId`. Key models:

- `shop` — tenant; owns SMS number, Stripe IDs, settings, counters
- `user` — login identity; one or more per shop
- `customer` — Mike's customers (per-shop)
- `vehicle` — per-customer; one customer can own many
- `repairOrder` — the central work unit; includes status, line items, photos, public tokens
- `message` — every inbound + outbound SMS, with `autoReplied` flag
- `aiInteraction` — Bedrock call log for cost guardrail tracking
- `payment` — customer payments (Mike's customers paying Mike via Stripe)
- `subscriptionEvent` — Stripe webhook idempotency log
- `jobTemplate` — saved jobs (labor + parts bundles)
- `serviceReminder` — per-customer/vehicle scheduled outreach

### Frontend (`apps/web/src/`)

Route map (file-route style):

| Route | Purpose |
|---|---|
| `/login` | Email entry, magic link send |
| `/verify` | Verify the magic-link click |
| `/onboarding` | 3-screen onboarding flow |
| `/app/board` | Default landed view — RO board with status columns |
| `/app/ro/new`, `/app/ro/detail` | RO create + detail |
| `/app/customers`, `/app/customers/detail` | Customer list + detail |
| `/app/messages`, `/app/messages/conversation` | Messaging inbox + thread |
| `/app/settings` | Shop settings |
| `/app/templates` | Job templates management |
| `/app/vehicles/detail` | Vehicle detail (history) |
| `/public/estimate`, `/public/inspection`, `/public/pay` | Customer-facing token-scoped pages |

Feature folders under `apps/web/src/features/`: `ro`, `customer`, `vehicle`, `messaging`, `jobTemplates`, `payments`, `inspection`, `history`, `reminders`.

## Lint / Format / Quality

- **TypeScript strict mode**: enabled in `tsconfig.base.json`.
- **Linting**: not yet wired (ESLint setup TBD — currently relies on TS strict + IDE).
- **Formatting**: Prettier (defaults; integrated into pnpm scripts).
- **Tests**: Test scaffolding not yet present — explicitly part of v1 verification plan in `docs/PLAN.md` §"Verification plan".

## Build Commands

```bash
nvm use                                # → Node 20 (required)
pnpm install
pnpm -r typecheck                      # all workspaces
pnpm -r build                          # all workspaces
pnpm --filter @lift/web dev            # Vite :5173
pnpm --filter @lift/marketing dev      # Vite :5174
pnpm dev                               # sst dev — live Lambdas + bound resources
pnpm deploy:dev                        # sst deploy --stage dev
pnpm deploy:prod                       # sst deploy --stage prod
```
