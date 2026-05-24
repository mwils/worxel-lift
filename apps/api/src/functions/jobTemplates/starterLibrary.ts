import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { JobTemplate, STARTER_TEMPLATES } from "@lift/shared";
import { withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";
import { computeLineItemTotal } from "../repairOrders/_totals.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ user }) => {
  if (!user.shopId) return badRequest("No shop on session");

  const existing = await JobTemplate.find(
    { shopId: user.shopId, starterKey: { $in: STARTER_TEMPLATES.map((s) => s.starterKey) } },
    { starterKey: 1 }
  ).lean();
  const importedKeys = new Set(existing.map((e) => e.starterKey));

  return ok({
    starters: STARTER_TEMPLATES.map((s) => {
      const items = s.lineItems.map((li) => ({
        kind: li.kind,
        description: li.description,
        hours: li.hours ?? null,
        rate: li.rate ?? null,
        qty: li.qty ?? null,
        unitPrice: li.unitPrice ?? null,
        total: computeLineItemTotal(li),
      }));
      return {
        starterKey: s.starterKey,
        name: s.name,
        category: s.category,
        lineItems: items,
        itemCount: items.length,
        priceTotal: items.reduce((acc, it) => acc + it.total, 0),
        imported: importedKeys.has(s.starterKey),
      };
    }),
  });
});
