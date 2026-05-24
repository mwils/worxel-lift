import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DisableServiceForVehicleDto, ServiceReminder } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";

/**
 * Mike's "stop bugging this customer about this car / this service" button.
 *
 * v1 scope: dismiss every matching pending reminder right now. The next
 * completed RO that matches keywords WILL re-create one — true suppression
 * (don't re-infer for this vehicle/category) is intentionally deferred until
 * we see real-world signal that owners want it. Track this under issue:
 *   TODO(reminders): per-vehicle reinfer-suppression.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, DisableServiceForVehicleDto);

    const filter: Record<string, unknown> = {
      shopId: user.shopId,
      vehicleId: dto.vehicleId,
      status: "pending",
    };
    if (dto.category) filter.category = dto.category;

    const res = await ServiceReminder.updateMany(filter, {
      $set: {
        status: "dismissed",
        dismissedAt: new Date(),
        ...(user.userId ? { dismissedBy: user.userId } : {}),
      },
    });

    return ok({
      dismissed: res.modifiedCount ?? 0,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
