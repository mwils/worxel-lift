import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { MarkPaidDto, RepairOrder } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

/**
 * POST /repair-orders/:id/mark-paid
 *
 * Owner records a payment that didn't go through Stripe — cash at the
 * counter, their own card terminal, a check. Sets `payment.status = "paid"`
 * on the RO, which is what customer / vehicle lifetime-spend aggregates key
 * off, so cash shops stop showing $0.00 forever.
 *
 * `{ paid: false }` reverses a manual entry (mis-tap). Stripe-settled ROs
 * can't be flipped back here — that's a refund, and it goes through Stripe.
 *
 * The RO number ("RO-0142") doubles as the invoice reference; there's no
 * separate invoice counter.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing repair order id");

    const dto = await parseBody(event, MarkPaidDto);

    const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    const current = ro.payment ?? { status: "unpaid" as const };
    const stripeSettled = current.method === "stripe" || !!current.stripePaymentIntentId;

    if (!dto.paid) {
      if (current.status !== "paid") {
        return badRequest("This RO isn't marked paid");
      }
      if (stripeSettled) {
        return badRequest("This was paid through Stripe — refund it from Stripe, not here");
      }
      ro.set("payment", { status: "unpaid" });
      await ro.save();
      return ok({ payment: serialize(ro.payment) });
    }

    if (current.status === "paid") {
      return badRequest("This RO is already marked paid");
    }
    if (!dto.method) return badRequest("Pick how they paid (cash, card, check, other)");

    const amountCents = dto.amountCents ?? ro.total ?? 0;
    if (amountCents <= 0 && (ro.total ?? 0) > 0) {
      return badRequest("Amount has to be more than $0");
    }

    ro.set("payment", {
      status: "paid",
      method: dto.method,
      amountCents,
      note: dto.note?.trim() || undefined,
      paidAt: new Date(),
    });
    await ro.save();

    return ok({ payment: serialize(ro.payment) });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});

function serialize(p: Record<string, unknown> | null | undefined) {
  if (!p) return { status: "unpaid" };
  return {
    status: p.status ?? "unpaid",
    method: p.method ?? null,
    amountCents: p.amountCents ?? null,
    note: p.note ?? null,
    paidAt: p.paidAt ?? null,
  };
}
