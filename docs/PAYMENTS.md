# Customer payments — Stripe Connect Standard

How a shop gets paid by its customers, as of 2026-08.

## Architecture

- Each shop gets its own **Stripe Connect Standard** account, created lazily —
  Settings → "Getting paid", or the prompt that appears the first time they tap
  "Text pay link" on an RO. Stripe hosts the onboarding (KYC, bank account).
- Charges are **direct charges on the connected account** (`stripeAccount`
  request option in `public/getPay.ts` / `public/pay.ts`). The shop pays
  Stripe's standard processing fees and owns refunds, disputes, and payouts in
  its own Stripe dashboard. **Lift takes no fee** — matches the PRD promise
  ("processing passed through at cost").
- Shop state lives on `shop.stripe.connectAccountId` /
  `connectChargesEnabled` / `connectDetailsSubmitted`, synced lazily by
  `POST /payments/connect/refresh` (called when Settings loads with a
  `?connect=` param after Stripe onboarding). Correctness does not depend on
  Connect webhooks.
- Until `connectChargesEnabled` is true: pay-link drafting/sending returns a
  403 with remediation copy, and `GET /public/pay/{token}` returns
  `payable: false` (the public page tells the customer to call the shop).

## Paid-state truth

`POST /public/pay/{token}` (the page's confirm ping) retrieves the
PaymentIntent on the connected account and flips the RO to paid. The
`payment_intent.succeeded` webhook handler also works for connected-account
events **once the one-time dashboard step below is done**.

### One-time manual step (per Stripe mode, test + live)

Stripe only delivers connected-account events to webhook endpoints registered
as **Connect** endpoints:

Dashboard → Developers → Webhooks → Add endpoint → same URL as the existing
platform endpoint (`POST /webhooks/stripe`) → select **"Listen to events on
Connected accounts"** → events: `payment_intent.succeeded`,
`payment_intent.payment_failed`. Use the same signing secret handling
(`StripeWebhookSecret`) — if Stripe issues a different secret for the Connect
endpoint, prefer pointing both endpoints at the same secret is NOT possible;
in that case add the Connect endpoint's secret as a second accepted secret or
rotate to a dedicated endpoint. Until this is configured, the confirm ping is
the effective source of paid state (same behavior as pre-Connect).

## Not built (deliberately)

- Application fees / platform cut — Lift takes none.
- Express/custom accounts, payout scheduling, refunds from within Lift.
- Card-on-file (`payments/save-card`, `payments/charge` exist but have no UI
  and still target the platform account — do not use them for connect shops
  without reworking them first).
