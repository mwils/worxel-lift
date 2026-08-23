import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCompanyAuth } from "../../lib/middleware.js";
import { ok } from "../../lib/response.js";
import { topUpBlogQueue } from "./topUp.js";

/**
 * Manual queue top-up from the admin UI. `force: true` bypasses the
 * BLOG_GENERATION_ENABLED cron gate — an explicit admin click is intent
 * enough. One draft per call: a single long-form Bedrock generation can run
 * 20s+, and API Gateway caps the integration at 30s. Click again to keep
 * filling toward 7 (the nightly cron does 3 at a time).
 */
export const handler: APIGatewayProxyHandlerV2 = withCompanyAuth(async () => {
  const result = await topUpBlogQueue({ force: true, limit: 1 });
  return ok({ result });
});
