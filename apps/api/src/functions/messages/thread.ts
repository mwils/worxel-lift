import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import { Conversation, type ConversationDoc } from "@lift/shared";
import { handleKnownErrors, withAuth, type RequestContext } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";

/**
 * POST /messages/threads/{customerId}/read      — opening the thread
 * POST /messages/threads/{customerId}/archive   — "Mark done"
 * POST /messages/threads/{customerId}/unarchive — "Reopen"
 *
 * All three are a single $set on the Conversation row; archive also clears
 * the queue flags so a done thread doesn't count anywhere. The next inbound
 * text (or an owner-sent one) un-archives it via the Message hook.
 */
function serialize(t: ConversationDoc) {
  return {
    customerId: String(t.customerId),
    lastMessageAt: t.lastMessageAt ?? null,
    bumpedAt: t.bumpedAt,
    lastReadAt: t.lastReadAt ?? null,
    unreadCount: t.unreadCount ?? 0,
    unread: (t.unreadCount ?? 0) > 0,
    needsReply: t.needsReply ?? false,
    archived: !!t.archivedAt,
    archivedAt: t.archivedAt ?? null,
  };
}

function threadAction(build: (now: Date) => Record<string, unknown>): APIGatewayProxyHandlerV2 {
  return withAuth(async ({ event, user }: RequestContext) => {
    try {
      if (!user.shopId) return badRequest("No shop on session");
      const customerId = event.pathParameters?.customerId;
      if (!customerId || !mongoose.isValidObjectId(customerId)) {
        return badRequest("Missing customer id");
      }
      const thread = await Conversation.findOneAndUpdate(
        { shopId: user.shopId, customerId },
        { $set: build(new Date()) },
        { new: true }
      ).lean();
      // A customer who has never been texted has no thread row yet — that's
      // not an error for "read", so answer with an empty state.
      if (!thread) return event.rawPath.endsWith("/read") ? ok({ thread: null }) : notFound("Thread not found");
      return ok({ thread: serialize(thread) });
    } catch (err) {
      const known = handleKnownErrors(err);
      if (known) return known;
      throw err;
    }
  });
}

export const read = threadAction((now) => ({ lastReadAt: now, unreadCount: 0 }));

export const archive = threadAction((now) => ({
  archivedAt: now,
  needsReply: false,
  unreadCount: 0,
  lastReadAt: now,
}));

export const unarchive = threadAction(() => ({ archivedAt: null }));
