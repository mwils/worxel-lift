import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DateTime } from "luxon";
import { RepairOrder, Shop } from "@lift/shared";
import { BOOKING_DEFAULTS } from "@lift/shared/constants";
import { BookSlotsQueryDto } from "@lift/shared";
import { handleKnownErrors, parseQuery, withErrorBoundary } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { computeSlots, readBookingConfig } from "./_slots.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  try {
    const slug = event.pathParameters?.slug;
    if (!slug) return notFound();

    const q = parseQuery(event, BookSlotsQueryDto);

    const shop = await Shop.findOne({ slug }).lean();
    if (!shop) return notFound();
    if (!shop.settings?.booking?.enabled) {
      return badRequest("Online booking is disabled for this shop");
    }

    const cfg = readBookingConfig(shop);
    const tz = shop.timezone || "America/Chicago";
    const from = DateTime.fromISO(q.from, { zone: tz });
    const to = DateTime.fromISO(q.to, { zone: tz });
    if (!from.isValid || !to.isValid || to < from) {
      return badRequest("Invalid date range");
    }
    const spanDays = Math.round(to.diff(from, "days").days) + 1;
    if (spanDays > cfg.horizonDays) {
      return badRequest(
        `Range too wide — max ${cfg.horizonDays} days, got ${spanDays}`,
        { horizonDays: cfg.horizonDays }
      );
    }

    // Reschedule flow passes the booking's manage token so its own RO doesn't
    // count against slot capacity. Scoped to this shop so a token can't probe
    // another shop's calendar.
    let ignoreRoId: string | undefined;
    if (q.exclude) {
      const own = await RepairOrder.findOne(
        { bookingToken: q.exclude, shopId: shop._id },
        { _id: 1 }
      ).lean();
      if (own) ignoreRoId = String(own._id);
    }

    const days = await computeSlots(shop, q.from, q.to, new Date(), { ignoreRoId });
    return ok({
      timezone: tz,
      slotMinutes: cfg.slotMinutes ?? BOOKING_DEFAULTS.slotMinutes,
      days,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
