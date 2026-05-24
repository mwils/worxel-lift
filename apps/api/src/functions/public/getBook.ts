import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Shop } from "@lift/shared";
import { BOOKING_DEFAULTS } from "@lift/shared/constants";
import { withErrorBoundary } from "../../lib/middleware.js";
import { notFound, ok } from "../../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const slug = event.pathParameters?.slug;
  if (!slug) return notFound();

  const shop = await Shop.findOne({ slug }).lean();
  if (!shop) return notFound();

  const b = (shop.settings?.booking ?? {}) as {
    enabled?: boolean;
    slotMinutes?: number;
    leadTimeHours?: number;
    horizonDays?: number;
    confirmationMessage?: string | null;
  };
  const enabled = b.enabled === true;

  return ok({
    shop: {
      name: shop.name,
      slug: shop.slug,
      address: shop.address ?? null,
      timezone: shop.timezone ?? "America/Chicago",
    },
    enabled,
    // Surface the config bits the public page needs to render its date/time
    // picker (it doesn't need maxPerSlot — the slot endpoint just returns
    // `available` per slot).
    booking: {
      slotMinutes: b.slotMinutes ?? BOOKING_DEFAULTS.slotMinutes,
      leadTimeHours: b.leadTimeHours ?? BOOKING_DEFAULTS.leadTimeHours,
      horizonDays: b.horizonDays ?? BOOKING_DEFAULTS.horizonDays,
      confirmationMessage: b.confirmationMessage ?? null,
    },
  });
});
