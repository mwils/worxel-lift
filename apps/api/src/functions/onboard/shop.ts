import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { OnboardShopDto, Shop, User } from "@lift/shared";
import { PLAN_TRIAL_DAYS } from "@lift/shared/constants";
import { signSessionCookie } from "../../lib/auth.js";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { created, ok } from "../../lib/response.js";

const SALES_API_URL = process.env.SALES_API_URL ?? "";

// Tells the cold-outreach back office that this prospect just started a trial.
// Fire-and-forget: never block onboarding on this network call.
async function reportTrialSignup(pid: string, email: string): Promise<void> {
  if (!SALES_API_URL || !pid) return;
  try {
    const res = await fetch(`${SALES_API_URL.replace(/\/$/, "")}/api/public/trial-signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid, email, signupAt: new Date().toISOString() }),
    });
    if (!res.ok) {
      console.warn("trial-signup callback non-2xx", { status: res.status });
    }
  } catch (err) {
    console.warn("trial-signup callback failed", err);
  }
}

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
      // No phoneNumber: shops without one send from the shared Lift number
      // (SMS_POOL_ID), and inbound routes by the customer's phone (snsInbound).
      // Setting the shared number here would break that routing — the per-shop
      // destination lookup would match an arbitrary shop. Assign a phoneNumber
      // only once shops get dedicated numbers.
      sms: {
        optInScript:
          `By providing your phone number, you agree to receive SMS messages from ${dto.name} about your repair order. ` +
          `Reply STOP to opt out, HELP for help. Msg & data rates may apply.`,
      },
      billing: { plan: "lift_79", trialEndsAt },
      settings: { aiTone: "plain", autoReplyEnabled: true },
    });

    await User.updateOne({ _id: user.userId }, { $set: { shopId: shop._id } });

    if (dto.pid) {
      // Don't await — the callback is a side-effect that must never block trial creation.
      void reportTrialSignup(dto.pid, user.email);
    }

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
