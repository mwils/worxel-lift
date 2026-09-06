import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  Customer,
  Message,
  RepairOrder,
  RescheduleBookingDto,
  Shop,
  User,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withErrorBoundary } from "../../lib/middleware.js";
import { badRequest, conflict, notFound, ok } from "../../lib/response.js";
import { sendSms } from "../../lib/sms.js";
import { bookingManageUrl, formatVisitTime } from "../../lib/visitTime.js";
import { validateSlot } from "./_slots.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  try {
    const token = event.pathParameters?.token;
    if (!token) return notFound();

    const dto = await parseBody(event, RescheduleBookingDto);

    const ro = await RepairOrder.findOne({ bookingToken: token });
    if (!ro) return notFound();
    if (ro.status !== "scheduled") {
      return badRequest("This booking can no longer be rescheduled.", { status: ro.status });
    }

    const shop = await Shop.findById(ro.shopId).lean();
    if (!shop) return notFound("Shop not found");
    if (!shop.settings?.booking?.enabled) {
      return badRequest("Online booking is disabled for this shop");
    }

    const validation = await validateSlot(shop, dto.start, new Date(), {
      ignoreRoId: String(ro._id),
    });
    if (!validation.ok) {
      if (validation.reason === "full") {
        return conflict("That time was just taken. Please pick another slot.");
      }
      if (validation.reason === "too_soon") {
        return badRequest("Please pick a time further out.");
      }
      return badRequest("That time isn't available.", { reason: validation.reason });
    }

    ro.scheduledFor = validation.slotDate;
    await ro.save();

    const [customer, owner] = await Promise.all([
      Customer.findById(ro.customerId).lean(),
      shop.ownerUserId ? User.findById(shop.ownerUserId).lean() : Promise.resolve(null),
    ]);

    const whenHuman = formatVisitTime(validation.slotDate, shop.timezone);
    const manageUrl = bookingManageUrl(token);

    if (customer && !customer.smsOptOutAt) {
      const body = `Booking moved to ${whenHuman} at ${shop.name}. Need to change it? ${manageUrl}`;
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
    }

    if (owner?.phone && customer) {
      const body = `Booking moved: ${customer.firstName} → ${whenHuman}.`;
      const ownerSend = await sendSms({
        to: owner.phone,
        from: shop.sms?.phoneNumber ?? undefined,
        body,
        mockEmailRecipient: owner.email,
      });
      await Message.create({
        shopId: shop._id,
        customerId: customer._id,
        repairOrderId: ro._id,
        direction: "out",
        body,
        awsMessageId: ownerSend.messageId,
        automated: true,
      });
    }

    return ok({
      scheduledFor: validation.slotDate.toISOString(),
      status: ro.status,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
