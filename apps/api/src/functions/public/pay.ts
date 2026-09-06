import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { Payment, RepairOrder, Shop } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound, badRequest } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";
import { syncRoPayment } from "../repairOrders/_payments.js";

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
    // Best-effort Payment row upsert so the RO reads paid even before the
    // webhook lands. The RO's status is derived from the rows.
    const now = new Date();
    await Payment.updateOne(
      { stripePaymentIntentId: intent.id },
      {
        $setOnInsert: {
          shopId: ro.shopId,
          repairOrderId: ro._id,
          customerId: ro.customerId,
          vehicleId: ro.vehicleId,
          stripePaymentIntentId: intent.id,
          amountCents: intent.amount,
          method: "stripe",
          paidAt: now,
        },
        $set: { status: "succeeded", completedAt: now },
      },
      { upsert: true }
    );
    ro.set("payment.stripePaymentIntentId", intent.id);
    await syncRoPayment(ro);
    await ro.save();
    return ok({ status: "paid" });
  }

  return ok({ status: intent.status });
});
