import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { Payment, RepairOrder, Shop } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound, badRequest } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

const ConfirmDto = z.object({ paymentIntentId: z.string().min(8) });

/**
 * POST /public/pay/:token
 *
 * Courtesy confirmation ping from the public pay page after client-side
 * confirmPayment resolves. Verifies the PaymentIntent succeeded server-side
 * and updates the RO. The Stripe webhook is the source of truth — this just
 * gives the customer immediate feedback.
 */
export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const body = event.body
    ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf-8") : event.body)
    : {};
  const parsed = ConfirmDto.safeParse(body);
  if (!parsed.success) return badRequest("Invalid body");

  const ro = await RepairOrder.findOne({ publicToken: token });
  if (!ro) return notFound();

  // Direct charge on the shop's connected account — retrieve it there.
  const shop = await Shop.findById(ro.shopId).lean();
  const accountId = shop?.stripe?.connectAccountId;
  if (!accountId) return badRequest("Shop has no payment account");

  const intent = await stripe().paymentIntents.retrieve(parsed.data.paymentIntentId, {
    stripeAccount: accountId,
  });
  if (intent.metadata?.roId && intent.metadata.roId !== String(ro._id)) {
    return badRequest("Payment intent does not belong to this RO");
  }

  if (intent.status === "succeeded") {
    if (ro.payment?.status !== "paid") {
      ro.payment = {
        ...(ro.payment ?? {}),
        stripePaymentIntentId: intent.id,
        status: "paid",
        paidAt: new Date(),
        method: "stripe",
        amountCents: intent.amount,
      };
      await ro.save();

      // Best-effort Payment doc upsert so RO history shows the payment even
      // before the webhook lands.
      await Payment.updateOne(
        { stripePaymentIntentId: intent.id },
        {
          $setOnInsert: {
            shopId: ro.shopId,
            repairOrderId: ro._id,
            customerId: ro.customerId,
            stripePaymentIntentId: intent.id,
            amountCents: intent.amount,
            method: "card",
          },
          $set: { status: "succeeded", completedAt: new Date() },
        },
        { upsert: true }
      );
    }
    return ok({ status: "paid" });
  }

  return ok({ status: intent.status });
});
