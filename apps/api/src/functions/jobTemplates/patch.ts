import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { JobTemplate, UpdateJobTemplateDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { serializeJobTemplate, type JobTemplateLike } from "./_serialize.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing template id");

    const dto = await parseBody(event, UpdateJobTemplateDto);

    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    if (dto.name !== undefined) set.name = dto.name;
    if (dto.category !== undefined) {
      if (dto.category === null) unset.category = "";
      else set.category = dto.category;
    }
    if (dto.reminderCategory !== undefined) {
      if (dto.reminderCategory === null) unset.reminderCategory = "";
      else set.reminderCategory = dto.reminderCategory;
    }
    if (dto.notes !== undefined) {
      if (dto.notes === null) unset.notes = "";
      else set.notes = dto.notes;
    }
    if (dto.lineItems !== undefined) set.lineItems = dto.lineItems;

    const update: Record<string, unknown> = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const template = await JobTemplate.findOneAndUpdate(
      { _id: id, shopId: user.shopId },
      update,
      { new: true }
    ).lean();
    if (!template) return notFound("Template not found");

    return ok({ template: serializeJobTemplate(template as unknown as JobTemplateLike) });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
