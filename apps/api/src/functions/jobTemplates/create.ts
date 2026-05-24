import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { CreateJobTemplateDto, JobTemplate } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, created } from "../../lib/response.js";
import { serializeJobTemplate, type JobTemplateLike } from "./_serialize.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, CreateJobTemplateDto);

    const template = await JobTemplate.create({
      shopId: user.shopId,
      name: dto.name,
      category: dto.category,
      notes: dto.notes,
      lineItems: dto.lineItems,
      source: "custom",
    });

    return created({
      template: serializeJobTemplate(template.toObject() as unknown as JobTemplateLike),
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
