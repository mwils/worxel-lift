import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RepairOrder } from "@lift/shared";
import { handleKnownErrors, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { applyRoTotals } from "./_totals.js";

/**
 * POST /repair-orders/:id/apply-tax
 *
 * Re-stamp the shop's CURRENT tax setting onto this RO and recompute its
 * totals. The RO page offers this when the RO's snapshot (or lack of one, for
 * pre-snapshot ROs) differs from Settings — the owner opts in per RO; a rate
 * change in Settings never rewrites ROs on its own.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing repair order id");

    const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    await applyRoTotals(ro, user.shopId, { refreshFromShop: true });
    await ro.save();

    return ok({
      taxRateBps: ro.taxRateBps ?? 0,
      taxAppliesTo: ro.taxAppliesTo ?? "parts",
      totals: {
        laborTotal: ro.laborTotal,
        partsTotal: ro.partsTotal,
        taxTotal: ro.taxTotal ?? 0,
        total: ro.total,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
