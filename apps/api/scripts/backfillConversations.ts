/**
 * Derive the Conversation row (inbox thread state) for every customer who
 * has messages, by replaying their history through the same messageEffect()
 * rules the live Message hook uses.
 *
 *   - New rows: lastReadAt = lastInboundAt (history counts as read — 800
 *     unread dots on day one would be noise), unreadCount 0, not archived.
 *     needsReply IS computed, so the "Needs reply" queue is honest from the
 *     start; Mike clears stale ones with Mark done.
 *   - Existing rows: derived fields are refreshed; lastReadAt / unreadCount /
 *     archivedAt (the owner's state) are left alone.
 *
 * Idempotent — safe to re-run. Dry run by default; pass --apply to write.
 *
 *   MONGODB_URI="mongodb+srv://..." pnpm --filter @lift/api exec tsx scripts/backfillConversations.ts
 *   MONGODB_URI="mongodb+srv://..." pnpm --filter @lift/api exec tsx scripts/backfillConversations.ts --apply
 *
 * Get the URI with `sst secret list --stage prod` (MongodbUri).
 */
import type mongoose from "mongoose";
import {
  Conversation,
  Message,
  connectDb,
  messageEffect,
  previewOf,
  type ConversationMessageInput,
} from "@lift/shared";

const apply = process.argv.includes("--apply");

type Row = ConversationMessageInput & {
  inboundClassification?: string | null;
  deliveryStatus?: string | null;
};

interface Derived {
  lastMessageAt: Date;
  bumpedAt: Date;
  lastInboundAt?: Date;
  lastOutboundAt?: Date;
  needsReply: boolean;
  lastMessagePreview: string;
  lastMessageId: mongoose.Types.ObjectId;
}

/** Replay one thread's messages (oldest first). Mirrors the hook + snsInbound's un-bump. */
export function deriveConversation(messages: Row[]): Derived | null {
  if (messages.length === 0) return null;
  let bumpedAt: Date | undefined;
  let bumpedBeforeLastInbound: Date | undefined;
  let lastInboundAt: Date | undefined;
  let lastOutboundAt: Date | undefined;
  let needsReply = false;
  let lastInbound: Row | undefined;

  for (const m of messages) {
    const at = m.sentAt ?? new Date(0);
    const fx = messageEffect(m);
    if (fx.sms && fx.inbound) {
      bumpedBeforeLastInbound = bumpedAt;
      lastInbound = m;
      lastInboundAt = at;
    } else if (fx.sms) {
      lastOutboundAt = at;
    }
    if (fx.bump) bumpedAt = at;
    if (fx.needsReply !== undefined) needsReply = fx.needsReply;

    // STOP: nothing to answer.
    if (fx.inbound && m.inboundClassification === "opt_out") needsReply = false;

    // Auto-answered status check: handled without Mike, thread stays put —
    // unless the reply bounced, in which case it's back in the queue.
    if (!fx.inbound && m.autoReplied && lastInbound?.inboundClassification === "status_check") {
      if (m.deliveryStatus === "failed") {
        needsReply = true;
      } else {
        needsReply = false;
        bumpedAt = bumpedBeforeLastInbound ?? bumpedAt;
      }
    }
  }

  const last = messages[messages.length - 1]!;
  const lastMessageAt = last.sentAt ?? new Date(0);
  return {
    lastMessageAt,
    bumpedAt: bumpedAt ?? lastMessageAt,
    lastInboundAt,
    lastOutboundAt,
    needsReply,
    lastMessagePreview: previewOf(last.body),
    lastMessageId: last._id,
  };
}

const sameTime = (a?: Date | null, b?: Date | null) => (a?.getTime() ?? -1) === (b?.getTime() ?? -1);

async function main() {
  await connectDb();

  const threads = (await Message.aggregate<{ _id: { shopId: mongoose.Types.ObjectId; customerId: mongoose.Types.ObjectId } }>([
    { $group: { _id: { shopId: "$shopId", customerId: "$customerId" } } },
  ])) as { _id: { shopId: mongoose.Types.ObjectId; customerId: mongoose.Types.ObjectId } }[];

  let scanned = 0;
  let inserted = 0;
  let updated = 0;
  for (const { _id: key } of threads) {
    scanned++;
    const messages = (await Message.find(
      { shopId: key.shopId, customerId: key.customerId },
      {
        direction: 1,
        kind: 1,
        body: 1,
        sentAt: 1,
        autoReplied: 1,
        automated: 1,
        inboundClassification: 1,
        deliveryStatus: 1,
      }
    )
      .sort({ sentAt: 1, _id: 1 })
      .lean()) as unknown as Row[];
    const derived = deriveConversation(messages);
    if (!derived) continue;

    const existing = await Conversation.findOne({
      shopId: key.shopId,
      customerId: key.customerId,
    }).lean();

    if (!existing) {
      inserted++;
      console.log(`insert ${key.shopId}/${key.customerId}`, JSON.stringify(derived));
      if (apply) {
        await Conversation.create({
          shopId: key.shopId,
          customerId: key.customerId,
          ...derived,
          lastReadAt: derived.lastInboundAt,
          unreadCount: 0,
        });
      }
      continue;
    }

    const changed =
      !sameTime(existing.lastMessageAt, derived.lastMessageAt) ||
      !sameTime(existing.bumpedAt, derived.bumpedAt) ||
      !sameTime(existing.lastInboundAt, derived.lastInboundAt) ||
      !sameTime(existing.lastOutboundAt, derived.lastOutboundAt) ||
      (existing.needsReply ?? false) !== derived.needsReply ||
      String(existing.lastMessageId ?? "") !== String(derived.lastMessageId);
    if (!changed) continue;
    updated++;
    console.log(`update ${key.shopId}/${key.customerId}`, JSON.stringify(derived));
    if (apply) {
      await Conversation.updateOne({ _id: existing._id }, { $set: derived });
    }
  }

  console.log(
    `${apply ? "Wrote" : "Would write"} ${inserted} new + ${updated} updated of ${scanned} threads.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
