import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Shop, UpdateShopDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, UpdateShopDto);

    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.address !== undefined) update.address = dto.address;
    if (dto.timezone !== undefined) update.timezone = dto.timezone;
    if (dto.settings?.aiTone !== undefined) update["settings.aiTone"] = dto.settings.aiTone;
    if (dto.settings?.autoReplyEnabled !== undefined) {
      update["settings.autoReplyEnabled"] = dto.settings.autoReplyEnabled;
    }

    const shop = await Shop.findOneAndUpdate(
      { _id: user.shopId },
      { $set: update },
      { new: true }
    ).lean();
    if (!shop) return notFound("Shop not found");

    return ok({
      shop: {
        id: String(shop._id),
        name: shop.name,
        address: shop.address,
        timezone: shop.timezone,
        sms: { phoneNumber: shop.sms?.phoneNumber },
        billing: shop.billing,
        settings: shop.settings,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
