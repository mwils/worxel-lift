import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type Stripe from "stripe";
import { Payment, RepairOrder, Shop, SubscriptionEvent } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, badRequest } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const sig = event.headers?.["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret || !event.body) return badRequest("Missing signature");

  let parsed: Stripe.Event;
  try {
    parsed = stripe().webhooks.constructEvent(event.body, sig, secret);
  } catch (err) {
    return badRequest(`Webhook signature failed: ${(err as Error).message}`);
  }

  // Idempotency: ignore if we've already processed this event id.
  const existing = await SubscriptionEvent.findOne({ stripeEventId: parsed.id }).lean();
  if (existing) return ok({ ok: true, duplicate: true });

  await SubscriptionEvent.create({
    stripeEventId: parsed.id,
    type: parsed.type,
    payload: parsed.data.object,
  });

  try {
    switch (parsed.type) {
      case "payment_intent.succeeded": {
        const pi = parsed.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(pi);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = parsed.data.object as Stripe.PaymentIntent;
        console.warn("[stripe webhook] payment_intent.payment_failed", {
          id: pi.id,
          roId: pi.metadata?.roId,
          last_payment_error: pi.last_payment_error?.message,
        });
        // Leave RO untouched per spec; the owner can retry.
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = parsed.data.object as Stripe.Subscription;
        await applySubscriptionToShop(sub);
        break;
      }
      case "invoice.payment_failed": {
        const inv = parsed.data.object as Stripe.Invoice;
        if (inv.subscription) {
          const subId = typeof inv.subscription === "string" ? inv.subscription : inv.subscription.id;
          await Shop.updateOne(
            { "stripe.subscriptionId": subId },
            { $set: { "stripe.status": "past_due" } }
          );
        }
        break;
      }
      default:
        console.log("[stripe webhook] unhandled", parsed.type);
    }
  } catch (err) {
    // Don't swallow — Stripe will retry, which is what we want.
    console.error("[stripe webhook] handler error", parsed.type, err);
    throw err;
  }

  return ok({ ok: true });
});

async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const roId = pi.metadata?.roId;
  if (!roId) {
    console.log("[stripe webhook] payment_intent.succeeded without roId", pi.id);
    return;
  }

  const ro = await RepairOrder.findById(roId);
  if (!ro) {
    console.warn("[stripe webhook] RO not found for PI", { piId: pi.id, roId });
    return;
  }

  if (ro.payment?.status !== "paid") {
    ro.payment = {
      ...(ro.payment ?? {}),
      stripePaymentIntentId: pi.id,
      status: "paid",
      paidAt: new Date(),
    };
    await ro.save();
  }

  // Upsert / update Payment doc.
  let last4: string | undefined;
  if (pi.latest_charge && typeof pi.latest_charge !== "string") {
    last4 = pi.latest_charge.payment_method_details?.card?.last4 ?? undefined;
  }
  await Payment.updateOne(
    { stripePaymentIntentId: pi.id },
    {
      $setOnInsert: {
        shopId: ro.shopId,
        repairOrderId: ro._id,
        customerId: ro.customerId,
        stripePaymentIntentId: pi.id,
        amountCents: pi.amount,
        method: "card",
      },
      $set: {
        status: "succeeded",
        last4,
        completedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function applySubscriptionToShop(sub: Stripe.Subscription) {
  const status = sub.status as
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "unpaid"
    | "paused";

  // Normalize to the shop schema's enum.
  const persistStatus = ([
    "trialing",
    "active",
    "past_due",
    "canceled",
    "incomplete",
  ] as const).includes(status as "trialing")
    ? (status as "trialing" | "active" | "past_due" | "canceled" | "incomplete")
    : "incomplete";

  const update: Record<string, unknown> = {
    "stripe.status": persistStatus,
    "stripe.subscriptionId": sub.id,
  };
  if (sub.current_period_end) {
    update["stripe.currentPeriodEnd"] = new Date(sub.current_period_end * 1000);
  }
  if (sub.trial_end) {
    update["billing.trialEndsAt"] = new Date(sub.trial_end * 1000);
  }

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  await Shop.updateOne(
    { "stripe.customerId": customerId },
    { $set: update }
  );
}
