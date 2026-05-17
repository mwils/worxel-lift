import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type Stripe from "stripe";
import { Shop, User } from "@lift/shared";
import { PLAN_TRIAL_DAYS } from "@lift/shared/constants";
import { withAuth } from "../../lib/middleware.js";
import { ok, badRequest, notFound } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

/**
 * POST /onboard/stripe-setup-intent
 *
 * Idempotently creates a Stripe Customer + Subscription (trialing) for the
 * owner's shop and returns a Setup Intent client secret the frontend will use
 * with Stripe Elements to collect a card-on-file before the trial converts.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  const priceId = process.env.STRIPE_PRICE_ID_LIFT_79;
  if (!priceId) {
    return badRequest("STRIPE_PRICE_ID_LIFT_79 is not configured");
  }

  if (!user.shopId) return badRequest("User has no shop yet — finish /onboard/shop first");

  const shop = await Shop.findById(user.shopId);
  if (!shop) return notFound("Shop not found");

  const owner = await User.findById(user.userId).lean();
  const ownerEmail = owner?.email ?? user.email;

  const s = stripe();
  const shopIdStr = String(shop._id);

  // 1. Stripe Customer (idempotent on shopId).
  if (!shop.stripe?.customerId) {
    const customer = await s.customers.create(
      {
        email: ownerEmail,
        name: shop.name,
        metadata: { shopId: shopIdStr },
      },
      { idempotencyKey: `shop-customer-${shopIdStr}` }
    );
    shop.stripe = { ...(shop.stripe ?? {}), customerId: customer.id };
    await shop.save();
  }

  // 2. Subscription with trial + incomplete payment so we can collect card.
  let subscription: Stripe.Subscription | null = null;

  if (shop.stripe.subscriptionId) {
    try {
      subscription = await s.subscriptions.retrieve(shop.stripe.subscriptionId, {
        expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
      });
    } catch (err) {
      // Stale id — recreate.
      console.warn("[stripeSetup] failed to retrieve sub, recreating", (err as Error).message);
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await s.subscriptions.create(
      {
        customer: shop.stripe.customerId!,
        items: [{ price: priceId }],
        trial_period_days: PLAN_TRIAL_DAYS,
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
        metadata: { shopId: shopIdStr },
      },
      { idempotencyKey: `shop-sub-${shopIdStr}` }
    );
    shop.stripe = {
      ...shop.stripe,
      subscriptionId: subscription.id,
      status: subscription.status as typeof shop.stripe.status,
      currentPeriodEnd: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : undefined,
    };
    shop.billing = {
      plan: shop.billing?.plan ?? "lift_79",
      trialEndsAt: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : shop.billing?.trialEndsAt,
    };
    await shop.save();
  }

  // 3. Pull a Setup Intent client secret. With default_incomplete + trial,
  // Stripe exposes a `pending_setup_intent` for collecting card-on-file.
  const setupIntent = subscription.pending_setup_intent as Stripe.SetupIntent | null | undefined;
  let clientSecret = setupIntent?.client_secret ?? null;

  // Fallback: if there's no pending SI, fall back to the latest_invoice's PI.
  if (!clientSecret) {
    const li = subscription.latest_invoice as Stripe.Invoice | null | undefined;
    const pi = li && typeof li !== "string" ? (li.payment_intent as Stripe.PaymentIntent | null) : null;
    clientSecret = pi?.client_secret ?? null;
  }

  // Last resort: create a standalone SetupIntent against the customer.
  if (!clientSecret) {
    const si = await s.setupIntents.create({
      customer: shop.stripe.customerId!,
      usage: "off_session",
      metadata: { shopId: shopIdStr, reason: "subscription_fallback" },
    });
    clientSecret = si.client_secret;
  }

  return ok({
    clientSecret,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "MISSING",
    subscription: {
      id: subscription.id,
      status: subscription.status,
      trialEnd: subscription.trial_end,
      currentPeriodEnd: subscription.current_period_end,
    },
  });
});
