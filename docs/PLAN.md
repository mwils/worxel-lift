# Lift — v1 Build Plan

## Context

Lift is a shop management app for **1–3 bay independent auto repair shops** ("Mike, the owner-operator"). The wedge is **AI-handled customer communication** so Mike can stay in the bay instead of answering "is my car ready" calls. Flat **$79/mo**, mobile-first, ships as a PWA.

This plan covers v1 only. Anything not listed here is deferred (multi-location, native QuickBooks sync, fleet accounts, tech time-clocks, marketing automation, review campaigns, scheduling beyond a day view).

The success metric for v1 is: Mike installs in <10 min during a slow afternoon and sends an AI-drafted estimate via SMS the same day.

---

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Frontend (app) | React 18 + Vite + Mantine v7, PWA via `vite-plugin-pwa` |
| Frontend (marketing) | React + Vite, pre-rendered (`vite-plugin-ssg`), Mantine reused |
| Backend | AWS Lambda (Node 20, TS) + API Gateway HTTP API, via **SST v3** |
| DB | MongoDB Atlas (existing account), Mongoose ODM |
| Object store | S3 (RO photos), CloudFront for delivery |
| Auth | Email magic-link (SES) + SMS code fallback. Custom JWTs in HTTP-only cookies |
| SMS | AWS End User Messaging SMS v2 (outbound + inbound) → SNS topic → Lambda. Note: plain SNS alone is outbound-only |
| AI | AWS Bedrock — `anthropic.claude-haiku-4-5` for inbound classification + cheap tasks, `anthropic.claude-sonnet-4-6` for drafting, voice-to-RO |
| Payments | Stripe (Payment Intents + Customer + saved cards). Webhook → Lambda |
| Hosting (web) | CloudFront + S3 via SST `StaticSite` |
| IaC | SST v3 (`sst.config.ts`), one stage per env (dev/prod) |
| Repo | pnpm workspaces monorepo |
| Lang | TypeScript everywhere, shared Zod schemas in `packages/shared` |

---

## Monorepo layout

```
lift/
├─ apps/
│  ├─ web/          # PWA — authenticated shop app
│  ├─ marketing/    # lift.com landing (pre-rendered)
│  └─ api/          # SST functions (Lambdas)
├─ packages/
│  └─ shared/       # Zod schemas, TS types, Mongoose models, prompt templates
├─ sst.config.ts
├─ pnpm-workspace.yaml
├─ .env.example
└─ README.md
```

`packages/shared/src/`:
- `models/` — Mongoose schemas + types (single source of truth)
- `dto/` — Zod request/response schemas (used by both client and Lambdas)
- `prompts/` — Bedrock prompt templates with versioned strings
- `constants.ts` — RO statuses, plan price, etc.

---

## Data model (Mongoose collections)

All docs include `shopId` for tenancy isolation. Compound index `{ shopId: 1, ... }` on every query path.

### `shops`
```
_id, name, address, timezone, ownerUserId,
sms: { phoneNumber, awsPhonePoolId, optInScript },
stripe: { customerId, subscriptionId, status, currentPeriodEnd },
billing: { plan: 'lift_79', trialEndsAt },
settings: { aiTone: 'plain' | 'friendly', autoReplyEnabled: bool, businessHours },
createdAt, updatedAt
```

### `users`
```
_id, shopId, email, phone, role: 'owner' | 'tech',
auth: { magicLinkHash?, magicLinkExpiresAt?, smsCode?, smsCodeExpiresAt?, lastLoginAt },
createdAt
```

### `customers`
```
_id, shopId, firstName, lastName, phone (E.164), email?,
smsOptInAt?, smsOptOutAt?, notes,
createdAt, updatedAt
```
Index: `{ shopId: 1, phone: 1 }` unique.

### `vehicles`
```
_id, shopId, customerId,
vin?, year, make, model, trim?, engine?, mileage, plate?, color?, notes,
createdAt, updatedAt
```
Index: `{ shopId: 1, customerId: 1 }`, `{ shopId: 1, vin: 1 }` sparse.

### `repairOrders`
```
_id, shopId, customerId, vehicleId,
number (per-shop incrementing, e.g. RO-0142),
status: 'scheduled' | 'in' | 'diagnosing' | 'awaiting_parts' | 'in_repair' | 'ready' | 'picked_up' | 'voided',
concern, diagnosis?,
lineItems: [{ kind: 'labor' | 'part' | 'fee', description, hours?, rate?, qty?, unitPrice?, total }],
laborTotal, partsTotal, taxTotal, total,
photos: [{ s3Key, takenAt, caption? }],
estimate: { sentAt?, approvedAt?, declinedAt?, publicToken },
payment: { status: 'unpaid' | 'authorized' | 'paid' | 'refunded', stripePaymentIntentId?, paidAt? },
publicToken (random, for customer estimate/pay links),
createdAt, completedAt?, updatedAt
```

### `messages`
```
_id, shopId, customerId, repairOrderId?,
direction: 'in' | 'out',
body, mediaUrls: [s3Key],
sentAt, awsMessageId,
aiDrafted: bool, aiModel?, aiPromptVersion?,
inboundClassification?: 'status_check' | 'approval' | 'question' | 'other',
autoReplied: bool
```
Index: `{ shopId: 1, customerId: 1, sentAt: -1 }`.

### `payments`
```
_id, shopId, repairOrderId, customerId,
stripePaymentIntentId, amountCents, status, method, last4?, createdAt, completedAt?
```

### `aiInteractions` (cost/debug)
```
_id, shopId, kind, model, inputTokens, outputTokens, costCents, durationMs, createdAt
```

### `subscriptionEvents`
```
_id, shopId, type, stripeEventId, payload, createdAt
```

---

## API surface (HTTP API routes → Lambdas)

Each route is its own SST `Function`. Shared middleware (in `apps/api/src/lib/`):
- `withAuth` — verifies JWT cookie, attaches `user` + `shopId`
- `withDb` — caches `mongoose.connect` across warm invocations
- `withValidation(zodSchema)` — parses + types body/query
- `withErrorBoundary` — uniform error response shape

### Auth (`/auth`)
- `POST /auth/magic-link` — email a 15-min token
- `POST /auth/sms-code` — text a 6-digit code
- `POST /auth/verify` — exchange link/code for JWT cookie
- `POST /auth/logout`
- `GET  /auth/me`

### Onboarding (`/onboard`)
- `POST /onboard/shop` — create shop, provision SMS number, create Stripe customer
- `POST /onboard/sms-verify` — confirm Mike received a test text on his new shop number
- `POST /onboard/stripe-setup-intent` — start trial, collect card

### Shop (`/shop`)
- `GET /shop`
- `PATCH /shop` — name, address, hours, AI tone

### Customers (`/customers`)
- `GET /customers?q=&page=`
- `POST /customers`
- `GET /customers/:id`
- `PATCH /customers/:id`
- `GET /customers/:id/history` — all ROs + messages

### Vehicles (`/vehicles`)
- `POST /vehicles`
- `PATCH /vehicles/:id`
- `POST /vehicles/decode-vin` — proxies NHTSA vPIC, caches in Mongo

### Repair Orders (`/repair-orders`)
- `GET /repair-orders?status=&q=` — today's board
- `POST /repair-orders`
- `GET /repair-orders/:id`
- `PATCH /repair-orders/:id` — status, fields
- `POST /repair-orders/:id/line-items`
- `PATCH /repair-orders/:id/line-items/:lineId`
- `DELETE /repair-orders/:id/line-items/:lineId`
- `POST /repair-orders/:id/photos/presign` — returns S3 PUT URL
- `POST /repair-orders/:id/photos/confirm` — records `s3Key` after upload
- `POST /repair-orders/:id/voice-to-ro` — multipart audio → Bedrock → line items
- `POST /repair-orders/:id/send-estimate` — AI drafts message, sends SMS, sets `publicToken`

### Messaging (`/messages`)
- `GET /messages/conversation/:customerId?since=`
- `POST /messages/draft` — AI draft preview for owner to edit
- `POST /messages/send` — sends to customer via End User Messaging
- `POST /webhooks/sns/inbound` — SNS-subscribed handler for inbound SMS (classify → auto-reply or escalate)
- `POST /webhooks/sns/delivery` — delivery receipts

### Payments (`/payments`)
- `POST /payments/create-link` — for an RO, return public pay URL
- `POST /payments/save-card` — Setup Intent for card-on-file
- `POST /payments/charge` — authorize/capture against saved card on completion
- `POST /webhooks/stripe` — verify signature → update RO + payments

### Public customer endpoints (`/public`, no auth, token-scoped)
- `GET  /public/estimate/:token` — view estimate
- `POST /public/estimate/:token/approve`
- `POST /public/estimate/:token/decline`
- `GET  /public/pay/:token` — Stripe checkout shim
- `POST /public/pay/:token` — confirm payment intent

### Scheduled / event Lambdas
- Hourly: stale-RO reminder (cars in `ready` > 24h → nudge Mike)
- Daily: AI cost rollup per shop
- Stripe webhook: subscription lifecycle → `shops.billing.status`

---

## Frontend (`apps/web`) — file layout

```
src/
├─ main.tsx
├─ App.tsx                  # Mantine provider, router, auth gate
├─ theme.ts                 # Mantine theme (brand color, monospace-friendly)
├─ pwa-register.ts          # vite-plugin-pwa registration + install prompt
├─ routes/
│  ├─ (auth)/login.tsx
│  ├─ (auth)/verify.tsx
│  ├─ (onboarding)/welcome.tsx
│  ├─ (onboarding)/shop.tsx
│  ├─ (onboarding)/sms-test.tsx
│  ├─ (onboarding)/billing.tsx
│  ├─ (app)/_layout.tsx     # bottom-nav shell, header
│  ├─ (app)/board.tsx       # today's RO board (default landing)
│  ├─ (app)/ro/new.tsx
│  ├─ (app)/ro/[id].tsx
│  ├─ (app)/customers/index.tsx
│  ├─ (app)/customers/[id].tsx
│  ├─ (app)/messages/index.tsx
│  ├─ (app)/messages/[customerId].tsx
│  └─ (app)/settings.tsx
│  └─ public/
│     ├─ estimate/[token].tsx
│     └─ pay/[token].tsx
├─ features/
│  ├─ ro/
│  │  ├─ RoCard.tsx
│  │  ├─ RoStatusPicker.tsx
│  │  ├─ LineItemEditor.tsx
│  │  ├─ VoiceCapture.tsx   # mic button → Bedrock transcription
│  │  └─ PhotoCapture.tsx   # camera + S3 presigned upload
│  ├─ messaging/
│  │  ├─ ConversationView.tsx
│  │  ├─ MessageComposer.tsx
│  │  └─ AiDraftSheet.tsx   # bottom-sheet: edit AI draft before send
│  ├─ customer/CustomerForm.tsx
│  ├─ vehicle/VinDecoder.tsx
│  └─ payments/PaymentSheet.tsx
├─ lib/
│  ├─ api.ts                # typed fetch using shared Zod
│  ├─ auth.ts
│  ├─ query.ts              # TanStack Query client
│  └─ format.ts             # money, dates
└─ hooks/
   ├─ useShop.ts
   ├─ useROs.ts
   └─ useConversation.ts
```

State: **TanStack Query** for server state, Mantine's `useDisclosure` and local `useState` for UI. No Redux/Zustand needed at this scale.

Forms: **`@mantine/form`** with Zod resolver (`mantine-form-zod-resolver`).

PWA: install prompt shown on second session, manifest icons, offline shell that lets Mike at least open the board (cached) when WiFi drops.

---

## Feature plans (v1 scope, in build order)

### 1. Auth + onboarding (week 1)
- Email magic link via SES (template = single CTA). Token = signed JWT, 15-min TTL, single-use (hash stored on user).
- SMS code fallback (6-digit, 5-min TTL) using AWS End User Messaging.
- On verify, set HTTP-only `lift_session` cookie, JWT signed with secret from SSM.
- Onboarding wizard: shop info → provision SMS number (10DLC via End User Messaging) → test SMS → Stripe Setup Intent + 14-day trial.

### 2. Customers + vehicles (week 1)
- Manual create. VIN field triggers NHTSA vPIC decode → auto-fills year/make/model. Cached per-VIN in Mongo to avoid re-hitting NHTSA.
- Customer phone validated as E.164 (libphonenumber-js).
- TCPA opt-in captured on first outbound (auto-include opt-in language in onboarding SMS; record `smsOptInAt`).

### 3. Repair Orders — core (week 2)
- Create RO from customer or "+ New RO" button. Status defaults to `in`.
- Board view = grouped cards by status. Swipe/long-press to move status.
- Line items: labor (hours × rate) or part (qty × unit). Subtotals computed client-side, re-validated server-side.
- Photo capture: `<input type="file" accept="image/*" capture="environment">` → presigned S3 PUT → confirm endpoint.
- RO numbering: per-shop atomic counter via `findOneAndUpdate` on `shops.counters.ro`.

### 4. AI-drafted estimates (week 2–3) — **the wedge**
- "Send estimate" button → Lambda calls Bedrock Sonnet with prompt template (`packages/shared/prompts/estimate.ts`).
  - Inputs: line items, vehicle, shop name, AI tone setting.
  - Output: customer-friendly SMS body (~3 sentences) + plain-language line summary.
- Mike sees an **AiDraftSheet** with editable text + "Send" button. He's not forced to send AI verbatim.
- Send via End User Messaging → record in `messages`. Estimate URL with `publicToken` included in SMS.
- Customer taps link → mobile-friendly approve/decline page (no login). Approve sets `estimate.approvedAt`, fires status change to `in_repair`.

### 5. Two-way SMS + auto-reply (week 3)
- Inbound SMS arrives at AWS End User Messaging origination number → published to SNS topic → Lambda subscriber.
- Lambda: match `From` to a customer by phone+shop. If no match, drop with log.
- Classify with **Claude Haiku 4.5** (cheap): `status_check | approval | question | other`.
  - `status_check` + active RO → auto-reply with current status + ETA. No human in loop.
  - `approval` (e.g. "yes do it") with pending estimate → mark approved, auto-reply confirmation.
  - `question` / `other` → store, push notification to Mike's PWA, no auto-reply.
- All auto-replies flagged `autoReplied: true` so Mike can audit.
- Per-shop kill switch in settings (`autoReplyEnabled`).

### 6. Voice-to-RO (week 3–4)
- `VoiceCapture` records WebM/Opus → uploads to S3 (presigned) → Lambda triggers Bedrock.
- Use Bedrock's audio-capable Claude (or fall back to Amazon Transcribe → Sonnet for structuring) — confirm model availability in chosen region during build.
- Output: array of line items + a `concern` summary. Mike reviews + edits before saving.

### 7. Payments (week 4)
- Stripe Setup Intent during onboarding (no charge, just card-on-file for Lift subscription).
- For customer payments:
  - Pay link in SMS → `/public/pay/:token`.
  - Card-on-file flow: if customer paid before, we have `stripeCustomerId` → pre-authorize on completion, capture on pickup. Customer is told upfront via SMS.
- Stripe webhook handles all state transitions. Webhook signature verified.
- QuickBooks: CSV export endpoint that streams paid ROs in QB-import format. No native sync.

### 8. Day-view scheduling (week 4)
- Single screen showing today's ROs grouped by status.
- "Scheduled" status with a `scheduledFor` date.
- No tech/bay assignment. No drag-to-time. Explicitly not a calendar.

### 9. Settings (week 4)
- Shop info, hours, AI tone, auto-reply toggle, billing portal link (Stripe Customer Portal).
- Data export: zip of CSV files (customers, vehicles, ROs, messages, payments). Addresses Mike's "data lock-in" fear.

---

## Landing page (`apps/marketing`) plan

Single-page, pre-rendered, hosted at `lift.com` via separate CloudFront distribution.

Sections (in scroll order):

1. **Nav** — Logo · Features · Pricing · Login · "Start free trial" (primary)
2. **Hero**
   - H1: *"Stop fielding 'is my car ready' calls. Stay in the bay."*
   - Sub: *"Lift is the shop app for 1–3 bay independents. Built around AI that handles customer texts so you can keep wrenching."*
   - CTA: "Start your 14-day trial — $79/mo after, no per-tech fees"
   - Visual: phone mockup showing an AI-drafted estimate SMS thread
3. **"This is for you if…"** — bulleted, blunt:
   - You own a 1–3 bay shop
   - You're the owner, the tech, *and* the service advisor
   - You're tired of "is my car ready" texts
   - You don't have $400/mo for Shopmonkey
4. **"This is NOT for you if…"** — equally blunt anti-persona list (multi-location, has a dedicated SA, fleet-heavy, etc.). This is positioning, not throwaway copy.
5. **The wedge** — animated SMS exchange showing AI handling a status check and an estimate approval. "While you were under a hood, Lift answered 4 texts."
6. **Three feature blocks** — phone-first, AI messaging, get paid faster. Each with one short paragraph + screenshot.
7. **Pricing** — single card. $79/mo. What's included. What's *not* charged extra (techs, ROs, messages — all unlimited). 14-day trial, no card required to start.
8. **FAQ** — answers Mike's fears explicitly:
   - "Will I waste hours setting it up?" (10-min onboarding)
   - "Will customers hate AI texts?" (you approve every draft; AI only auto-replies to status checks)
   - "Can I get my data out?" (one-click CSV export, always)
   - "What about QuickBooks?" (CSV export today, native sync 2026)
   - "Why not Shopmonkey?" (you don't need 90% of what they ship; you do need to stop drowning)
9. **Footer** — small print, contact, TOS/privacy, status page link

Tech: same Mantine theme as the app for visual continuity. Pre-rendered HTML for SEO (target queries: "auto repair shop software small shop", "alternative to shopmonkey", "1 bay auto repair management"). One form on the page (start trial) posts to `apps/api`.

---

## Environment & secrets (`.env.example` to scaffold)

```
# Mongo
MONGODB_URI=
MONGODB_DB_NAME=lift

# Auth
JWT_SECRET=
COOKIE_DOMAIN=

# AWS (resolved by SST in deployed env; needed for local dev)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# AWS End User Messaging SMS
SMS_POOL_ID=
SMS_INBOUND_SNS_TOPIC_ARN=

# Bedrock
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_DRAFT=anthropic.claude-sonnet-4-6
BEDROCK_MODEL_CLASSIFY=anthropic.claude-haiku-4-5

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_LIFT_79=

# SES
SES_FROM_EMAIL=hello@lift.com

# S3
S3_PHOTOS_BUCKET=
CLOUDFRONT_PHOTOS_DOMAIN=

# Public URLs
WEB_APP_URL=http://localhost:5173
MARKETING_URL=http://localhost:5174
API_URL=http://localhost:4000
```

SST will inject deployed values via `Resource.<name>` bindings; the `.env.example` is the contract for local dev and for what to set in SSM/Secrets Manager.

---

## Critical files to create (build order)

1. `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`
2. `packages/shared/` — Mongoose models, Zod DTOs, prompt templates
3. `sst.config.ts` — VPC-less stack: HTTP API, Lambdas, S3 bucket, CloudFront, SNS topic
4. `apps/api/src/lib/` — middleware (`withAuth`, `withDb`, `withValidation`)
5. `apps/api/src/functions/auth/` — magic link + verify
6. `apps/web/` — Vite scaffold, Mantine provider, auth flow, board route
7. RO + customer features (in order above)
8. Bedrock prompts + AI draft sheet
9. SNS inbound handler + auto-reply
10. Stripe Setup Intent + customer pay flow
11. `apps/marketing/` — landing page

---

## Verification plan

For each feature group, test end-to-end before moving on:

- **Auth** — `pnpm dev` locally, request magic link, verify cookie, hit `/auth/me`.
- **Onboarding** — create shop, confirm SMS number provisions via `aws sms-voice-v2 describe-phone-numbers`, receive test SMS.
- **RO + photos** — create RO, snap photo, confirm S3 object exists, photo renders.
- **Estimate via SMS** — send estimate, receive on real phone, tap link, approve, see status flip to `in_repair`.
- **Inbound auto-reply** — text "is it ready" from a phone, confirm classifier called Bedrock, confirm auto-reply received within 10s.
- **Voice-to-RO** — record 20s describing a job, confirm structured line items returned.
- **Payment** — pay an RO via public link with Stripe test card, confirm webhook updates `payment.status = paid`.
- **Marketing** — Lighthouse mobile score ≥ 90 on Performance + SEO.
- **Cost guardrail** — query `aiInteractions` after a day of dogfood; confirm per-RO AI cost is < $0.05.

---

## Explicitly deferred (v2+)

- Native QuickBooks Online sync
- Multi-location / multi-shop ownership
- Tech assignment, time tracking, payroll
- Calendar/multi-resource scheduling
- Fleet/B2B account billing
- Marketing automation, review requests
- Native iOS/Android apps (PWA is v1)
- Mitchell 1 / Identifix integration
- Parts catalog integration (WORLDPAC, NAPA PROLink)
