import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { Customer, Message } from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

const ConversationQuery = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const customerId = event.pathParameters?.customerId;
    if (!customerId) return badRequest("Missing customer id");

    const { cursor, limit } = parseQuery(event, ConversationQuery);

    const customer = await Customer.findOne({
      _id: customerId,
      shopId: user.shopId,
    }).lean();
    if (!customer) return notFound("Customer not found");

    const filter: Record<string, unknown> = {
      shopId: user.shopId,
      customerId: customer._id,
    };
    if (cursor) {
      filter.sentAt = { $lt: new Date(cursor) };
    }

    // Fetch newest-first so we can grab the most recent `limit` messages,
    // then reverse to return chronological (oldest-first).
    const rows = await Message.find(filter)
      .sort({ sentAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;
    const chronological = slice.slice().reverse();

    const nextCursor = hasMore
      ? // oldest of the current page becomes the cursor for the next older batch
        (slice[slice.length - 1]?.sentAt as Date | undefined)?.toISOString()
      : null;

    return ok({
      messages: chronological.map((m) => ({
        id: String(m._id),
        customerId: String(m.customerId),
        repairOrderId: m.repairOrderId ? String(m.repairOrderId) : null,
        direction: m.direction,
        kind: m.kind ?? "sms",
        body: m.body,
        mediaUrls: m.mediaUrls ?? [],
        sentAt: m.sentAt,
        aiDrafted: m.aiDrafted ?? false,
        autoReplied: m.autoReplied ?? false,
        inboundClassification: m.inboundClassification ?? null,
        awsMessageId: m.awsMessageId ?? null,
      })),
      hasMore,
      nextCursor,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
