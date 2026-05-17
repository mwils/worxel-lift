import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withAuth } from "../lib/middleware.js";
import { ok } from "../lib/response.js";

/**
 * Shared stub used by every route in v1 scaffold that's awaiting implementation.
 * Returns a 200 with a TODO marker so wiring can be verified end-to-end.
 */
export function todoHandler(name: string): APIGatewayProxyHandlerV2 {
  return withAuth(async ({ event, user }) => {
    return ok({
      todo: name,
      method: event.requestContext?.http?.method,
      path: event.requestContext?.http?.path,
      auth: { userId: user.userId, shopId: user.shopId ?? null },
    });
  });
}
