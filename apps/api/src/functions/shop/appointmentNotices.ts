import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AppointmentNoticesDto, Customer, Message, RepairOrder, Shop, User } from "@lift/shared";
import { DEFAULT_SHOP_TIMEZONE } from "@lift/shared/constants";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { sendSms } from "../../lib/sms.js";
import { visitTimeCorrectionBody } from "../../lib/visitTime.js";

/**
 * POST /shop/appointment-notices
 *
 * Second step of a timezone change (QA round-2 M1). When the owner picked
 * "keep the same instant", every upcoming visit now reads a different
 * wall-clock than the confirmation text the customer already has. Settings
 * offers "Send corrected times to N customers"; this is that tap. Never called
 * without it — nothing here fires on the PATCH itself.
 *
 * Re-validates every RO against the session shop (ids come from the client)
 * and skips opted-out customers.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, AppointmentNoticesDto);

    const shop = await Shop.findById(user.shopId).lean();
    if (!shop) return notFound("Shop not found");
    const timezone = shop.timezone || DEFAULT_SHOP_TIMEZONE;

    const ros = await RepairOrder.find({
      _id: { $in: dto.roIds },
      shopId: user.shopId,
      status: "scheduled",
      scheduledFor: { $gt: new Date() },
    }).lean();

    const customerIds = Array.from(new Set(ros.map((r) => String(r.customerId))));
    const [customers, owner] = await Promise.all([
      Customer.find({ _id: { $in: customerIds }, shopId: user.shopId }).lean(),
      shop.ownerUserId ? User.findById(shop.ownerUserId).lean() : Promise.resolve(null),
    ]);
    const customerById = new Map(customers.map((c) => [String(c._id), c]));

    let sent = 0;
    let skipped = 0;
    for (const ro of ros) {
      const customer = customerById.get(String(ro.customerId));
      if (!customer || !ro.scheduledFor || customer.smsOptOutAt) {
        skipped++;
        continue;
      }
      const body = visitTimeCorrectionBody({
        shopName: shop.name,
        scheduledFor: ro.scheduledFor,
        timezone,
        previousTimezone: dto.previousTimezone,
        bookingToken: ro.bookingToken,
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
        automated: true,
      });
      sent++;
    }

    return ok({ sent, skipped });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
