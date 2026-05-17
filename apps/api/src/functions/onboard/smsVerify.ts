import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Shop } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";

/**
 * POST /onboard/sms-verify
 *
 * In MOCK_SMS mode the shop's SMS number is a fictional placeholder, so the
 * "send yourself a test text" step is a no-op acknowledgment. Once the real
 * 10DLC pool is wired (MOCK_SMS=0), this handler should send a test SMS to
 * the owner's phone and wait for confirmation. For now we just confirm the
 * shop has a phone number assigned.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const shop = await Shop.findById(user.shopId).lean();
  if (!shop) return badRequest("Shop not found");

  return ok({
    ok: true,
    smsNumber: shop.sms?.phoneNumber ?? null,
    mocked: process.env.MOCK_SMS === "1",
  });
});
