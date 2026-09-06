import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import { z } from "zod";
import { Conversation, Customer, Message } from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";

/**
 * GET /messages/inbox — the thread list, read from the Conversation
 * collection (one row per customer, maintained on every message write).
 *
 *   filter    needs_reply (default) | unread | all
 *   q         customer name / phone digits / message body (regex, shop-scoped)
 *   archived  1 to show threads that were marked done instead
 *   cursor    "<bumpedAt ms>_<id>" from the previous page
 *   limit     default 30
 */
const InboxQuery = z.object({
  filter: z.enum(["unread", "needs_reply", "all"]).default("needs_reply"),
  q: z.string().trim().max(100).optional(),
  archived: z.enum(["0", "1"]).default("0"),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function parseCursor(raw: string | undefined): { at: Date; id: mongoose.Types.ObjectId } | null {
  if (!raw) return null;
  const [ms, id] = raw.split("_");
  const at = new Date(Number(ms));
  if (!ms || !id || Number.isNaN(at.getTime()) || !mongoose.isValidObjectId(id)) {
    throw new Error("bad cursor");
  }
  return { at, id: new mongoose.Types.ObjectId(id) };
}

/**
 * Customers whose name / phone / any message body matches. Regex rather
 * than a text index: Mike types "brak" or the last four of a number and
 * expects a hit; $text stems whole words and can't do either. Both scans
 * are bounded by the shop's own rows.
 */
async function matchingCustomerIds(
  shopId: mongoose.Types.ObjectId,
  q: string
): Promise<mongoose.Types.ObjectId[]> {
  const rx = new RegExp(escapeRegex(q), "i");
  const or: Record<string, unknown>[] = [{ firstName: rx }, { lastName: rx }];
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    or.push({
      firstName: new RegExp(escapeRegex(tokens[0]!), "i"),
      lastName: new RegExp(escapeRegex(tokens.slice(1).join(" ")), "i"),
    });
  }
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3) or.push({ phone: new RegExp(escapeRegex(digits)) });

  const [byCustomer, byBody] = await Promise.all([
    Customer.find({ shopId, $or: or }, { _id: 1 }).lean(),
    Message.distinct("customerId", { shopId, body: rx }) as Promise<mongoose.Types.ObjectId[]>,
  ]);
  const seen = new Set<string>();
  const ids: mongoose.Types.ObjectId[] = [];
  for (const id of [...byCustomer.map((c) => c._id), ...byBody]) {
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
  }
  return ids;
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const shopId = new mongoose.Types.ObjectId(user.shopId);
    const { filter: which, q, archived, cursor: rawCursor, limit } = parseQuery(event, InboxQuery);

    let cursor: ReturnType<typeof parseCursor>;
    try {
      cursor = parseCursor(rawCursor);
    } catch {
      return badRequest("Invalid cursor");
    }

    const showArchived = archived === "1";
    const filter: Record<string, unknown> = {
      shopId,
      archivedAt: showArchived ? { $ne: null } : null,
    };
    if (which === "unread") filter.unreadCount = { $gt: 0 };
    if (which === "needs_reply") filter.needsReply = true;
    if (q) {
      const ids = await matchingCustomerIds(shopId, q);
      if (ids.length === 0) {
        return ok({ threads: [], hasMore: false, nextCursor: null, counts: null });
      }
      filter.customerId = { $in: ids };
    }
    if (cursor) {
      filter.$or = [
        { bumpedAt: { $lt: cursor.at } },
        { bumpedAt: cursor.at, _id: { $lt: cursor.id } },
      ];
    }

    const rows = await Conversation.find(filter)
      .sort({ bumpedAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? `${new Date(last.bumpedAt).getTime()}_${String(last._id)}` : null;

    const customerIds = page.map((r) => r.customerId);
    const messageIds = page.map((r) => r.lastMessageId).filter(Boolean);
    const [customers, lastMessages, counts] = await Promise.all([
      Customer.find(
        { _id: { $in: customerIds }, shopId },
        { firstName: 1, lastName: 1, phone: 1, smsOptOutAt: 1 }
      ).lean(),
      Message.find({ _id: { $in: messageIds }, shopId }).lean(),
      // Segment badges — first page only, and never for a search.
      cursor || q
        ? Promise.resolve(null)
        : Promise.all([
            Conversation.countDocuments({ shopId, archivedAt: null, needsReply: true }),
            Conversation.countDocuments({ shopId, archivedAt: null, unreadCount: { $gt: 0 } }),
          ]).then(([needsReply, unread]) => ({ needsReply, unread })),
    ]);
    const customerById = new Map(customers.map((c) => [String(c._id), c]));
    const messageById = new Map(lastMessages.map((m) => [String(m._id), m]));

    const threads = page.flatMap((r) => {
      const customer = customerById.get(String(r.customerId));
      if (!customer) return []; // customer deleted; thread row is an orphan
      const m = r.lastMessageId ? messageById.get(String(r.lastMessageId)) : undefined;
      return [
        {
          customerId: String(r.customerId),
          customer: {
            id: String(customer._id),
            firstName: customer.firstName,
            lastName: customer.lastName ?? null,
            phone: customer.phone,
            smsOptOutAt: customer.smsOptOutAt ?? null,
          },
          lastMessage: m
            ? {
                id: String(m._id),
                direction: m.direction,
                kind: m.kind ?? "sms",
                body: m.body,
                sentAt: m.sentAt,
                aiDrafted: m.aiDrafted ?? false,
                autoReplied: m.autoReplied ?? false,
                automated: m.automated ?? false,
                deliveryStatus: m.deliveryStatus ?? null,
                inboundClassification: m.inboundClassification ?? null,
              }
            : null,
          lastMessagePreview: r.lastMessagePreview ?? "",
          lastMessageAt: r.lastMessageAt ?? null,
          bumpedAt: r.bumpedAt,
          unreadCount: r.unreadCount ?? 0,
          unread: (r.unreadCount ?? 0) > 0,
          needsReply: r.needsReply ?? false,
          archived: !!r.archivedAt,
          archivedAt: r.archivedAt ?? null,
        },
      ];
    });

    return ok({ threads, hasMore, nextCursor, counts });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
