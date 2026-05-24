import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  ImportStarterTemplatesDto,
  JobTemplate,
  STARTER_TEMPLATES,
  STARTER_DEFAULT_LABOR_RATE_CENTS,
  Shop,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";
import { serializeJobTemplate, type JobTemplateLike } from "./_serialize.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, ImportStarterTemplatesDto);

    const shop = await Shop.findById(user.shopId).lean();
    const shopLaborRate = shop?.settings?.defaultLaborRate ?? STARTER_DEFAULT_LABOR_RATE_CENTS;

    const requested = new Set(dto.starterKeys);
    const starters = STARTER_TEMPLATES.filter((s) => requested.has(s.starterKey));
    const unknown = dto.starterKeys.filter(
      (k) => !STARTER_TEMPLATES.some((s) => s.starterKey === k)
    );

    const existing = await JobTemplate.find(
      { shopId: user.shopId, starterKey: { $in: starters.map((s) => s.starterKey) } },
      { starterKey: 1 }
    ).lean();
    const already = new Set(existing.map((e) => e.starterKey));

    const toCreate = starters.filter((s) => !already.has(s.starterKey));
    const created = await Promise.all(
      toCreate.map((s) =>
        JobTemplate.create({
          shopId: user.shopId,
          name: s.name,
          category: s.category,
          source: "starter",
          starterKey: s.starterKey,
          lineItems: s.lineItems.map((li) => ({
            kind: li.kind,
            description: li.description,
            hours: li.hours,
            // Labor rows stamp the shop's default rate at import; parts/fees keep their unitPrice.
            rate: li.kind === "labor" ? shopLaborRate : li.rate,
            qty: li.qty,
            unitPrice: li.unitPrice,
          })),
        })
      )
    );

    return ok({
      imported: created.map((t) =>
        serializeJobTemplate(t.toObject() as unknown as JobTemplateLike)
      ),
      skipped: Array.from(already),
      unknown,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
