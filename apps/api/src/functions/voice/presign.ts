/**
 * POST /voice/presign
 *
 * Shop-scoped presign for one-shot voice memos used by the new-customer,
 * new-vehicle, and concern dictation flows. Mirrors the RO-scoped voice
 * presign (apps/api/src/functions/repairOrders/voicePresign.ts) but writes
 * to `shops/<shopId>/voice/...` so it doesn't require an existing RO.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { VoicePresignDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";
import { presignVoiceUpload } from "../../lib/s3.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, VoicePresignDto);

    const { url, s3Key } = await presignVoiceUpload({
      shopId: String(user.shopId),
      contentType: dto.contentType,
    });

    return ok({ url, s3Key });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
