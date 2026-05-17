import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import { CreatePayLinkDto, RepairOrder } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { ok, badRequest, notFound } from "../../lib/response.js";

/**
 * POST /payments/create-link
 *
 * Returns a public pay URL for an RO. Mints `publicToken` if needed so the
 * link works without auth. The RO must have a positive total.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("User has no shop");
    const { repairOrderId } = await parseBody(event, CreatePayLinkDto);

    const ro = await RepairOrder.findOne({ _id: repairOrderId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");
    if (!ro.total || ro.total <= 0) {
      return badRequest("Repair order has no total — add line items before sending a pay link");
    }

    if (!ro.publicToken) {
      ro.publicToken = randomBytes(16).toString("base64url");
      await ro.save();
    }

    const base = process.env.WEB_APP_URL ?? "http://localhost:5173";
    const url = `${base}/public/pay/${ro.publicToken}`;

    return ok({ url, token: ro.publicToken });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
