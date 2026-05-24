import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { JobTemplate } from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";
import { serializeJobTemplate, type JobTemplateLike } from "./_serialize.js";

const ListQuery = z.object({
  includeArchived: z
    .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
    .optional(),
  q: z.string().optional(),
});

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const { includeArchived, q } = parseQuery(event, ListQuery);
    const showArchived = includeArchived === "true" || includeArchived === "1";

    const filter: Record<string, unknown> = { shopId: user.shopId };
    if (!showArchived) filter.archivedAt = { $exists: false };
    if (q && q.trim()) {
      const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { category: rx }];
    }

    const templates = await JobTemplate.find(filter)
      .sort({ lastUsedAt: -1, name: 1 })
      .lean();

    return ok({
      templates: templates.map((t) => serializeJobTemplate(t as unknown as JobTemplateLike)),
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
