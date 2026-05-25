import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { OnboardShopDto, Shop, User } from "@lift/shared";
import { PLAN_TRIAL_DAYS } from "@lift/shared/constants";
import { signSessionCookie } from "../../lib/auth.js";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { created, ok } from "../../lib/response.js";

/**
 * Mock SMS number assigned to every new shop until the 10DLC campaign is
 * approved and we can pull real numbers from the AWS End User Messaging pool.
 * Range 555-0100 to 555-0199 is reserved by NANPA for fictional use.
 */
const MOCK_SHOP_PHONE = "+15555550199";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    const dto = await parseBody(event, OnboardShopDto);

    // Idempotent: if the user already owns a shop, return it instead of creating a second.
    const existing = await Shop.findOne({ ownerUserId: user.userId });
    if (existing) {
      await User.updateOne({ _id: user.userId }, { $set: { shopId: existing._id } });
      // Refresh the session cookie so the JWT's shopId claim is current. The
      // JWT was minted at /auth/verify when the user had no shop yet.
      const cookie = await signSessionCookie({
        userId: user.userId,
        shopId: String(existing._id),
        email: user.email,
        role: user.role,
      });
      return ok(
        {
          shop: {
            id: String(existing._id),
            name: existing.name,
            sms: existing.sms,
            billing: existing.billing,
          },
        },
        { headers: { "Set-Cookie": cookie } }
      );
    }

    const trialEndsAt = new Date(Date.now() + PLAN_TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const shop = await Shop.create({
      name: dto.name,
      address: dto.address,
      timezone: dto.timezone,
      ownerUserId: user.userId,
      sms: {
        phoneNumber: MOCK_SHOP_PHONE,
        awsPhonePoolId: "mock-pool",
        optInScript:
          `By providing your phone number, you agree to receive SMS messages from ${dto.name} about your repair order. ` +
          `Reply STOP to opt out, HELP for help. Msg & data rates may apply.`,
      },
      billing: { plan: "lift_79", trialEndsAt },
      settings: { aiTone: "plain", autoReplyEnabled: true },
    });

    await User.updateOne({ _id: user.userId }, { $set: { shopId: shop._id } });

    // Refresh the session cookie so subsequent calls have shopId in the JWT.
    // Without this, every authenticated route post-onboarding fails with
    // "No shop on session" until the user signs out and back in.
    const cookie = await signSessionCookie({
      userId: user.userId,
      shopId: String(shop._id),
      email: user.email,
      role: user.role,
    });

    return created(
      {
        shop: {
          id: String(shop._id),
          name: shop.name,
          sms: shop.sms,
          billing: shop.billing,
        },
      },
      { headers: { "Set-Cookie": cookie } }
    );
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
