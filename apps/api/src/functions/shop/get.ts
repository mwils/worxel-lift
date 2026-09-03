import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Shop } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const shop = await Shop.findById(user.shopId).lean();
  if (!shop) return notFound("Shop not found");
  return ok({
    shop: {
      id: String(shop._id),
      name: shop.name,
      slug: shop.slug ?? null,
      oldSlugs: shop.oldSlugs ?? [],
      address: shop.address,
      phone: shop.phone ?? null,
      timezone: shop.timezone,
      sms: { phoneNumber: shop.sms?.phoneNumber },
      billing: shop.billing,
      settings: shop.settings,
    },
  });
});
