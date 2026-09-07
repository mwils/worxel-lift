import { DateTime } from "luxon";
import { connectDb } from "@lift/shared/db";
import {
  APPOINTMENT_REMINDER_LOCAL_HOUR,
  Customer,
  DEFAULT_SHOP_TIMEZONE,
  Message,
  RepairOrder,
  Shop,
  User,
} from "@lift/shared";
import { sendSms } from "../../lib/sms.js";
import { bookingManageUrl } from "../../lib/visitTime.js";

/**
 * Day-before appointment reminder (feature gap 6).
 *
 * Runs HOURLY and does nothing for most of those ticks: for each shop it reads
 * the wall clock in that shop's own timezone and only proceeds when the local
 * hour is APPOINTMENT_REMINDER_LOCAL_HOUR (5 PM). A single UTC cron would text
 * a Phoenix shop's customers at 9 AM and an Atlanta shop's at noon.
 *
 * Idempotency lives on the RO, not on a ServiceReminder row: `dailyScan`'s
 * reminders are vehicle + service-category + interval shaped (`dueAt =
 * completedAt + interval`, category out of SERVICE_INTERVALS) and an
 * appointment isn't a service category — it would need a fake one and would
 * then show up in Settings → Service reminders and GET /service-reminders.
 * Instead the RO carries `appointmentReminderSentAt` (when) and
 * `appointmentReminderFor` (which `scheduledFor` instant was reminded). The
 * second field means a reschedule re-arms the reminder for free — no other
 * handler has to remember to clear a flag.
 *
 * Unlike dailyScan this does NOT bail out under MOCK_SMS=1. Volume is one text
 * per appointment per shop per day (a handful), so mock-as-email is a useful
 * preview rather than an inbox flood.
 *
 * Sends are logged with `automated: true` so the inbox thread rules don't read
 * a reminder as the shop having replied, and `aiDrafted: false` — the copy is
 * a template, no Bedrock call.
 */

/** Per-shop cap so one shop's bad data can't eat the whole tick. */
const PER_SHOP_LIMIT = 100;

export const handler = async () => {
  await connectDb();

  const now = new Date();
  const shops = await Shop.find({}).select({ name: 1, timezone: 1, sms: 1, settings: 1, ownerUserId: 1 }).lean();

  let shopsDue = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const shop of shops) {
    const tz = shop.timezone || DEFAULT_SHOP_TIMEZONE;
    const local = DateTime.fromJSDate(now).setZone(tz);
    if (!local.isValid || local.hour !== APPOINTMENT_REMINDER_LOCAL_HOUR) continue;
    if (shop.settings?.appointmentRemindersEnabled === false) continue;
    shopsDue++;

    // "Tomorrow" is tomorrow at the shop, not tomorrow in UTC.
    const tomorrow = local.plus({ days: 1 });
    const windowStart = tomorrow.startOf("day").toJSDate();
    const windowEnd = tomorrow.endOf("day").toJSDate();

    // `$expr` compares the two RO fields: an RO is due a reminder while the
    // instant we last reminded for isn't the instant it's now scheduled for
    // (missing field → null → never equal → due).
    const ros = await RepairOrder.find({
      shopId: shop._id,
      status: "scheduled",
      scheduledFor: { $gte: windowStart, $lte: windowEnd },
      $expr: { $ne: ["$appointmentReminderFor", "$scheduledFor"] },
    })
      .sort({ scheduledFor: 1 })
      .limit(PER_SHOP_LIMIT);

    if (ros.length === 0) continue;

    const owner = shop.ownerUserId
      ? await User.findById(shop.ownerUserId).select({ email: 1 }).lean()
      : null;

    for (const ro of ros) {
      try {
        const customer = await Customer.findOne({
          _id: ro.customerId,
          shopId: shop._id,
        }).lean();
        if (!customer || customer.smsOptOutAt) {
          skipped++;
          continue;
        }
        if (!ro.scheduledFor) {
          skipped++;
          continue;
        }

        const body = appointmentReminderBody({
          shopName: shop.name,
          scheduledFor: ro.scheduledFor,
          timezone: tz,
          bookingToken: ro.bookingToken,
          bookingEnabled: shop.settings?.booking?.enabled === true,
        });

        const sendResult = await sendSms({
          to: customer.phone,
          from: shop.sms?.phoneNumber ?? undefined,
          body,
          mockEmailRecipient: customer.email ?? owner?.email ?? undefined,
        });

        await Message.create({
          shopId: shop._id,
          customerId: customer._id,
          repairOrderId: ro._id,
          direction: "out",
          body,
          awsMessageId: sendResult.messageId,
          aiDrafted: false,
          automated: true,
        });

        // Stamp after the send. A crash between the two re-sends tomorrow's
        // reminder on the next tick, which beats silently never sending it.
        ro.appointmentReminderSentAt = new Date();
        ro.appointmentReminderFor = ro.scheduledFor;
        await ro.save();
        sent++;
      } catch (err) {
        failed++;
        console.error("[appointmentReminderCron] reminder failed", {
          repairOrderId: String(ro._id),
          error: (err as Error).message,
        });
      }
    }
  }

  console.log("[appointmentReminderCron] done", { shopsDue, sent, skipped, failed });
  return { shopsDue, sent, skipped, failed } as const;
};

/**
 * The reminder copy. Only offers the replies that actually work:
 *   - booking on + manage token  → C cancels, R reschedules
 *   - manage token, booking off  → cancel works, reschedule 400s → offer C only
 *   - no manage token            → nothing self-service; point at the thread
 *
 * Opt-in / STOP / HELP language deliberately stays out — it lives in the
 * one-time opt-in script, same as the booking confirmation and the timezone
 * correction notice.
 */
export function appointmentReminderBody(args: {
  shopName: string;
  scheduledFor: Date;
  timezone: string;
  bookingToken?: string | null;
  bookingEnabled: boolean;
}): string {
  const time = DateTime.fromJSDate(args.scheduledFor)
    .setZone(args.timezone || DEFAULT_SHOP_TIMEZONE)
    .toFormat("h:mm a");

  let tail: string;
  if (args.bookingToken && args.bookingEnabled) {
    tail = `Reply C to cancel or R to reschedule: ${bookingManageUrl(args.bookingToken)}`;
  } else if (args.bookingToken) {
    tail = `Need to cancel? ${bookingManageUrl(args.bookingToken)}`;
  } else {
    tail = "Reply here if you need to change it.";
  }

  return `See you tomorrow at ${time} at ${args.shopName}. ${tail}`;
}
