import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PresignPhotoDto, RepairOrder } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { presignUpload } from "../../lib/s3.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const roId = event.pathParameters?.id;
    if (!roId) return badRequest("Missing repair order id");

    const dto = await parseBody(event, PresignPhotoDto);

    // Verify the RO belongs to the caller's shop before handing out a signed URL.
    const ro = await RepairOrder.findOne(
      { _id: roId, shopId: user.shopId },
      { _id: 1 }
    ).lean();
    if (!ro) return notFound("Repair order not found");

    const { url, s3Key } = await presignUpload({
      shopId: user.shopId,
      repairOrderId: roId,
      contentType: dto.contentType,
    });

    return ok({
      uploadUrl: url,
      s3Key,
      expiresInSec: 300,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
