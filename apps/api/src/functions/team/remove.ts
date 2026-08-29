import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { User } from "@lift/shared";
import { withOwnerAuth } from "../../lib/middleware.js";
import { badRequest, noContent, notFound } from "../../lib/response.js";

/**
 * DELETE /team/{userId}  (owner only)
 *
 * Detaches a tech from the shop. The user row stays (their email may be tied
 * to sign-in history); they become a shop-less account — signing in again
 * drops them at onboarding, as an owner of nothing, and withOwnerAuth's DB
 * check means any live cookie loses owner-only routes immediately.
 */
export const handler: APIGatewayProxyHandlerV2 = withOwnerAuth(async ({ event, user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const id = event.pathParameters?.userId;
  if (!id) return badRequest("userId required");
  if (id === user.userId) return badRequest("You can't remove yourself");

  const member = await User.findOne({ _id: id, shopId: user.shopId });
  if (!member) return notFound("Not a member of this shop");
  if (member.role === "owner") return badRequest("Can't remove the shop owner");

  await User.updateOne(
    { _id: member._id },
    { $unset: { shopId: 1, "auth.magicLinkHash": 1, "auth.magicLinkExpiresAt": 1 }, $set: { role: "owner" } }
  );
  return noContent();
});
