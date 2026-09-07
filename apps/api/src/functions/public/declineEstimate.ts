import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { handleKnownErrors, parseBody, withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound } from "../../lib/response.js";
import { Customer, DeclineEstimateDto, Message, RepairOrder } from "@lift/shared";
import { estimateTokenQuery } from "../repairOrders/_estimate.js";

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  try {
    const token = event.pathParameters?.token;
    if (!token) return notFound();

    // Body is optional — the inspection page's Decline button sends none.
    let reason: string | undefined;
    if (event.body && event.body.trim().length > 0) {
      const dto = await parseBody(event, DeclineEstimateDto);
      reason = dto.reason?.trim() || undefined;
    }

    const ro = await RepairOrder.findOne(estimateTokenQuery(token)).lean();
    if (!ro) return notFound();
    // Already approved (and not re-sent since) — a stray Decline tap after a
    // yes must not flip the job. Idempotent no-op, mirrors approveEstimate.
    if (ro.estimate?.approvedAt) return ok({ ok: true });
    // Already declined: only let a reason through if none was given before, so
    // a double tap doesn't re-note the thread or re-arm the follow-up banner.
    if (ro.estimate?.declinedAt) {
      if (reason && !ro.estimate.declineReason) {
        await RepairOrder.updateOne(
          { _id: ro._id, "estimate.declinedAt": { $exists: true } },
          { $set: { "estimate.declineReason": reason } }
        );
      }
      return ok({ ok: true });
    }

    const now = new Date();
    const updated = await RepairOrder.findOneAndUpdate(
      { _id: ro._id, "estimate.approvedAt": { $exists: false } },
      {
        $set: {
          "estimate.declinedAt": now,
          ...(reason ? { "estimate.declineReason": reason } : {}),
        },
        $unset: { "estimate.declineFollowedUpAt": "" },
      },
      { new: true }
    );
    if (!updated) return notFound();

    // Note in the customer's thread so the owner sees it where the reply
    // happens. Never texted — same pattern as the phone-change note.
    try {
      const customer = await Customer.findById(ro.customerId).lean();
      const who = customer?.firstName ?? "Customer";
      await Message.create({
        shopId: ro.shopId,
        customerId: ro.customerId,
        repairOrderId: ro._id,
        direction: "in",
        kind: "system",
        body:
          `${who} declined the ${formatMoney(ro.total ?? 0)} estimate.` +
          (reason ? ` Their note: "${reason}"` : ""),
        sentAt: now,
      });
    } catch (err) {
      console.error("[public/declineEstimate] thread note failed", err);
    }

    return ok({ ok: true });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
