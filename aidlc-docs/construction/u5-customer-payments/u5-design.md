# U5 — Customer Payments

> **Status**: Documenting existing code. Self-approved on 2026-05-24T21:30:00Z.
> **Scope note**: This unit covers **payments from Mike's customers to Mike** (the revenue stream Mike collects). The **Lift subscription** ($79/mo Mike pays Lift) is in U1's billing portal + the subscription side of the Stripe webhook. Two-faced webhook lives in one file (`webhooks/stripe.ts`) but the customer-payment branches are owned by U5.

## Functional Design

**Key business rules:**

1. **Pay link is a Stripe URL** generated server-side and sent to the customer in an SMS. Customer taps → Stripe-hosted Checkout / PaymentIntent confirmation → webhook updates the RO.
2. **Card-on-file** (Setup Intent) lets returning customers store a card so the next RO can be pre-authorized at completion time.
3. **Stripe webhook is idempotent** — every event is upserted into `SubscriptionEvent` keyed by `stripeEventId`. Duplicate deliveries do not double-update payments.
4. **On `payment_intent.succeeded`**: update `Payment.status=paid`, set `Payment.paidAt`, transition RO to `picked_up` (if not already), record receipt details.
5. **Card processing fees pass through at cost.** Lift takes no cut on customer payments — these are Mike's revenue.
6. **Public pay page** is token-scoped (no login). Token is on the `Payment` document (or derived from the RO's `publicToken`).

**Stories covered**: US-E1, US-E2, US-E3.
**Requirements covered**: FR-48, FR-49, FR-50, FR-51, FR-44.

## NFR Requirements (in scope)

| NFR | Scope |
|---|---|
| NFR-8 | Stripe webhook idempotency (dedup by `stripeEventId`) |
| NFR-12 | All payment endpoints HTTPS |
| NFR-15 | Public payment tokens are cryptographically random |
| NFR-16 | Stripe webhook signature verification with `StripeWebhookSecret` |
| NFR-20 | `StripeSecretKey`, `StripeWebhookSecret`, `StripePublishableKey` via SST secrets |

## NFR Design

- **Webhook idempotency** is enforced by inserting into `SubscriptionEvent` with `{ stripeEventId: 1 }` unique index. On duplicate-key error, log and return 200 without re-processing.
- **Signature verification**: webhook handler uses `stripe.webhooks.constructEvent` with `StripeWebhookSecret`. Invalid signature → 400, no state change.
- **Token security**: payment tokens are stored on `Payment.publicToken` (random 24 bytes base64url). Public endpoint validates the token before any state read.
- **PCI scope**: Lift never sees card numbers. All card capture is Stripe-hosted; Lift only holds Stripe customer IDs and payment intent IDs.

## Infrastructure Design

| Resource | Purpose |
|---|---|
| Lambda `payments/createLink` | Generate pay URL |
| Lambda `payments/charge` | Manual capture of pre-auth |
| Lambda `payments/saveCard` | Setup Intent for card-on-file |
| Lambda `public/getPay`, `public/pay` | Customer-facing public pay |
| Lambda `webhooks/stripe` | Webhook (both customer-payment + subscription event branches) |
| Mongo collection: `payments` | Index: `{ shopId: 1, repairOrderId: 1 }`, `{ publicToken: 1 }` |
| Mongo collection: `subscriptionEvents` | Index: `{ stripeEventId: 1 }` unique |
| Stripe: PaymentIntent, Customer, SetupIntent | External |
| Stripe: webhook endpoint | Points at `webhooks/stripe` Lambda |

## Code Map

| Function | File |
|---|---|
| Pay link create | `apps/api/src/functions/payments/createLink.ts` |
| Manual charge | `apps/api/src/functions/payments/charge.ts` |
| Save card | `apps/api/src/functions/payments/saveCard.ts` |
| Public get-pay | `apps/api/src/functions/public/getPay.ts` |
| Public pay submit | `apps/api/src/functions/public/pay.ts` |
| Stripe webhook | `apps/api/src/functions/webhooks/stripe.ts` |
| Stripe SDK wrapper | `apps/api/src/lib/stripe.ts` |

**Models**: `Payment`, `SubscriptionEvent` — `packages/shared/src/models/{payment,subscriptionEvent}.ts`.
