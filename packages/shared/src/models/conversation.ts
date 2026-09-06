import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * One row per (shop, customer) thread — the inbox reads THIS, never the
 * Message collection. Maintained by the Message post-save hook (see
 * message.ts) so every write site — inbound Lambda, owner send, automated
 * notices, system notes — keeps it current without remembering to.
 *
 * Two explicit exceptions live outside the hook because they need context
 * the message alone doesn't carry:
 *   - snsInbound un-bumps a thread after a status check is auto-answered
 *     (the inbound already bumped it; the hook can't know the reply is
 *     coming), and clears needsReply for STOP.
 *   - snsDelivery re-bumps + flags needsReply when an auto-reply fails.
 */
const ConversationSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },

    lastMessageAt: Date,
    // Inbox sort key. NOT every message moves it — see messageEffect().
    bumpedAt: { type: Date, required: true },
    lastInboundAt: Date,
    lastOutboundAt: Date,
    // When the shop last opened the thread. unreadCount is the denormalised
    // "inbound since lastReadAt" so the Unread filter is a plain match.
    lastReadAt: Date,
    unreadCount: { type: Number, default: 0 },
    needsReply: { type: Boolean, default: false },
    // "Mark done". Cleared by the next inbound or owner-sent text.
    archivedAt: Date,

    lastMessagePreview: String,
    lastMessageId: { type: Schema.Types.ObjectId, ref: "Message" },
  },
  { timestamps: true }
);

ConversationSchema.index({ shopId: 1, customerId: 1 }, { unique: true });
// Every inbox query is shopId + archived/not, sorted by bumpedAt. The
// needsReply / unreadCount filters narrow in-memory — a few hundred rows
// per shop at most.
ConversationSchema.index({ shopId: 1, archivedAt: 1, bumpedAt: -1, _id: -1 });

export type ConversationDoc = InferSchemaType<typeof ConversationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Conversation: Model<ConversationDoc> =
  (mongoose.models.Conversation as Model<ConversationDoc>) ||
  mongoose.model<ConversationDoc>("Conversation", ConversationSchema);

/** The subset of a Message the thread rules care about. */
export interface ConversationMessageInput {
  _id: mongoose.Types.ObjectId;
  shopId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  direction: "in" | "out";
  kind?: "sms" | "system" | null;
  body: string;
  sentAt?: Date | null;
  autoReplied?: boolean | null;
  automated?: boolean | null;
}

export interface MessageEffect {
  /** Move the thread to the top of the inbox. */
  bump: boolean;
  /** true = customer is waiting; false = owner answered; undefined = no change. */
  needsReply?: boolean;
  /** Pull an archived thread back into the inbox. */
  unarchive: boolean;
  /** Counts toward the unread dot. */
  countsUnread: boolean;
  inbound: boolean;
  /** Real SMS (not a system note) — updates lastInboundAt / lastOutboundAt. */
  sms: boolean;
}

/**
 * The thread rules, in one place. Used by the incremental hook and by the
 * backfill's replay so they can't drift.
 *
 *   inbound            bump, needsReply, unarchive, unread
 *   owner-sent text    bump, replied, unarchive
 *   auto-reply         bump (snsInbound reverts it for status checks)
 *   automated notice   no bump — reminders/booking notices are not activity
 *                      Mike needs to see 50 threads jump the queue for
 *   system note        nothing but the preview/timestamp
 */
export function messageEffect(m: ConversationMessageInput): MessageEffect {
  const sms = (m.kind ?? "sms") !== "system";
  const inbound = m.direction === "in";
  if (!sms) {
    return { bump: false, unarchive: false, countsUnread: false, inbound, sms };
  }
  if (inbound) {
    return { bump: true, needsReply: true, unarchive: true, countsUnread: true, inbound, sms };
  }
  if (m.autoReplied) {
    return { bump: true, unarchive: false, countsUnread: false, inbound, sms };
  }
  if (m.automated) {
    return { bump: false, unarchive: false, countsUnread: false, inbound, sms };
  }
  return { bump: true, needsReply: false, unarchive: true, countsUnread: false, inbound, sms };
}

export function previewOf(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 140);
}

/** Incremental update for one newly created message. Idempotent per message id. */
export async function applyMessageToConversation(m: ConversationMessageInput): Promise<void> {
  const sentAt = m.sentAt ?? new Date();
  const fx = messageEffect(m);

  const set: Record<string, unknown> = {
    lastMessageAt: sentAt,
    lastMessagePreview: previewOf(m.body),
    lastMessageId: m._id,
  };
  const max: Record<string, Date> = {};
  const setOnInsert: Record<string, unknown> = {};

  if (fx.sms) {
    if (fx.inbound) max.lastInboundAt = sentAt;
    else max.lastOutboundAt = sentAt;
  }
  if (fx.bump) max.bumpedAt = sentAt;
  else setOnInsert.bumpedAt = sentAt; // a brand-new thread must sort somewhere
  if (fx.needsReply !== undefined) set.needsReply = fx.needsReply;
  if (fx.unarchive) set.archivedAt = null;

  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(max).length) update.$max = max;
  if (Object.keys(setOnInsert).length) update.$setOnInsert = setOnInsert;
  if (fx.countsUnread) update.$inc = { unreadCount: 1 };

  await Conversation.updateOne({ shopId: m.shopId, customerId: m.customerId }, update, {
    upsert: true,
  });
}
