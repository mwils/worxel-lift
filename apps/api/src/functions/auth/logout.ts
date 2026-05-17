import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { clearSessionCookie } from "../../lib/auth.js";
import { withErrorBoundary } from "../../lib/middleware.js";
import { ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async () => {
  return ok({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
});
