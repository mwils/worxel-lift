import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { User, Shop } from "@lift/shared";
import { resolveTaxSettings } from "@lift/shared/constants";
import { isCompanyAdmin, signSessionCookie } from "../../lib/auth.js";
import { withAuth } from "../../lib/middleware.js";
import { notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  const u = await User.findById(user.userId).lean();
  if (!u) return notFound("User not found");
  const shop = u.shopId ? await Shop.findById(u.shopId).lean() : null;

  // Defensive cookie refresh: if the DB's shopId disagrees with the JWT's
  // (e.g. user finished onboarding through a flow that didn't re-issue the
  // cookie), mint a new one so subsequent withAuth calls see the right shopId.
  const dbShopId = u.shopId ? String(u.shopId) : undefined;
  const jwtShopId = user.shopId ?? undefined;
  const stale = dbShopId !== jwtShopId;
  const refreshHeaders = stale
    ? {
        "Set-Cookie": await signSessionCookie({
          userId: String(u._id),
          shopId: dbShopId,
          email: u.email,
          role: (u.role as "owner" | "tech") ?? "owner",
        }),
      }
    : undefined;

  return ok(
    {
      user: {
        id: String(u._id),
        email: u.email,
        role: u.role,
        shopId: u.shopId ? String(u.shopId) : null,
        // undefined (pre-instant-signup accounts) counts as verified.
        emailVerified: u.emailVerified !== false,
        // Lift-the-company back office (blog admin, etc.) — email allowlist,
        // not a tenant role.
        isCompanyAdmin: isCompanyAdmin(u.email),
      },
      shop: shop
        ? {
            id: String(shop._id),
            name: shop.name,
            slug: shop.slug ?? null,
            // Settings' Shop profile edits these in place.
            address: shop.address ?? null,
            phone: shop.phone ?? null,
            // Scheduled visit times are rendered in the shop's zone, not the
            // browser's — an owner travelling must still see local bay times.
            timezone: shop.timezone,
            // Tax is always surfaced in the bps shape, even for shops still
            // carrying the round-1 percent fields.
            settings: { ...shop.settings, ...resolveTaxSettings(shop.settings) },
            billing: shop.billing,
            sms: { phoneNumber: shop.sms?.phoneNumber },
            payments: {
              hasAccount: !!shop.stripe?.connectAccountId,
              chargesEnabled: shop.stripe?.connectChargesEnabled === true,
              detailsSubmitted: shop.stripe?.connectDetailsSubmitted === true,
            },
          }
        : null,
    },
    refreshHeaders ? { headers: refreshHeaders } : undefined
  );
});
