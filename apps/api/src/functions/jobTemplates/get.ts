import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { JobTemplate } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { serializeJobTemplate, type JobTemplateLike } from "./_serialize.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  if (!user.shopId) return badRequest("No shop on session");
  const id = event.pathParameters?.id;
  if (!id) return badRequest("Missing template id");

  const template = await JobTemplate.findOne({ _id: id, shopId: user.shopId }).lean();
  if (!template) return notFound("Template not found");

  return ok({ template: serializeJobTemplate(template as unknown as JobTemplateLike) });
});
