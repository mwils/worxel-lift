import { DateTime } from "luxon";
import { DEFAULT_SHOP_TIMEZONE } from "@lift/shared/constants";

/**
 * Visit-time helpers shared by the booking confirmation, the reschedule
 * notice, and the timezone-correction notice so every text the customer gets
 * spells the time the same way ("Thu Sep 10 at 9:00 AM").
 */

export const VISIT_TIME_FORMAT = "ccc LLL d 'at' h:mm a";

export function formatVisitTime(when: Date, tz: string | null | undefined): string {
  return DateTime.fromJSDate(when)
    .setZone(tz || DEFAULT_SHOP_TIMEZONE)
    .toFormat(VISIT_TIME_FORMAT);
}

/** Public self-service page for a booking (reschedule / cancel). */
export function bookingManageUrl(bookingToken: string): string {
  return `${process.env.MARKETING_URL ?? ""}/booking/${bookingToken}`;
}

/**
 * Re-anchor an instant so its wall-clock reading in `fromTz` becomes the same
 * wall-clock reading in `toTz` (9:00 AM Chicago → 9:00 AM New York). This is
 * what a shop means when it corrects a wrong default timezone: the customer
 * was told "9:00 AM" and 9:00 AM is still when they should show up.
 */
export function shiftWallClock(when: Date, fromTz: string, toTz: string): Date {
  return DateTime.fromJSDate(when)
    .setZone(fromTz || DEFAULT_SHOP_TIMEZONE)
    .setZone(toTz || DEFAULT_SHOP_TIMEZONE, { keepLocalTime: true })
    .toJSDate();
}

/**
 * Customer copy for a timezone correction where the stored instant was kept
 * and the label moved (keep_instant). Mirrors the reschedule notice's shape;
 * the "(not 9:00 AM)" clause names the earlier text so the customer knows
 * which one to trust. Opt-in / STOP / HELP language lives in the opt-in
 * script sent on first contact, not in per-visit texts — same as booking.
 */
export function visitTimeCorrectionBody(args: {
  shopName: string;
  scheduledFor: Date;
  timezone: string;
  previousTimezone: string;
  bookingToken?: string | null;
}): string {
  const now = formatVisitTime(args.scheduledFor, args.timezone);
  const before = DateTime.fromJSDate(args.scheduledFor).setZone(args.previousTimezone);
  const after = DateTime.fromJSDate(args.scheduledFor).setZone(args.timezone);
  let was = "";
  if (before.toFormat(VISIT_TIME_FORMAT) !== now) {
    // Same calendar day → just the clock ("not 9:00 AM"); otherwise spell it out.
    was =
      before.toISODate() === after.toISODate()
        ? ` (not ${before.toFormat("h:mm a")})`
        : ` (not ${before.toFormat(VISIT_TIME_FORMAT)})`;
  }
  const change = args.bookingToken
    ? `Need to change it? ${bookingManageUrl(args.bookingToken)}`
    : "Reply here if you need to change it.";
  return `Correction from ${args.shopName}: your visit is ${now}${was}. ${change}`;
}
