import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { Customer, Message, RepairOrder, SendMessageDto, Shop, User } from "@lift/shared";
import { handleKnownErrors, parseBody, withVerifiedAuth } from "../../lib/middleware.js";
import { badRequest, created, notFound } from "../../lib/response.js";
import { sendSms } from "../../lib/sms.js";

export const handler: APIGatewayProxyHandlerV2 = withVerifiedAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, SendMessageDto);

    const customer = await Customer.findOne({
      _id: dto.customerId,
      shopId: user.shopId,
    }).lean();
    if (!customer) return notFound("Customer not found");

    if (dto.repairOrderId) {
      const ro = await RepairOrder.findOne({
        _id: dto.repairOrderId,
        shopId: user.shopId,
      }).lean();
      if (!ro) return notFound("Repair order not found");
    }

    const shop = await Shop.findById(user.shopId).lean();
    if (!shop) return notFound("Shop not found");

    const owner = shop.ownerUserId
      ? await User.findById(shop.ownerUserId).lean()
      : null;
    const ownerEmail = owner?.email;
    const mockEmailRecipient = customer.email ?? ownerEmail;

    const fromNumber = shop.sms?.phoneNumber ?? undefined;
    const smsResult = await sendSms({
      to: customer.phone,
      from: fromNumber,
      body: dto.body,
      mockEmailRecipient: mockEmailRecipient ?? undefined,
    });

    const message = await Message.create({
      shopId: user.shopId,
      customerId: customer._id,
      repairOrderId: dto.repairOrderId,
      direction: "out",
      body: dto.body,
      mediaUrls: dto.mediaKeys ?? [],
      sentAt: new Date(),
      aiDrafted: dto.aiDrafted,
      // Lift-composed sends the owner didn't type (auto-mode Ready texts) are
      // flagged so the inbox thread rules don't read them as a human reply.
      automated: dto.automated,
      awsMessageId: smsResult.messageId,
    });

    // The shop texting a customer who declined the estimate is the follow-up
    // the board banner is waiting on — whatever they said. Stamp it once.
    if (dto.repairOrderId) {
      await RepairOrder.updateOne(
        {
          _id: dto.repairOrderId,
          shopId: user.shopId,
          "estimate.declinedAt": { $exists: true },
          "estimate.approvedAt": { $exists: false },
          "estimate.declineFollowedUpAt": { $exists: false },
        },
        { $set: { "estimate.declineFollowedUpAt": message.sentAt } }
      ).catch((err) => console.error("[messages/send] decline follow-up stamp failed", err));
    }

    return created({
      message: {
        id: String(message._id),
        shopId: String(message.shopId),
        customerId: String(message.customerId),
        repairOrderId: message.repairOrderId ? String(message.repairOrderId) : null,
        direction: message.direction,
        body: message.body,
        mediaUrls: message.mediaUrls ?? [],
        sentAt: message.sentAt,
        aiDrafted: message.aiDrafted,
        autoReplied: message.autoReplied ?? false,
        automated: message.automated ?? false,
        deliveryStatus: message.deliveryStatus ?? null,
        awsMessageId: message.awsMessageId ?? null,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
