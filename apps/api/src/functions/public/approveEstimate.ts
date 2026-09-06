import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound } from "../../lib/response.js";
import { RepairOrder } from "@lift/shared";
import { approvalStamp, estimateTokenQuery } from "../repairOrders/_estimate.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const ro = await RepairOrder.findOne(estimateTokenQuery(token)).lean();
  if (!ro) return notFound();
  // Already approved (and not re-sent since) — idempotent no-op so a double
  // tap doesn't overwrite the original snapshot.
  if (ro.estimate?.approvedAt) return ok({ ok: true });

  const stamp = approvalStamp(ro);
  const updated = await RepairOrder.findOneAndUpdate(
    { _id: ro._id, "estimate.approvedAt": { $exists: false } },
    {
      $set: {
        "estimate.approvedAt": stamp.approvedAt,
        "estimate.approvedTotal": stamp.approvedTotal,
        "estimate.approvedTaxTotal": stamp.approvedTaxTotal,
        "estimate.approvedLineItems": stamp.approvedLineItems,
        status: "in_repair",
      },
      $unset: {
        "estimate.declinedAt": "",
        "estimate.declineReason": "",
        "estimate.declineFollowedUpAt": "",
      },
    },
    { new: true }
  );
  if (!updated) return notFound();
  return ok({ ok: true });
});
