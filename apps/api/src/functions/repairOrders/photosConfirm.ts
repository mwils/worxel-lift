import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ConfirmPhotoDto, RepairOrder } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, created, notFound } from "../../lib/response.js";

interface PhotoLike {
  _id: unknown;
  s3Key: string;
  takenAt: Date;
  caption?: string;
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const roId = event.pathParameters?.id;
    if (!roId) return badRequest("Missing repair order id");

    const dto = await parseBody(event, ConfirmPhotoDto);

    // Defense against arbitrary key injection — the s3Key must live under this
    // shop + RO's namespace, which is exactly the prefix presignUpload mints.
    const expectedPrefix = `shops/${user.shopId}/ros/${roId}/`;
    if (!dto.s3Key.startsWith(expectedPrefix)) {
      return badRequest("s3Key does not belong to this repair order");
    }

    const ro = await RepairOrder.findOne({ _id: roId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    const photoDoc = {
      s3Key: dto.s3Key,
      takenAt: new Date(),
      caption: dto.caption,
    };
    (ro.photos as any).push(photoDoc);

    const photoArr = ro.photos as unknown as PhotoLike[];
    const saved = photoArr[photoArr.length - 1];
    if (!saved) {
      // Should be unreachable — we just pushed onto the array.
      throw new Error("Failed to read back saved photo");
    }

    let attachedToItem: string | null = null;
    if (dto.inspectionItemId) {
      const inspection: any = (ro as any).inspection;
      const item = inspection?.items?.id?.(dto.inspectionItemId);
      if (!item) return badRequest("Inspection item not found on this RO");
      item.photoIds.push(saved._id);
      attachedToItem = dto.inspectionItemId;
    }

    await ro.save();

    return created({
      photo: {
        id: String(saved._id),
        s3Key: saved.s3Key,
        takenAt: saved.takenAt,
        caption: saved.caption ?? null,
      },
      inspectionItemId: attachedToItem,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
