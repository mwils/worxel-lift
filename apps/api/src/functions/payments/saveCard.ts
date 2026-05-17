import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, SaveCardDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { ok, badRequest, notFound } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

/**
 * POST /payments/save-card
 *
 * Returns a SetupIntent client secret so the shop can collect a card-on-file
 * for a customer. Creates a Stripe Customer for the contact if one doesn't
 * already exist.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("User has no shop");
    const { customerId } = await parseBody(event, SaveCardDto);

    const customer = await Customer.findOne({ _id: customerId, shopId: user.shopId });
    if (!customer) return notFound("Customer not found");

    const s = stripe();
    const customerIdStr = String(customer._id);

    if (!customer.stripeCustomerId) {
      const created = await s.customers.create(
        {
          email: customer.email ?? undefined,
          name: [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || undefined,
          phone: customer.phone,
          metadata: {
            shopId: String(user.shopId),
            customerId: customerIdStr,
          },
        },
        { idempotencyKey: `customer-${customerIdStr}` }
      );
      customer.stripeCustomerId = created.id;
      await customer.save();
    }

    const setupIntent = await s.setupIntents.create({
      customer: customer.stripeCustomerId!,
      usage: "off_session",
      payment_method_types: ["card"],
      metadata: {
        shopId: String(user.shopId),
        customerId: customerIdStr,
      },
    });

    return ok({
      clientSecret: setupIntent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "MISSING",
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
