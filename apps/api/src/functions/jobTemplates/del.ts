import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { JobTemplate } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const id = event.pathParameters?.id;
  if (!id) return badRequest("Missing template id");

  const template = await JobTemplate.findOneAndUpdate(
    { _id: id, shopId: user.shopId },
    { $set: { archivedAt: new Date() } },
    { new: true }
  ).lean();
  if (!template) return notFound("Template not found");

  return ok({ id: String(template._id), archivedAt: template.archivedAt });
});
