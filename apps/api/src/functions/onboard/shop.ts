import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { OnboardShopDto, STARTER_DEFAULT_LABOR_RATE_CENTS, Shop, User } from "@lift/shared";
import {
  PLAN_TRIAL_DAYS,
  buildOptInScript,
  resolveShopTimezone,
} from "@lift/shared/constants";
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

    // Idempotent: if the user already owns a shop — or was invited to one as
    // a tech — return that shop instead of creating a second.
    const me = await User.findById(user.userId).select("shopId").lean();
    const existing = me?.shopId
      ? await Shop.findById(me.shopId)
      : await Shop.findOne({ ownerUserId: user.userId });
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
      // State decides the zone (SC → Eastern); the browser's zone from the
      // onboarding client breaks ties for split states and covers "no state".
      timezone: resolveShopTimezone(dto.address?.state, dto.timezone),
      ownerUserId: user.userId,
      // No phoneNumber: shops without one send from the shared Lift number
      // (SMS_POOL_ID), and inbound routes by the customer's phone (snsInbound).
      // Setting the shared number here would break that routing — the per-shop
      // destination lookup would match an arbitrary shop. Assign a phoneNumber
      // only once shops get dedicated numbers.
      sms: {
        // Mirrors the verbal disclosure registered with our 10DLC campaign —
        // see buildOptInScript for the carrier-vetting constraints on its wording.
        optInScript: buildOptInScript(dto.name),
      },
      billing: { plan: "lift_79", trialEndsAt },
      settings: {
        aiTone: "plain",
        autoReplyEnabled: true,
        // Matches the starter templates' $135/hr so the first labor row and
        // the imported jobs agree.
        defaultLaborRate: dto.defaultLaborRate ?? STARTER_DEFAULT_LABOR_RATE_CENTS,
      },
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
