import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { User } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";

/** GET /team — everyone with a login to this shop. Visible to techs too. */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  if (!user.shopId) return badRequest("No shop on session");

  const members = await User.find({ shopId: user.shopId })
    .select("email phone role emailVerified auth.lastLoginAt createdAt")
    .sort({ role: 1, createdAt: 1 }) // "owner" < "tech"
    .lean();

  return ok({
    members: members.map((m) => ({
      id: String(m._id),
      email: m.email,
      phone: m.phone ?? null,
      role: m.role,
      // Never signed in yet = invite still pending.
      pending: !m.auth?.lastLoginAt,
      lastLoginAt: m.auth?.lastLoginAt ?? null,
      isYou: String(m._id) === user.userId,
    })),
  });
});
