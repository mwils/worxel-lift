import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DateTime } from "luxon";
import { Customer, Message, RepairOrder, Shop, User } from "@lift/shared";
import { withErrorBoundary } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { sendSms } from "../../lib/sms.js";

export const handler: APIGatewayProxyHandlerV2 = withErrorBoundary(async (event) => {
  const token = event.pathParameters?.token;
  if (!token) return notFound();

  const ro = await RepairOrder.findOne({ bookingToken: token });
  if (!ro) return notFound();
  if (ro.status === "cancelled_by_customer") {
    return ok({ status: ro.status, alreadyCancelled: true });
  }
  if (ro.status !== "scheduled") {
    return badRequest("This booking can no longer be cancelled by the customer.", {
      status: ro.status,
    });
  }

  const shop = await Shop.findById(ro.shopId).lean();
  if (!shop) return notFound("Shop not found");

  ro.status = "cancelled_by_customer";
  await ro.save();

  const [customer, owner] = await Promise.all([
    Customer.findById(ro.customerId).lean(),
    shop.ownerUserId ? User.findById(shop.ownerUserId).lean() : Promise.resolve(null),
  ]);

  const tz = shop.timezone || "America/Chicago";
  const whenHuman = ro.scheduledFor
    ? DateTime.fromJSDate(ro.scheduledFor).setZone(tz).toFormat("ccc LLL d 'at' h:mm a")
    : "that time";

  if (customer && !customer.smsOptOutAt) {
    const body = `Cancelled — your ${whenHuman} appointment at ${shop.name} is off the books. Reply here if you want to re-book.`;
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
      autoReplied: true,
    });
  }

  // Also tell Mike — a cancellation hitting the board with no inline reason
  // would be confusing.
  if (owner?.phone && customer) {
    const body = `Cancelled by customer: ${customer.firstName} — ${whenHuman}.`;
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
      autoReplied: true,
    });
  }

  return ok({ status: ro.status });
});
