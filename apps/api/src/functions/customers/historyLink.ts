import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import { Customer, CustomerHistoryLinkDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import {
  ensureCustomerPublicToken,
  newAccountToken,
  publicAccountUrl,
} from "../../lib/accountLink.js";

/**
 * POST /customers/:id/history-link
 *
 * Returns the customer's public history-page URL, minting the token on first
 * use. `{ rotate: true }` replaces the token — every link already texted out
 * goes dead — for when a phone changes hands or a customer asks. The frontend
 * drops the URL into a "Text history link" draft that goes through
 * POST /messages/send like any other owner text; nothing is sent from here.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id || !mongoose.isValidObjectId(id)) return badRequest("Missing customer id");

    // Body is optional — an empty POST just mints / returns the current link.
    const dto = event.body ? await parseBody(event, CustomerHistoryLinkDto) : { rotate: false };

    const customer = await Customer.findOne({ _id: id, shopId: user.shopId })
      .select({ _id: 1 })
      .lean();
    if (!customer) return notFound("Customer not found");

    let token: string | null;
    if (dto.rotate) {
      token = newAccountToken();
      await Customer.updateOne(
        { _id: customer._id, shopId: user.shopId },
        { $set: { publicToken: token } }
      );
    } else {
      token = await ensureCustomerPublicToken(customer._id);
    }
    if (!token) return notFound("Customer not found");

    return ok({ url: publicAccountUrl(token), token, rotated: !!dto.rotate });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
