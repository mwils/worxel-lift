import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { BulkDismissServiceRemindersDto, ServiceReminder } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";

/**
 * "Clear these out" — the reminders list's multi-select action.
 *
 * Shop-scoped and idempotent: already-dismissed ids are skipped rather than
 * re-stamped, so `dismissed` is the count that actually changed. Single-row
 * dismiss stays on PATCH /service-reminders/{id}; this is the same transition
 * applied to a selection.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const { ids } = await parseBody(event, BulkDismissServiceRemindersDto);

    const unique = Array.from(new Set(ids));

    const res = await ServiceReminder.updateMany(
      {
        shopId: user.shopId,
        _id: { $in: unique },
        status: { $ne: "dismissed" },
      },
      {
        $set: {
          status: "dismissed",
          dismissedAt: new Date(),
          ...(user.userId ? { dismissedBy: user.userId } : {}),
        },
      }
    );

    return ok({ dismissed: res.modifiedCount ?? 0, requested: unique.length });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
