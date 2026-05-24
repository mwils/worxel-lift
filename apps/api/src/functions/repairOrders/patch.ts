import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RepairOrder, UpdateRepairOrderDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { inferServiceReminders } from "./_inferReminders.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing repair order id");

    const dto = await parseBody(event, UpdateRepairOrderDto);

    const update: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};

    if (dto.status !== undefined) update.status = dto.status;
    if (dto.concern !== undefined) update.concern = dto.concern;
    if (dto.diagnosis !== undefined) update.diagnosis = dto.diagnosis;
    if (dto.scheduledFor === null) {
      unset.scheduledFor = "";
    } else if (dto.scheduledFor !== undefined) {
      update.scheduledFor = new Date(dto.scheduledFor);
    }

    // Picked up = job done; stamp completion timestamp once.
    if (dto.status === "picked_up") {
      update.completedAt = new Date();
    }

    const mutation: Record<string, unknown> = {};
    if (Object.keys(update).length > 0) mutation.$set = update;
    if (Object.keys(unset).length > 0) mutation.$unset = unset;

    const ro = await RepairOrder.findOneAndUpdate(
      { _id: id, shopId: user.shopId },
      mutation,
      { new: true }
    ).lean();
    if (!ro) return notFound("Repair order not found");

    // Fire-and-forget the service-reminder inference when the RO is closed.
    // The reminder upsert reads the now-saved RO + line items; a failure here
    // must not break the patch response, so swallow errors locally.
    if (dto.status === "picked_up") {
      void inferServiceReminders({
        shopId: String(user.shopId),
        repairOrderId: String(ro._id),
      }).catch((err) => {
        console.error("[ro.patch] inferServiceReminders failed", {
          repairOrderId: String(ro._id),
          error: (err as Error).message,
        });
      });
    }

    return ok({
      repairOrder: {
        id: String(ro._id),
        number: ro.number,
        status: ro.status,
        concern: ro.concern ?? null,
        diagnosis: ro.diagnosis ?? null,
        scheduledFor: ro.scheduledFor ?? null,
        completedAt: ro.completedAt ?? null,
        total: ro.total ?? 0,
        updatedAt: ro.updatedAt,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
