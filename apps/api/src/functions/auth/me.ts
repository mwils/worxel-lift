import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { User, Shop } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  const u = await User.findById(user.userId).lean();
  if (!u) return notFound("User not found");
  const shop = u.shopId ? await Shop.findById(u.shopId).lean() : null;
  return ok({
    user: {
      id: String(u._id),
      email: u.email,
      role: u.role,
      shopId: u.shopId ? String(u.shopId) : null,
    },
    shop: shop
      ? {
          id: String(shop._id),
          name: shop.name,
          settings: shop.settings,
          billing: shop.billing,
          sms: { phoneNumber: shop.sms?.phoneNumber },
        }
      : null,
  });
});
