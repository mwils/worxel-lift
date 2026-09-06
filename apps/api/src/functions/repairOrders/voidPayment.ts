import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import { Payment, RepairOrder, VoidPaymentDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { adoptLegacyPayment } from "./markPaid.js";
import { serializePaymentRow, serializeRoPayment, syncRoPayment } from "./_payments.js";

/**
 * POST /repair-orders/:id/payments/:paymentId/void
 *
 *   kind: "void"    — the row was a mis-tap; it never happened. Manual rows only.
 *   kind: "refund"  — the money was handed back. Any row, including Stripe
 *                     (the actual Stripe refund is issued from the Stripe
 *                     dashboard; this records it for the books).
 *
 * Either way the row stops counting toward `collectedCents` and the RO's
 * status is re-derived (paid → partial / unpaid / refunded).
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    const paymentId = event.pathParameters?.paymentId;
    if (!id) return badRequest("Missing repair order id");
    if (!paymentId || !mongoose.isValidObjectId(paymentId)) return badRequest("Missing payment id");

    const dto = await parseBody(event, VoidPaymentDto);

    const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");
    await adoptLegacyPayment(ro, user.userId);

    const row = await Payment.findOne({ _id: paymentId, shopId: user.shopId, repairOrderId: ro._id });
    if (!row) return notFound("Payment not found");
    if (row.status !== "succeeded") return badRequest("That payment isn't counted, so there's nothing to undo");

    const isStripe = !!row.stripePaymentIntentId;
    if (dto.kind === "void" && isStripe) {
      return badRequest("This was paid through Stripe — record it as a refund instead, after refunding in Stripe");
    }

    row.status = dto.kind === "refund" ? "refunded" : "voided";
    row.voidedAt = new Date();
    row.voidNote = dto.note?.trim() || undefined;
    row.voidedByUserId = new mongoose.Types.ObjectId(user.userId);
    await row.save();

    const after = await syncRoPayment(ro);
    await ro.save();

    return ok({
      payment: serializeRoPayment(ro, after.rows),
      payments: after.rows.map((r) => serializePaymentRow(r)),
      collectedCents: after.collectedCents,
      balanceCents: after.balanceCents,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
