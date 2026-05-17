import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok, notFound } from "../../lib/response.js";
import { RepairOrder } from "@lift/shared";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const updated = await RepairOrder.findOneAndUpdate(
    { publicToken: token, "estimate.approvedAt": { $exists: false } },
    { $set: { "estimate.approvedAt": new Date(), status: "in_repair" } },
    { new: true }
  );
  if (!updated) return notFound();
  return ok({ ok: true });
});
