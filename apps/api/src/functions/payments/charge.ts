import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { Customer, Payment, RepairOrder, Shop, objectId } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { ok, badRequest, notFound } from "../../lib/response.js";
import { stripe } from "../../lib/stripe.js";

const ChargeDto = z.object({ repairOrderId: objectId });

/** Map Stripe PaymentIntent status to the Payment doc's enum. */
function mapIntentStatus(
  s: string
): "requires_payment_method" | "requires_action" | "processing" | "succeeded" | "canceled" | "refunded" {
  switch (s) {
    case "requires_payment_method":
    case "requires_action":
    case "processing":
    case "succeeded":
    case "canceled":
      return s;
    case "requires_confirmation":
    case "requires_capture":
      return "processing";
    default:
      return "processing";
  }
}

/**
 * POST /payments/charge
 *
 * Charges an RO against the customer's saved default card (off-session).
 * Customer must have `stripeCustomerId` with at least one payment method.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("User has no shop");
    const { repairOrderId } = await parseBody(event, ChargeDto);

    const ro = await RepairOrder.findOne({ _id: repairOrderId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");
    if (!ro.total || ro.total <= 0) return badRequest("Repair order has no total");

    const [customer, shop] = await Promise.all([
      Customer.findOne({ _id: ro.customerId, shopId: user.shopId }),
      Shop.findById(user.shopId).lean(),
    ]);
    if (!customer) return notFound("Customer not found");
    if (!shop) return notFound("Shop not found");

    if (!customer.stripeCustomerId) {
      return badRequest("customer has no card on file");
    }

    const s = stripe();

    // Find default PM. Prefer invoice_settings.default_payment_method; fall back to first card.
    const stripeCustomer = await s.customers.retrieve(customer.stripeCustomerId);
    if (stripeCustomer.deleted) return badRequest("customer has no card on file");

    let defaultPmId =
      (stripeCustomer.invoice_settings?.default_payment_method as string | null | undefined) ??
      null;

    if (!defaultPmId) {
      const pms = await s.paymentMethods.list({
        customer: customer.stripeCustomerId,
        type: "card",
        limit: 1,
      });
      defaultPmId = pms.data[0]?.id ?? null;
    }

    if (!defaultPmId) {
      return badRequest("customer has no card on file");
    }

    const roIdStr = String(ro._id);
    const intent = await s.paymentIntents.create(
      {
        amount: ro.total,
        currency: "usd",
        customer: customer.stripeCustomerId,
        payment_method: defaultPmId,
        confirm: true,
        off_session: true,
        description: `RO-${String(ro.number).padStart(4, "0")}`,
        metadata: {
          roId: roIdStr,
          shopId: String(ro.shopId),
          customerId: String(ro.customerId),
        },
      },
      { idempotencyKey: `ro-charge-${roIdStr}-${ro.total}` }
    );

    const succeeded = intent.status === "succeeded";

    ro.payment = {
      ...(ro.payment ?? {}),
      stripePaymentIntentId: intent.id,
      status: succeeded ? "paid" : "authorized",
      paidAt: succeeded ? new Date() : ro.payment?.paidAt,
    };
    await ro.save();

    // Upsert Payment doc keyed by stripePaymentIntentId. Resolve last4 from
    // the latest charge when expanded (Stripe v17 removed the `charges` field).
    let last4: string | undefined;
    if (intent.latest_charge && typeof intent.latest_charge !== "string") {
      last4 = intent.latest_charge.payment_method_details?.card?.last4 ?? undefined;
    }
    await Payment.updateOne(
      { stripePaymentIntentId: intent.id },
      {
        $setOnInsert: {
          shopId: ro.shopId,
          repairOrderId: ro._id,
          customerId: ro.customerId,
          stripePaymentIntentId: intent.id,
          amountCents: ro.total,
          method: "card",
        },
        $set: {
          status: mapIntentStatus(intent.status),
          last4,
          completedAt: succeeded ? new Date() : undefined,
        },
      },
      { upsert: true }
    );

    return ok({ paymentIntentId: intent.id, status: intent.status });
  } catch (err) {
    // Stripe surfaces card auth errors as exceptions when confirm:true. Surface 400.
    if (err && typeof err === "object" && "type" in err) {
      const e = err as { type?: string; message?: string; code?: string };
      if (e.type === "StripeCardError" || e.code === "authentication_required") {
        return badRequest(e.message ?? "Card was declined");
      }
    }
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
