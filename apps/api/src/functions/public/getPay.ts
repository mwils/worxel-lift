import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type Stripe from "stripe";
import { Customer, RepairOrder, Shop } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound, serverError } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

/**
 * GET /public/pay/:token
 *
 * Token-scoped public endpoint. Resolves an RO by its public pay token,
 * (re)uses or creates a PaymentIntent for the open balance, and returns the
 * client secret + minimal display info for the public pay page.
 *
 * Charges are created DIRECTLY on the shop's Stripe Connect Standard account
 * (`stripeAccount` request option) — the shop pays Stripe's fees and owns
 * disputes/payouts; Lift takes no cut. A shop that hasn't finished payment
 * setup gets a clean `payable: false` state, not an error.
 */
export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const ro = await RepairOrder.findOne({ publicToken: token });
  if (!ro) return notFound();
  if (!ro.total || ro.total <= 0) return notFound();

  const [customer, shop] = await Promise.all([
    Customer.findById(ro.customerId).lean(),
    Shop.findById(ro.shopId).lean(),
  ]);
  if (!shop) return notFound();

  const display = {
    ro: { number: ro.number, total: ro.total, status: ro.status },
    customer: customer
      ? { firstName: customer.firstName, lastName: customer.lastName ?? null }
      : null,
    shop: { name: shop.name },
  };

  if (ro.payment?.status === "paid") {
    // Already paid — still return basic info so the client can render a "paid" state.
    return ok({
      clientSecret: null,
      stripeAccountId: null,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "MISSING",
      paid: true,
      payable: false,
      ...display,
    });
  }

  const accountId = shop.stripe?.connectAccountId;
  if (!accountId || shop.stripe?.connectChargesEnabled !== true) {
    // Lazy payment setup hasn't happened (or isn't finished) for this shop.
    return ok({
      clientSecret: null,
      stripeAccountId: null,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "MISSING",
      paid: false,
      payable: false,
      ...display,
    });
  }
  if (!customer) return notFound();

  try {
    const s = stripe();
    const connectOpts = { stripeAccount: accountId };

    // Reuse an existing open intent if one is recorded.
    let intent: Stripe.PaymentIntent | null = null;
    if (ro.payment?.stripePaymentIntentId) {
      try {
        const existing = await s.paymentIntents.retrieve(
          ro.payment.stripePaymentIntentId,
          connectOpts
        );
        const reusable = ["requires_payment_method", "requires_confirmation", "requires_action", "processing"];
        if (reusable.includes(existing.status) && existing.amount === ro.total) {
          intent = existing;
        }
      } catch (err) {
        // Also covers intents minted on the platform account before Connect
        // rollout — they simply don't resolve on the connected account.
        console.warn("[getPay] failed to retrieve PI, creating new", (err as Error).message);
      }
    }

    if (!intent) {
      intent = await s.paymentIntents.create(
        {
          amount: ro.total,
          currency: "usd",
          description: `RO-${String(ro.number).padStart(4, "0")} — ${shop.name}`,
          receipt_email: customer.email ?? undefined,
          automatic_payment_methods: { enabled: true },
          metadata: {
            roId: String(ro._id),
            shopId: String(ro.shopId),
            customerId: String(ro.customerId),
            source: "public_pay",
          },
        },
        { ...connectOpts, idempotencyKey: `ro-public-pay-${String(ro._id)}-${ro.total}` }
      );

      ro.payment = {
        ...(ro.payment ?? {}),
        stripePaymentIntentId: intent.id,
        status: ro.payment?.status ?? "unpaid",
      };
      await ro.save();
    }

    return ok({
      clientSecret: intent.client_secret,
      stripeAccountId: accountId,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "MISSING",
      paid: false,
      payable: true,
      ...display,
    });
  } catch (err) {
    // Don't leak Stripe internals to an anonymous customer; the page shows a
    // "something went wrong — call the shop" state on 5xx.
    console.error("[getPay] stripe failure", err);
    return serverError("Couldn't start this payment");
  }
});
