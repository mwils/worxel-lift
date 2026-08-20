import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Shop } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

/**
 * POST /payments/connect/refresh
 *
 * Pulls the shop's Connect account state from Stripe and persists it. Called
 * by Settings when the owner returns from Stripe-hosted onboarding — we sync
 * lazily instead of depending on Connect webhooks for correctness.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  if (!user.shopId) return badRequest("No shop on session");

  const shop = await Shop.findById(user.shopId);
  if (!shop) return notFound("Shop not found");

  const accountId = shop.stripe?.connectAccountId;
  if (!accountId) {
    return ok({ hasAccount: false, chargesEnabled: false, detailsSubmitted: false });
  }

  const account = await stripe().accounts.retrieve(accountId);
  shop.set("stripe.connectChargesEnabled", account.charges_enabled === true);
  shop.set("stripe.connectDetailsSubmitted", account.details_submitted === true);
  await shop.save();

  return ok({
    hasAccount: true,
    chargesEnabled: account.charges_enabled === true,
    detailsSubmitted: account.details_submitted === true,
  });
});
