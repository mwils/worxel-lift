import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import { RepairOrder } from "@lift/shared";
import { handleKnownErrors, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { ensureCustomerHistoryUrl } from "../../lib/accountLink.js";

export function publicReceiptUrl(token: string): string {
  const base = (process.env.WEB_APP_URL ?? "http://localhost:5173").replace(/\/+$/, "");
  return `${base}/public/receipt/${token}`;
}

/**
 * POST /repair-orders/:id/receipt-link
 *
 * Mints (once) the RO's customer-facing receipt token and returns the public
 * URL. The frontend drops it into a "Text receipt" draft that goes out through
 * POST /messages/send, so the text lands in the customer's thread like any
 * other owner-sent message. Separate from `publicToken` because that one also
 * opens the estimate / pay pages.
 *
 * Also returns the customer's history-page URL (minted on first use) so the
 * receipt text can point at every past visit, not just this one.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing repair order id");

    const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    if (!ro.receiptToken) {
      ro.receiptToken = randomBytes(18).toString("base64url");
      await ro.save();
    }

    const historyUrl = await ensureCustomerHistoryUrl(ro.customerId);

    return ok({
      url: publicReceiptUrl(ro.receiptToken),
      token: ro.receiptToken,
      historyUrl,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
