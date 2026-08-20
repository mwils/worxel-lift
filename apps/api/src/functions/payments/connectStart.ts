import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Shop, User } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

/**
 * POST /payments/connect/start
 *
 * Lazy payment setup: creates the shop's Stripe Connect Standard account on
 * first call, then returns a fresh Stripe-hosted onboarding link. Safe to call
 * repeatedly — an unfinished account just gets a new Account Link ("finish
 * setup"). Charges are made directly on the connected account, so the shop
 * pays Stripe's standard fees and owns disputes/payouts; Lift takes no cut.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  if (!user.shopId) return badRequest("No shop on session");

  const shop = await Shop.findById(user.shopId);
  if (!shop) return notFound("Shop not found");

  const s = stripe();

  let accountId = shop.stripe?.connectAccountId;
  if (!accountId) {
    const owner = await User.findById(shop.ownerUserId).lean();
    const account = await s.accounts.create(
      {
        type: "standard",
        email: owner?.email,
        business_profile: { name: shop.name },
        metadata: { shopId: String(shop._id) },
      },
      { idempotencyKey: `connect-account-${String(shop._id)}` }
    );
    accountId = account.id;
    shop.set("stripe.connectAccountId", accountId);
    shop.set("stripe.connectChargesEnabled", false);
    shop.set("stripe.connectDetailsSubmitted", false);
    await shop.save();
  }

  const base = process.env.WEB_APP_URL ?? "";
  const link = await s.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: `${base}/settings?connect=return`,
    refresh_url: `${base}/settings?connect=refresh`,
  });

  return ok({ url: link.url });
});
