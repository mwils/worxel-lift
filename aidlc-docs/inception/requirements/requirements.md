# Requirements — Lift v1

> **Source**: derived from [`docs/PLAN.md`](../../../docs/PLAN.md) and the existing scaffold; cross-references [`docs/PERSONA.md`](../../../docs/PERSONA.md) for who each requirement is for.
> **Depth**: Standard (the codebase is largely scaffolded; this document formalizes the requirements that PLAN.md states informally so they can be traced to user stories, units, and tests).
> **Approval**: Self-approved by orchestrator on 2026-05-24T20:50:00Z (autonomous run; user delegated authority).

## 1. Intent Analysis

**Stated intent** (from PLAN.md §1): *"Mike installs in <10 min during a slow afternoon and sends an AI-drafted estimate via SMS the same day."*

**Operationalized:** Lift v1 must enable a 1–3 bay independent auto repair shop owner (Mike) to:
1. Sign up self-serve, complete onboarding in ≤10 minutes, and start a 14-day no-card trial.
2. Receive customer SMS at a dedicated shop number; have the system auto-reply to routine status checks and surface everything else with an AI-drafted reply.
3. Create a digital RO from his phone, attach photos and/or a voice memo, send an AI-drafted estimate over SMS, and accept a one-tap approval.
4. Accept customer payment via Stripe (link in SMS / card-on-file).
5. Run a public booking page, send service-due reminders, and export all data on demand.

## 2. Functional Requirements

Numbering: **FR-<n>**. Each FR is traceable to a business transaction (BT-) from `reverse-engineering/business-overview.md` and to code paths in `apps/api/src/functions/`.

### 2.1 Authentication & Identity

| ID | Requirement | Trace |
|---|---|---|
| FR-1 | A shop owner shall be able to request a magic-link email by entering only an email address. | BT-1; `auth/magicLink.ts` |
| FR-2 | A magic-link click shall verify the token, set a JWT cookie (`lift_session`, HTTP-only, Secure, SameSite=Lax), and redirect to the appropriate route (onboarding or board). | BT-1; `auth/verify.ts` |
| FR-3 | The system shall provide an SMS-code fallback for users whose email is delayed or blocked. | `auth/smsCode.ts` |
| FR-4 | The current session shall be queryable at `/auth/me` to return user + shop summary. | `auth/me.ts` |
| FR-5 | A logout endpoint shall clear the `lift_session` cookie. | `auth/logout.ts` |

### 2.2 Onboarding

| ID | Requirement | Trace |
|---|---|---|
| FR-6 | A new user shall be able to create a shop (name, address, timezone) in a single API call. | BT-1, BT-2; `onboard/shop.ts` |
| FR-7 | Shop creation shall provision a dedicated two-way SMS number via AWS End User Messaging. | BT-2; `onboard/shop.ts` |
| FR-8 | Shop creation shall create a Stripe Customer and store its ID on the shop record. | BT-3; `onboard/shop.ts` |
| FR-9 | The user shall be able to verify the SMS number by confirming receipt of a test text. | BT-2; `onboard/smsVerify.ts` |
| FR-10 | The user shall be able to start a Stripe Checkout Session / Setup Intent for the trial; **no card is required to start the trial** — payment method capture is deferred until day 12+. | BT-3; `onboard/stripeSetup.ts` |
| FR-11 | Onboarding shall complete in ≤10 minutes for a typical user (informational target; not enforced in code). | Persona §5, PLAN.md §1 |

### 2.3 Shop Management

| ID | Requirement | Trace |
|---|---|---|
| FR-12 | The shop owner shall be able to read shop settings, including timezone, AI tone, auto-reply toggle, booking enabled, hours. | `shop/get.ts` |
| FR-13 | The shop owner shall be able to update settings via PATCH, including disabling AI auto-reply with a single toggle ("kill-switch"). | `shop/patch.ts` |

### 2.4 Customers & Vehicles

| ID | Requirement | Trace |
|---|---|---|
| FR-14 | The system shall provide paged customer search filtered by free-text query. | `customers/list.ts` |
| FR-15 | The system shall create-or-find a customer keyed on (shopId, phone) idempotently. Phone is required and must be valid E.164. | `customers/create.ts`, DTO validates with `e164` |
| FR-16 | The system shall return customer detail. | `customers/get.ts` |
| FR-17 | The system shall update customer fields via PATCH. | `customers/patch.ts` |
| FR-18 | The system shall return a unified history (ROs + messages, chronologically) for a customer. | `customers/history.ts` |
| FR-19 | The system shall create a vehicle linked to a customer (year, make, model, optionally VIN/plate). | `vehicles/create.ts` |
| FR-20 | The system shall update vehicle fields via PATCH. | `vehicles/patch.ts` |
| FR-21 | The system shall return a per-vehicle history of ROs. | `vehicles/history.ts` |
| FR-22 | The system shall decode VINs to year/make/model via a cached lookup; cache hits shall not incur external API cost. | `vehicles/decodeVin.ts` |

### 2.5 Repair Orders

| ID | Requirement | Trace |
|---|---|---|
| FR-23 | The system shall list ROs paged, filterable by status. Status enum: `in`, `in_repair`, `ready`, `picked_up`. | `repairOrders/list.ts` |
| FR-24 | The system shall create an RO under a (customer, vehicle), atomically incrementing the shop's RO counter and minting a random `publicToken`. | `repairOrders/create.ts` |
| FR-25 | The system shall return RO detail including line items, photos, status, publicToken (visible only to the owner). | `repairOrders/get.ts` |
| FR-26 | The system shall update RO status / concern / notes via PATCH. | `repairOrders/patch.ts` |
| FR-27 | The system shall provide line-item CRUD with automatic total recomputation (labor, parts, tax, total — all in cents). | `repairOrders/lineItems.ts`, `_totals.ts` |
| FR-28 | The system shall add/update inspection items (green/yellow/red severity) on an RO. | `repairOrders/inspectionItem.ts` |
| FR-29 | The system shall return an S3 presigned PUT URL for photo uploads and persist photo metadata after upload confirmation. | `repairOrders/photosPresign.ts`, `photosConfirm.ts` |
| FR-30 | The system shall return an S3 presigned PUT URL for voice memos and accept a structuring request that runs Transcribe → Bedrock to produce structured line items. | `repairOrders/voicePresign.ts`, `voiceToRo.ts` |
| FR-31 | The system shall generate an AI-drafted estimate SMS body and send it to the customer; the publicToken-bound link in the SMS shall let the customer approve/decline without logging in. | BT-5, BT-6; `repairOrders/sendEstimate.ts` |
| FR-32 | The system shall generate an AI-drafted inspection summary SMS and send it to the customer; the link displays photos grouped by severity. | BT-9; `repairOrders/sendInspection.ts` |

### 2.6 Customer SMS Messaging

| ID | Requirement | Trace |
|---|---|---|
| FR-33 | The system shall display a conversation thread between the shop and a customer, sorted by `sentAt`. | `messages/conversation.ts` |
| FR-34 | The system shall produce an AI-drafted reply preview, given the conversation context. | `messages/draft.ts` |
| FR-35 | The system shall send a message via End User Messaging (or SES fallback while `MOCK_SMS=1`). Outbound messages are logged with `direction=out`. | `messages/send.ts`, `lib/sms.ts` |
| FR-36 | The system shall handle inbound SMS via SNS topic subscription: match phone+shopId → customer; if no match, log and drop. | BT-7; `webhooks/snsInbound.ts` |
| FR-37 | Inbound messages shall be classified via Bedrock (`BEDROCK_MODEL_CLASSIFY`). Classification categories: `status_check`, `estimate_approval`, `question`, `other`. | `webhooks/snsInbound.ts` + `packages/shared/src/prompts/` |
| FR-38 | When classified as `status_check`, the system shall auto-reply with the current state of the customer's open RO, **flagged `autoReplied=true`**. The shop owner can switch this off in `shop.settings`. | FR-13; `webhooks/snsInbound.ts` |
| FR-39 | When classified as `estimate_approval`, the system shall update the corresponding RO's approval state. | `webhooks/snsInbound.ts` |
| FR-40 | When classified as `question` or `other`, the system shall log the message, push-notify the owner, and **not** auto-reply. | `webhooks/snsInbound.ts` |

### 2.7 Public Customer Endpoints

| ID | Requirement | Trace |
|---|---|---|
| FR-41 | Customer-facing endpoints shall be reachable only via random unguessable tokens. No login. | All `public/*` handlers |
| FR-42 | The estimate page shall render an RO's line items, total, and approve/decline buttons. | `public/getEstimate.ts`, `approveEstimate.ts`, `declineEstimate.ts` |
| FR-43 | The inspection page shall render photos grouped by severity (green/yellow/red), each with a note. | `public/getInspection.ts` |
| FR-44 | The pay page shall render the RO total and the Stripe payment surface. | `public/getPay.ts`, `pay.ts` |
| FR-45 | The booking page (`/public/book/:slug`) shall let a customer pick a slot from available times and submit a booking that creates customer + vehicle + RO atomically. | BT-11; `public/{getBook,getBookSlots,book}.ts`, `_slots.ts` |
| FR-46 | The booking creation shall send an SMS confirmation to the customer (unless opted out) and notify the owner on their personal phone. | `public/book.ts` |
| FR-47 | A customer with a booking token shall be able to view, reschedule, or cancel the booking. | `public/{getBooking,rescheduleBooking,cancelBooking}.ts` |

### 2.8 Payments (Customer-Paying-Shop)

| ID | Requirement | Trace |
|---|---|---|
| FR-48 | The system shall create a Stripe payment link for an RO and return the URL to the owner. | `payments/createLink.ts` |
| FR-49 | The system shall support manual capture of a saved-card pre-auth. | `payments/charge.ts` |
| FR-50 | The system shall support saving a card-on-file via Stripe Setup Intent. | `payments/saveCard.ts` |
| FR-51 | The Stripe webhook shall be idempotent (dedup by `stripeEventId`) and shall update `Payment.status` and RO status (`picked_up`) on `payment_intent.succeeded`. | `webhooks/stripe.ts` |

### 2.9 Job Templates

| ID | Requirement | Trace |
|---|---|---|
| FR-52 | The owner shall be able to CRUD saved jobs (labor lines + parts lines bundled). | `jobTemplates/{create,get,list,patch,del}.ts` |
| FR-53 | The owner shall be able to apply a saved job to an RO in two taps. | `jobTemplates/apply.ts` |
| FR-54 | A starter library of common saved jobs shall be available; the owner can one-click import it. | `jobTemplates/starterLibrary.ts`, `importStarter.ts` |

### 2.10 Service Reminders

| ID | Requirement | Trace |
|---|---|---|
| FR-55 | The system shall scan daily for due reminders and send SMS to the customer using the same outbound path as messages. | BT-12; `serviceReminders/dailyScan.ts` |
| FR-56 | Reminders shall be per-customer, per-vehicle, and time-based (e.g., 90 days after an oil change). | `serviceReminders/_serialize.ts` |
| FR-57 | The owner shall be able to list, edit, or cancel reminders. | `serviceReminders/list.ts`, `patch.ts` |
| FR-58 | The owner shall be able to disable all reminders for a specific vehicle. | `serviceReminders/disableForVehicle.ts` |

### 2.11 Billing (Shop Subscription)

| ID | Requirement | Trace |
|---|---|---|
| FR-59 | The owner shall be able to open the Stripe Customer Portal via a redirect. | `billing/portal.ts` |
| FR-60 | The Stripe webhook shall update `Shop.stripe.status` and `currentPeriodEnd` on subscription events. | `webhooks/stripe.ts` |

### 2.12 Data Export

| ID | Requirement | Trace |
|---|---|---|
| FR-61 | The owner shall be able to export all shop data as a zip of CSVs (customers, vehicles, ROs, messages, payments). The export shall function **even after subscription cancellation**. | BT-15; `data/export.ts` |

### 2.13 Cross-cutting

| ID | Requirement | Trace |
|---|---|---|
| FR-62 | All authenticated endpoints shall reject requests without a valid JWT cookie. | `lib/auth.ts` `withAuth` |
| FR-63 | All authenticated endpoints shall scope every query by `ctx.user.shopId`; body-supplied shopIds shall be ignored. | `CLAUDE.md` convention |
| FR-64 | Every AI call shall log to `aiInteractions` with `inputTokens`, `outputTokens`, `costCents`, `durationMs`. | `lib/bedrock.ts` |
| FR-65 | Phone numbers shall be validated as E.164 at API boundaries. | `dto/index.ts` `e164` |
| FR-66 | Monetary fields shall be stored and computed as integer cents. | All RO/payment code |

## 3. Non-Functional Requirements

Numbering: **NFR-<n>**.

### 3.1 Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-1 | Lambda cold-start p95 for authenticated endpoints. | <2.5s |
| NFR-2 | Lambda warm-execution p95 for read endpoints. | <300ms |
| NFR-3 | Bedrock classify p95 for inbound SMS. | <2s |
| NFR-4 | Inbound-SMS auto-reply end-to-end (publish on EUM → outbound SMS sent). | <10s |
| NFR-5 | Per-RO AI cost (sum of drafts + classifies for one RO lifecycle). | < **$0.05** |
| NFR-6 | Marketing site Lighthouse mobile Performance + SEO. | ≥90 |
| NFR-7 | Marketing site time-to-interactive (mobile, 4G simulated). | <3s |

### 3.2 Reliability

| ID | Requirement | Target |
|---|---|---|
| NFR-8 | Stripe webhook idempotency. | Dedup by `stripeEventId` on insert into `SubscriptionEvent` |
| NFR-9 | Inbound SMS — no auto-reply on classify confidence <0.85 (configurable). | Graceful fallback to "notify owner only" |
| NFR-10 | MongoDB connection reuse across warm invocations. | Cached `mongoose.connect` via `connectDb` |
| NFR-11 | Lambda timeout. | 10s default; longer for `voiceToRo` (Transcribe poll) |

### 3.3 Security

| ID | Requirement | Source |
|---|---|---|
| NFR-12 | All authenticated API traffic over HTTPS. | API Gateway default |
| NFR-13 | JWT cookie is HTTP-only, Secure, SameSite=Lax. | `lib/auth.ts` |
| NFR-14 | Multi-tenancy isolation: queries always filter by `ctx.user.shopId`; never trust body-supplied shopId. | `CLAUDE.md` |
| NFR-15 | Public token endpoints use cryptographically-random tokens (≥24 bytes base64url). | `public/book.ts` shows `randomBytes(24).toString("base64url")` |
| NFR-16 | Stripe webhook signature verification with `StripeWebhookSecret`. | `webhooks/stripe.ts` |
| NFR-17 | Customer PII (name, phone, email) is access-controlled by `shopId` only. | Per-shop tenancy |
| NFR-18 | SES sandbox / sender-domain verification required before prod email. | Operational |
| NFR-19 | 10DLC SMS campaign approval required before disabling `MOCK_SMS=1`. | Operational |
| NFR-20 | Secrets are managed via `sst secret set` — never committed to git. | SST convention |
| NFR-21 | TCPA / SMS opt-out: customers can opt out of SMS via `STOP` keyword and via `Customer.smsOptOutAt`; outbound code respects this flag. | `public/book.ts` checks `customer.smsOptOutAt` |

### 3.4 Privacy / Data Lifecycle

| ID | Requirement |
|---|---|
| NFR-22 | Data export must produce machine-readable CSVs in a QuickBooks-importable format. |
| NFR-23 | Data export must function after subscription cancellation (no lock-in). |
| NFR-24 | Per Persona §10, "no lock-in" is a hard requirement; deletion-on-request must be supported once a deletion endpoint exists (deferred from v1 — track in operations backlog). |

### 3.5 Compliance / Trust

| ID | Requirement |
|---|---|
| NFR-25 | Auto-replies are tagged `autoReplied=true` so the owner can audit. |
| NFR-26 | Owner can disable AI auto-reply in one tap. |
| NFR-27 | Outbound SMS from booking must respect `Customer.smsOptOutAt`. |
| NFR-28 | No fabricated customer testimonials or quantified outcomes in marketing copy. (See `EMAIL_CAMPAIGN_BRIEF.md` §15, `PERSONA.md` §16.) |

### 3.6 Operational

| ID | Requirement |
|---|---|
| NFR-29 | All Lambda code in TypeScript, compiled with TS strict mode. |
| NFR-30 | All AWS infra defined in `sst.config.ts` — no manual console changes. |
| NFR-31 | Removal policy `retain` on prod. |
| NFR-32 | The codebase is a pnpm monorepo; `packages/shared` is the source of truth for data shapes. |

## 4. Extension Compliance Summary

| Extension | Status | Rationale |
|---|---|---|
| `security/baseline` | **Enabled** | Lift handles auth, PII, payments, SMS, AWS resources. NFR-12 through NFR-21 + NFR-27 satisfy the baseline; details rolled into per-unit NFR docs during Construction. |
| `testing/property-based` | **Disabled** | Test suite is not yet established. Re-evaluate during the build-and-test phase. No compliance check needed at this stage. |

## 5. Traceability

Every FR above is annotated with:
- A **business transaction** (BT-) from the reverse-engineering business overview
- A **code path** in `apps/api/src/functions/` (and/or `apps/web/`, `packages/shared/`)

This produces forward traceability (BT → FR → code) and reverse traceability (code → FR → BT). User stories (next stage) will be tagged with FR IDs.

## 6. Open Questions / Out-of-Scope (v1 deferred)

Per `docs/PLAN.md` §"Explicitly deferred":
- Native QuickBooks Online sync (CSV export only in v1)
- Multi-location / multi-shop ownership
- Tech assignment, time tracking, payroll
- Calendar / multi-resource scheduling
- Fleet / B2B account billing
- Marketing automation, review-request campaigns
- Native iOS/Android apps (PWA only)
- Mitchell 1 / Identifix integration
- Parts catalog integration (WORLDPAC, NAPA PROLink)

These are explicitly out of v1 scope and not represented as requirements. If a stakeholder asks for them, route to v2 roadmap discussion.
