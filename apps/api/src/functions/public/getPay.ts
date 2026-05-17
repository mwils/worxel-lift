import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import type Stripe from "stripe";
import { Customer, RepairOrder, Shop } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

/**
 * GET /public/pay/:token
 *
 * Token-scoped public endpoint. Resolves an RO by its public pay token,
 * (re)uses or creates a PaymentIntent for the open balance, and returns the
 * client secret + minimal display info for the public pay page.
 *
 * v1 uses the platform's single Stripe account. Multi-tenant connected
 * accounts (each shop has its own Stripe Connect account, Lift takes a
 * platform fee) is deferred.
 */
export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const ro = await RepairOrder.findOne({ publicToken: token });
  if (!ro) return notFound();
  if (!ro.total || ro.total <= 0) return notFound();
  if (ro.payment?.status === "paid") {
    // Already paid — still return basic info so the client can render a "paid" state.
    const [customer, shop] = await Promise.all([
      Customer.findById(ro.customerId).lean(),
      Shop.findById(ro.shopId).lean(),
    ]);
    return ok({
      clientSecret: null,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "MISSING",
      paid: true,
      ro: { number: ro.number, total: ro.total, status: ro.status },
      customer: customer
        ? { firstName: customer.firstName, lastName: customer.lastName ?? null }
        : null,
      shop: shop ? { name: shop.name } : null,
    });
  }

  const [customer, shop] = await Promise.all([
    Customer.findById(ro.customerId),
    Shop.findById(ro.shopId).lean(),
  ]);
  if (!customer || !shop) return notFound();

  const s = stripe();

  // Optional: ensure a Stripe customer for receipts / re-saving the card.
  if (!customer.stripeCustomerId) {
    const created = await s.customers.create(
      {
        email: customer.email ?? undefined,
        name: [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || undefined,
        phone: customer.phone,
        metadata: { shopId: String(shop._id), customerId: String(customer._id) },
      },
      { idempotencyKey: `customer-${String(customer._id)}` }
    );
    customer.stripeCustomerId = created.id;
    await customer.save();
  }

  // Reuse an existing open intent if one is recorded.
  let intent: Stripe.PaymentIntent | null = null;
  if (ro.payment?.stripePaymentIntentId) {
    try {
      const existing = await s.paymentIntents.retrieve(ro.payment.stripePaymentIntentId);
      const reusable = ["requires_payment_method", "requires_confirmation", "requires_action", "processing"];
      if (reusable.includes(existing.status) && existing.amount === ro.total) {
        intent = existing;
      }
    } catch (err) {
      console.warn("[getPay] failed to retrieve PI, creating new", (err as Error).message);
    }
  }

  if (!intent) {
    intent = await s.paymentIntents.create(
      {
        amount: ro.total,
        currency: "usd",
        customer: customer.stripeCustomerId,
        description: `RO-${String(ro.number).padStart(4, "0")} — ${shop.name}`,
        automatic_payment_methods: { enabled: true },
        setup_future_usage: "off_session",
        metadata: {
          roId: String(ro._id),
          shopId: String(ro.shopId),
          customerId: String(ro.customerId),
          source: "public_pay",
        },
      },
      { idempotencyKey: `ro-public-pay-${String(ro._id)}-${ro.total}` }
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
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "MISSING",
    paid: false,
    ro: { number: ro.number, total: ro.total, status: ro.status },
    customer: { firstName: customer.firstName, lastName: customer.lastName ?? null },
    shop: { name: shop.name },
  });
});
