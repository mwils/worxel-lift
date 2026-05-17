import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Shop } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { ok, badRequest, notFound } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

/**
 * POST /billing/portal-session
 *
 * Creates a Stripe Billing Portal session for the owner's shop and returns
 * the hosted URL. The frontend redirects the browser to it.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  if (!user.shopId) return badRequest("User has no shop yet");

  const shop = await Shop.findById(user.shopId);
  if (!shop) return notFound("Shop not found");

  const customerId = shop.stripe?.customerId;
  if (!customerId) {
    return badRequest(
      "Shop has no Stripe customer — finish the onboarding billing step first"
    );
  }

  const returnUrl = `${process.env.WEB_APP_URL ?? ""}/settings`;

  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return ok({ url: session.url });
});
