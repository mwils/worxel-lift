/**
 * POST /repair-orders/:id/voice/presign  (NOT WIRED — see note below)
 *
 * Slice E — Voice-to-RO upload helper.
 *
 * Returns a presigned S3 PUT URL for an audio file scoped to this RO. The
 * frontend currently uploads via the existing `/repair-orders/:id/photos/presign`
 * route (it produces an identical RO-scoped key shape under
 * `shops/<shopId>/ros/<roId>/...`), so this dedicated voice-presign handler is
 * NOT yet wired in `sst.config.ts`. We keep it here for two reasons:
 *
 *   1) Self-documenting: when slice D tightens photos-presign to image content
 *      types only, the voice flow needs its own presign path. Add the route
 *      `POST /repair-orders/{id}/voice/presign` pointing at this handler.
 *   2) It enforces an audio/* content-type whitelist; photos-presign will
 *      eventually enforce image/*, so they don't share a DTO.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { RepairOrder } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { presignUpload } from "../../lib/s3.js";

const VoicePresignDto = z.object({
  contentType: z
    .string()
    .regex(/^audio\//, "contentType must be an audio/* MIME type"),
});

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing repair order id");

    const dto = await parseBody(event, VoicePresignDto);

    const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId })
      .select({ _id: 1 })
      .lean();
    if (!ro) return notFound("Repair order not found");

    const { url, s3Key } = await presignUpload({
      shopId: String(user.shopId),
      repairOrderId: id,
      contentType: dto.contentType,
    });

    return ok({ url, s3Key });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
