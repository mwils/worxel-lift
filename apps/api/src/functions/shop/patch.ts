import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { RepairOrder, Shop, UpdateShopDto } from "@lift/shared";
import { DEFAULT_SHOP_TIMEZONE, buildOptInScript } from "@lift/shared/constants";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, conflict, notFound, ok } from "../../lib/response.js";
import { shiftWallClock } from "../../lib/visitTime.js";

const MAX_OLD_SLUGS = 5;

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, UpdateShopDto);

    const update: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    if (dto.name !== undefined) {
      update.name = dto.name;
      // The stored opt-in disclosure names the shop — keep it in step so a
      // name fix in Settings also fixes the script.
      update["sms.optInScript"] = buildOptInScript(dto.name);
    }
    if (dto.address !== undefined) update.address = dto.address;
    if (dto.phone !== undefined) {
      if (dto.phone === null) unset.phone = 1;
      else update.phone = dto.phone;
    }
    if (dto.timezone !== undefined) update.timezone = dto.timezone;
    if (dto.settings?.aiTone !== undefined) update["settings.aiTone"] = dto.settings.aiTone;
    if (dto.settings?.autoReplyEnabled !== undefined) {
      update["settings.autoReplyEnabled"] = dto.settings.autoReplyEnabled;
    }
    if (dto.settings?.defaultLaborRate !== undefined) {
      update["settings.defaultLaborRate"] = dto.settings.defaultLaborRate;
    }
    if (dto.settings?.serviceRemindersEnabled !== undefined) {
      update["settings.serviceRemindersEnabled"] = dto.settings.serviceRemindersEnabled;
    }
    if (dto.settings?.taxRatePct !== undefined) {
      update["settings.taxRatePct"] = dto.settings.taxRatePct;
    }
    if (dto.settings?.taxLabor !== undefined) {
      update["settings.taxLabor"] = dto.settings.taxLabor;
    }
    if (dto.settings?.booking !== undefined) {
      const b = dto.settings.booking;
      if (b.enabled !== undefined) update["settings.booking.enabled"] = b.enabled;
      if (b.slotMinutes !== undefined) update["settings.booking.slotMinutes"] = b.slotMinutes;
      if (b.maxPerSlot !== undefined) update["settings.booking.maxPerSlot"] = b.maxPerSlot;
      if (b.leadTimeHours !== undefined) update["settings.booking.leadTimeHours"] = b.leadTimeHours;
      if (b.horizonDays !== undefined) update["settings.booking.horizonDays"] = b.horizonDays;
      if (b.hours !== undefined) update["settings.booking.hours"] = b.hours;
      if (b.confirmationMessage !== undefined) {
        update["settings.booking.confirmationMessage"] = b.confirmationMessage;
      }
    }

    // Slug and timezone changes both need the stored doc first (slug:
    // uniqueness check + oldSlugs push; timezone: the old zone to re-anchor
    // upcoming visits against).
    const needsCurrent = dto.slug !== undefined || dto.timezone !== undefined;
    const current = needsCurrent ? await Shop.findById(user.shopId).lean() : null;
    if (needsCurrent && !current) return notFound("Shop not found");

    // Timezone change (QA round-2 M1): `scheduledFor` is an instant, so every
    // upcoming visit would silently re-label in the new zone while the
    // customer's confirmation text still says the old wall-clock. Default is
    // keep_clock — re-anchor each visit so 9:00 AM stays 9:00 AM. The shift
    // runs after the shop write succeeds; the response tells Settings what
    // happened so it can offer to text customers (keep_instant only).
    const previousTimezone = current?.timezone || DEFAULT_SHOP_TIMEZONE;
    const nextTimezone =
      dto.timezone !== undefined && dto.timezone !== previousTimezone ? dto.timezone : null;
    const upcoming = nextTimezone
      ? await RepairOrder.find(
          { shopId: user.shopId, status: "scheduled", scheduledFor: { $gt: new Date() } },
          { scheduledFor: 1 }
        ).lean()
      : [];
    const appointments = nextTimezone
      ? {
          mode: dto.appointmentMode ?? ("keep_clock" as const),
          affected: upcoming.length,
          roIds: upcoming.map((r) => String(r._id)),
          previousTimezone,
          timezone: nextTimezone,
        }
      : null;

    // Slug change needs an extra round-trip: uniqueness check, oldSlugs push.
    if (dto.slug !== undefined && current) {
      if (dto.slug !== current.slug) {
        const taken = await Shop.findOne({ slug: dto.slug, _id: { $ne: user.shopId } }).lean();
        if (taken) return conflict("That URL is taken — try another.", { slug: dto.slug });

        update.slug = dto.slug;
        if (current.slug) {
          // Keep the most-recent N old slugs for the 90-day redirect window
          // (redirect serving is v1.1; the field is just being stored now).
          const next = [current.slug, ...(current.oldSlugs ?? []).filter((s) => s !== dto.slug)]
            .slice(0, MAX_OLD_SLUGS);
          update.oldSlugs = next;
        }
      }
    }

    const shop = await Shop.findOneAndUpdate(
      { _id: user.shopId },
      { $set: update, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true }
    ).lean();
    if (!shop) return notFound("Shop not found");

    if (appointments?.mode === "keep_clock" && upcoming.length > 0) {
      await RepairOrder.bulkWrite(
        upcoming
          .filter((r) => r.scheduledFor)
          .map((r) => ({
            updateOne: {
              filter: { _id: r._id, shopId: user.shopId },
              update: {
                $set: {
                  scheduledFor: shiftWallClock(
                    r.scheduledFor as Date,
                    previousTimezone,
                    appointments.timezone
                  ),
                },
              },
            },
          }))
      );
    }

    return ok({
      appointments,
      shop: {
        id: String(shop._id),
        name: shop.name,
        slug: shop.slug ?? null,
        oldSlugs: shop.oldSlugs ?? [],
        address: shop.address,
        phone: shop.phone ?? null,
        timezone: shop.timezone,
        sms: { phoneNumber: shop.sms?.phoneNumber },
        billing: shop.billing,
        settings: shop.settings,
      },
    });
  } catch (err) {
    if ((err as any)?.code === 11000 && (err as any)?.keyPattern?.slug) {
      return conflict("That URL is taken — try another.");
    }
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
