import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ServiceReminder, UpdateServiceReminderDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { serializeServiceReminder } from "./_serialize.js";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing reminder id");

    const dto = await parseBody(event, UpdateServiceReminderDto);

    const update: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};

    if (dto.status !== undefined) {
      update.status = dto.status;
      if (dto.status === "dismissed") {
        update.dismissedAt = new Date();
        if (user.userId) update.dismissedBy = user.userId;
      } else if (dto.status === "pending") {
        // Un-dismiss (snooze flow flips back to pending with a new dueAt).
        unset.dismissedAt = "";
        unset.dismissedBy = "";
      }
    }
    if (dto.dueAt !== undefined) {
      update.dueAt = new Date(dto.dueAt);
    }

    if (Object.keys(update).length === 0 && Object.keys(unset).length === 0) {
      return badRequest("No changes");
    }

    const mutation: Record<string, unknown> = {};
    if (Object.keys(update).length > 0) mutation.$set = update;
    if (Object.keys(unset).length > 0) mutation.$unset = unset;

    const reminder = await ServiceReminder.findOneAndUpdate(
      { _id: id, shopId: user.shopId },
      mutation,
      { new: true }
    ).lean();
    if (!reminder) return notFound("Reminder not found");

    return ok({ reminder: serializeServiceReminder(reminder) });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
