import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import { ServiceReminder, Vehicle } from "@lift/shared";
import { handleKnownErrors, withAuth, type RequestContext } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

/**
 * POST /vehicles/{id}/archive    — sold / totalled
 * POST /vehicles/{id}/unarchive  — it came back
 *
 * Archiving also dismisses the vehicle's pending service reminders; the
 * daily scan skips archived vehicles as a backstop. Historical ROs keep
 * their vehicleId — nothing is deleted.
 */
function vehicleAction(
  build: (now: Date) => Record<string, unknown>,
  after?: (ctx: { vehicleId: mongoose.Types.ObjectId; shopId: string; userId: string; now: Date }) => Promise<void>
): APIGatewayProxyHandlerV2 {
  return withAuth(async ({ event, user }: RequestContext) => {
    try {
      if (!user.shopId) return badRequest("No shop on session");
      const id = event.pathParameters?.id;
      if (!id || !mongoose.isValidObjectId(id)) return badRequest("Missing vehicle id");
      const now = new Date();
      const vehicle = await Vehicle.findOneAndUpdate(
        { _id: id, shopId: user.shopId },
        { $set: build(now) },
        { new: true }
      ).lean();
      if (!vehicle) return notFound("Vehicle not found");
      if (after) {
        await after({ vehicleId: vehicle._id, shopId: user.shopId, userId: user.userId, now });
      }
      return ok({
        vehicle: {
          id: String(vehicle._id),
          customerId: String(vehicle.customerId),
          archivedAt: vehicle.archivedAt ?? null,
        },
      });
    } catch (err) {
      const known = handleKnownErrors(err);
      if (known) return known;
      throw err;
    }
  });
}

export const archive = vehicleAction(
  (now) => ({ archivedAt: now }),
  async ({ vehicleId, shopId, userId, now }) => {
    await ServiceReminder.updateMany(
      { shopId, vehicleId, status: "pending" },
      { $set: { status: "dismissed", dismissedAt: now, dismissedBy: userId } }
    );
  }
);

export const unarchive = vehicleAction(() => ({ archivedAt: null }));
