# Lift v1 — Completion Plan

Cross-reference with [`docs/PLAN.md`](./PLAN.md) for product detail. This doc tracks the remaining stubs and groups them into ship-together slices.

## Status snapshot (as of 2026-05-16)

| Area | Done | Stubbed |
|---|---|---|
| Auth | magic-link, sms-code, verify, me, logout, cookie cross-subdomain | — |
| Onboarding | shop create | sms-verify, stripe-setup-intent |
| Customers | — | list, create, get, patch, history |
| Vehicles | decode-vin (NHTSA cached) | create, patch |
| Repair orders | — | list, create, get, patch, line-items×3, photos×2, voice-to-ro, send-estimate |
| Messages | — | conversation, draft, send |
| Payments | — | save-card, create-link, charge |
| Public | get-estimate, approve, decline | get-pay, pay |
| Webhooks | stripe (signature+dedup) | sns-inbound, sns-delivery |
| Frontend | login, verify, onboarding wizard, board, public estimate, settings (UI only) | ro/new, ro/detail, customers list+detail, messages inbox+conversation, public pay |

67 TODO/stub markers remain.

## Slice plan

Slices designed so each one ends in a clickable, end-to-end behavior. Slice A is foundational; B–F can run in parallel after A; G–H are tidying.

### Slice A — Foundation CRUD (blocks everything)

Build the data path that every other feature stands on.

**Backend** (`apps/api/src/functions/`):
- `shop/get.ts`, `shop/patch.ts` — return + update the owner's shop
- `customers/list.ts` (`?q=&page=`), `create.ts`, `get.ts`, `patch.ts`, `history.ts` (paginated ROs + messages)
- `vehicles/create.ts`, `patch.ts`
- `repairOrders/list.ts` (`?status=&q=`), `create.ts`, `get.ts`, `patch.ts`
- `repairOrders/lineItems.ts` — fill `createHandler`, `patchHandler`, `deleteHandler`; recompute totals on every mutation

**Frontend** (`apps/web/src/`):
- `routes/app/customers.tsx` → searchable list + "+ New" modal using `CreateCustomerDto`
- `routes/app/customers/detail.tsx` → customer + vehicles + history
- `routes/app/ro/new.tsx` → pick/create customer + vehicle (with VIN decode), submit
- `routes/app/ro/detail.tsx` → status picker, line item editor, totals
- Replace board's TODO list with real `useROs()` query

**Acceptance**: log in → onboard → create a customer → add a vehicle (VIN decodes) → create an RO → add line items → see totals + RO on the board.

### Slice B — The wedge (AI estimates over mocked SMS)

This is the value prop. Depends on A's RO and line items being real.

**Backend**:
- `messages/draft.ts` — POST { customerId, repairOrderId?, kind, context } → calls Bedrock Sonnet via `invokeClaude` using `buildEstimatePrompt` / `buildStatusReplyPrompt` based on `kind`. Logs to `aiInteractions`.
- `messages/send.ts` — POST { customerId, body, repairOrderId?, mediaKeys? } → inserts `Message`, calls `sendSms` with `mockEmailRecipient = customer.email ?? owner.email`.
- `messages/conversation.ts` — GET conversation history with cursor pagination.
- `repairOrders/sendEstimate.ts` — generates `publicToken` if absent, drafts via Bedrock, sends via `sendSms`, sets `estimate.sentAt`.

**Frontend**:
- `features/messaging/AiDraftSheet.tsx` — bottom sheet that POSTs `/messages/draft`, lets owner edit, then POSTs `/messages/send`.
- "Send estimate" button on RO detail → calls send-estimate, then shows the sent draft in the conversation.
- `features/messaging/ConversationView.tsx` — message bubbles by direction.
- `routes/app/messages.tsx` (inbox) → list of recent conversations.
- `routes/app/messages/conversation.tsx` → ConversationView + composer.

**Acceptance**: on an RO with line items, click Send Estimate → owner sees AI draft → edits + sends → email arrives in mock recipient inbox → click public estimate link → approve → RO flips to `in_repair`.

### Slice C — Inbound SMS + auto-reply

**Backend**:
- `webhooks/snsInbound.ts` — resolve shop by destinationNumber, resolve customer by phone+shopId, insert inbound `Message`, classify with Haiku via `buildClassifyInboundPrompt`. On `status_check` + active RO → auto-reply with `buildStatusReplyPrompt`. On `approval` + open estimate → mark approved + auto-reply confirmation.
- `webhooks/snsDelivery.ts` — update message delivery status by `awsMessageId`.
- `_dev/sns/inbound` route (dev-only) for simulating inbound without real SNS.

**Frontend**: messages inbox surfaces inbound + autoReplied badge.

**Acceptance**: POST a synthetic inbound to `/_dev/sns/inbound` with body "is my car ready" → mock email arrives at owner with auto-reply body, classification logged in DB.

### Slice D — Photos

**Backend**:
- `repairOrders/photosPresign.ts` — returns presigned S3 PUT URL + key (use `presignUpload` from `lib/s3`).
- `repairOrders/photosConfirm.ts` — append `{ s3Key, takenAt }` to RO's `photos` array.

**Frontend**:
- `features/ro/PhotoCapture.tsx` — `<input type="file" accept="image/*" capture="environment">`, presign, PUT direct to S3, confirm.
- Render photos on RO detail.

**Acceptance**: snap a photo from phone on an RO → S3 object exists → photo renders.

### Slice E — Voice-to-RO

**Backend**:
- `repairOrders/voiceToRo.ts` — receives a presigned-uploaded audio S3 key OR direct multipart upload (decide: presigned cleaner). Run Bedrock audio Claude (or Transcribe → Sonnet pipeline if regional gaps). Apply `buildVoiceToRoPrompt`. Return draft line items (do NOT persist; owner reviews + saves).

**Frontend**:
- `features/ro/VoiceCapture.tsx` — `MediaRecorder` → opus webm → presign → upload → POST → show draft → owner edits + saves to RO.

**Acceptance**: record 20s in browser → POST → returns structured line items → owner saves → they appear on the RO.

### Slice F — Payments (the trial loop + customer pay)

**Backend**:
- `onboard/stripeSetup.ts` — create Stripe Customer (idempotent on shop), create Subscription with `STRIPE_PRICE_ID_LIFT_79` + 14-day trial, return clientSecret of the Setup Intent.
- `payments/saveCard.ts` — Setup Intent against existing Stripe Customer.
- `payments/createLink.ts` — generate `publicToken` if absent, return public pay URL.
- `payments/charge.ts` — Payment Intent against saved card, confirm.
- `public/getPay.ts`, `public/pay.ts` — return RO + client secret; confirm.
- Extend `webhooks/stripe.ts` switch: `payment_intent.succeeded` → mark RO paid; `customer.subscription.*` → update `shop.billing.status`.

**Frontend**:
- `routes/onboarding.tsx` step 3 → Stripe Setup Intent w/ Payment Element.
- `features/payments/PaymentSheet.tsx` — used on RO detail for taking payment.
- `routes/public/pay.tsx` — Stripe Payment Element + confirm.

**Acceptance**: trial setup intent succeeds in test mode; pay link in SMS opens public page → test card → webhook flips RO to paid.

### Slice G — Onboarding loose ends

- `onboard/smsVerify.ts` — in mock mode just acknowledges the test text; in real mode sends one and waits for confirmation. Just acknowledge for now.
- Hook up settings page buttons (AI tone, auto-reply toggle, billing portal link, export CSV).

### Slice H — Polish

- Settings actually persists via `PATCH /shop`.
- Data export endpoint (zip CSV per collection).
- Conversation pagination.
- Error states / empty states across the app.

## Execution

Slice A is sequential — every other slice imports its CRUD endpoints from the frontend.

After A lands, B/C/D/E/F can run in parallel (different files, no overlap).

G/H are last-mile polish.

## Per-slice checklist (each agent must follow)

1. Read `CLAUDE.md` and `docs/PLAN.md` for the relevant feature section.
2. Reuse existing Zod DTOs from `packages/shared/dto` — do not redeclare schemas.
3. Reuse existing Mongoose models — never edit shared models without flagging it.
4. Every authenticated handler: `withAuth`, parse with `parseBody(event, ZodSchema)`, filter every query by `shopId: user.shopId`.
5. Every Bedrock call: write an `AiInteraction` row.
6. Every SMS send: pass `mockEmailRecipient: customer.email ?? ownerEmail` so MOCK_SMS=1 routes through SES.
7. Run `pnpm -r typecheck` and `pnpm -r build` at end. Must pass.
8. Mark stubs deleted (`replace_all` the `todoHandler` line).
9. Do NOT touch `sst.config.ts` routes — all routes are already wired; only the function bodies change.
