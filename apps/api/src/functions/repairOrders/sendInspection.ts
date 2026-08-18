import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import {
  Customer,
  Message,
  RepairOrder,
  SendInspectionDto,
  Shop,
  User,
  Vehicle,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withVerifiedAuth } from "../../lib/middleware.js";
import { badRequest, created, notFound } from "../../lib/response.js";
import { sendSms } from "../../lib/sms.js";

const TEMPLATE_VERSION = "inspection.template.v1";

function webBase(): string {
  return (process.env.WEB_APP_URL ?? "https://app.lift.com").replace(/\/+$/, "");
}

function publicInspectionUrl(token: string): string {
  return `${webBase()}/public/inspection/${token}`;
}

function publicEstimateUrl(token: string): string {
  return `${webBase()}/public/estimate/${token}`;
}

interface InspectionSmsInput {
  shopName: string;
  customerFirstName: string;
  vehicle: { year?: number; make?: string; model?: string };
  itemCount: number;
  hasEstimate: boolean;
  totalCents: number;
  inspectionUrl: string;
  estimateUrl?: string;
}

export function buildInspectionTemplate(input: InspectionSmsInput): string {
  const veh = [input.vehicle.year, input.vehicle.make, input.vehicle.model]
    .filter(Boolean)
    .join(" ");
  const vehiclePart = veh ? ` your ${veh}` : " your vehicle";
  const lines: string[] = [];
  if (input.hasEstimate && input.totalCents > 0) {
    const total = `$${(input.totalCents / 100).toFixed(2)}`;
    lines.push(
      `Hi ${input.customerFirstName} — we pulled${vehiclePart} in and walked through it. ` +
        `Photos and notes are here, with the estimate (${total}) at the bottom — you can approve right from the page.`
    );
  } else {
    lines.push(
      `Hi ${input.customerFirstName} — we pulled${vehiclePart} in and walked through it. ` +
        `Photos and notes are here so you can see what we found.`
    );
  }
  lines.push("");
  lines.push(input.inspectionUrl);
  return lines.join("\n");
}

export const handler: APIGatewayProxyHandlerV2 = withVerifiedAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing repair order id");

    let dto: { includeEstimate?: boolean; draftOverride?: string } = { includeEstimate: true };
    if (event.body && event.body.trim().length > 0) {
      dto = await parseBody(event, SendInspectionDto);
    }
    const includeEstimate = dto.includeEstimate ?? true;

    const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    const inspection = (ro as any).inspection;
    if (!inspection || !inspection.items || inspection.items.length === 0) {
      return badRequest("Repair order has no inspection items");
    }

    const [customer, vehicle, shop] = await Promise.all([
      Customer.findOne({ _id: ro.customerId, shopId: user.shopId }).lean(),
      Vehicle.findOne({ _id: ro.vehicleId, shopId: user.shopId }).lean(),
      Shop.findById(user.shopId).lean(),
    ]);
    if (!customer) return notFound("Customer not found");
    if (!shop) return notFound("Shop not found");

    if (!inspection.publicToken) {
      inspection.publicToken = randomBytes(24).toString("base64url");
    }
    if (includeEstimate && (!ro.estimate || !ro.estimate.publicToken)) {
      ro.estimate = {
        ...(ro.estimate ?? {}),
        publicToken: randomBytes(24).toString("base64url"),
      } as typeof ro.estimate;
    }

    const inspectionUrl = publicInspectionUrl(inspection.publicToken);
    const estimateUrl =
      includeEstimate && ro.estimate?.publicToken
        ? publicEstimateUrl(ro.estimate.publicToken)
        : undefined;

    const draft =
      dto.draftOverride && dto.draftOverride.trim().length > 0
        ? dto.draftOverride.trim()
        : buildInspectionTemplate({
            shopName: shop.name,
            customerFirstName: customer.firstName,
            vehicle: {
              year: vehicle?.year ?? undefined,
              make: vehicle?.make ?? undefined,
              model: vehicle?.model ?? undefined,
            },
            itemCount: inspection.items.length,
            hasEstimate: includeEstimate && (ro.lineItems?.length ?? 0) > 0,
            totalCents: ro.total ?? 0,
            inspectionUrl,
            estimateUrl,
          });

    const owner = shop.ownerUserId ? await User.findById(shop.ownerUserId).lean() : null;
    const mockEmailRecipient = customer.email ?? owner?.email;

    const smsResult = await sendSms({
      to: customer.phone,
      from: shop.sms?.phoneNumber ?? undefined,
      body: draft,
      mockEmailRecipient: mockEmailRecipient ?? undefined,
    });

    const message = await Message.create({
      shopId: user.shopId,
      customerId: customer._id,
      repairOrderId: ro._id,
      direction: "out",
      body: draft,
      sentAt: new Date(),
      aiDrafted: false,
      aiPromptVersion: TEMPLATE_VERSION,
      awsMessageId: smsResult.messageId,
    });

    inspection.status = "sent";
    inspection.sentAt = new Date();
    await ro.save();

    return created({
      inspection: {
        status: inspection.status,
        sentAt: inspection.sentAt,
        viewedAt: inspection.viewedAt ?? null,
        itemCount: inspection.items.length,
      },
      message: {
        id: String(message._id),
        body: message.body,
        sentAt: message.sentAt,
        awsMessageId: message.awsMessageId ?? null,
      },
      draft,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
