import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import {
  AiInteraction,
  Customer,
  Message,
  RepairOrder,
  SendEstimateDto,
  Shop,
  User,
  Vehicle,
  buildEstimatePrompt,
  buildEstimateTemplate,
  ESTIMATE_PROMPT_VERSION,
} from "@lift/shared";

const TEMPLATE_VERSION = "estimate.template.v1";
import { handleKnownErrors, parseBody, withVerifiedAuth } from "../../lib/middleware.js";
import { badRequest, created, notFound } from "../../lib/response.js";
import { invokeModel, modelDraft } from "../../lib/bedrock.js";
import { sendSms } from "../../lib/sms.js";

function publicEstimateUrl(token: string): string {
  const base = (process.env.WEB_APP_URL ?? "https://app.lift.com").replace(/\/+$/, "");
  return `${base}/public/estimate/${token}`;
}

function publicInspectionUrl(token: string): string {
  const base = (process.env.WEB_APP_URL ?? "https://app.lift.com").replace(/\/+$/, "");
  return `${base}/public/inspection/${token}`;
}

export const handler: APIGatewayProxyHandlerV2 = withVerifiedAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing repair order id");

    // Body is optional ({ draftOverride?, useAi?, combineWithInspection? }).
    // Treat empty body as {}.
    let dto: {
      draftOverride?: string;
      useAi?: boolean;
      combineWithInspection?: boolean;
    } = {};
    if (event.body && event.body.trim().length > 0) {
      dto = await parseBody(event, SendEstimateDto);
    }

    const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");
    if (!ro.lineItems || ro.lineItems.length === 0) {
      return badRequest("Repair order has no line items");
    }

    const [customer, vehicle, shop] = await Promise.all([
      Customer.findOne({ _id: ro.customerId, shopId: user.shopId }).lean(),
      Vehicle.findOne({ _id: ro.vehicleId, shopId: user.shopId }).lean(),
      Shop.findById(user.shopId).lean(),
    ]);
    if (!customer) return notFound("Customer not found");
    if (!shop) return notFound("Shop not found");

    // Mint estimate.publicToken if absent (legacy ro.publicToken also kept in sync).
    let estimatePublicToken = ro.estimate?.publicToken;
    if (!estimatePublicToken) {
      estimatePublicToken = randomBytes(24).toString("base64url");
      ro.estimate = {
        ...(ro.estimate ?? {}),
        publicToken: estimatePublicToken,
      } as typeof ro.estimate;
    }
    if (!ro.publicToken) {
      ro.publicToken = estimatePublicToken;
    }

    // If combineWithInspection AND there are inspection items, route the
    // customer to the inspection page (which embeds the estimate + approve).
    const inspection: any = (ro as any).inspection;
    const hasInspectionItems =
      !!inspection && Array.isArray(inspection.items) && inspection.items.length > 0;
    const useInspectionLink = !!dto.combineWithInspection && hasInspectionItems;
    if (useInspectionLink && !inspection.publicToken) {
      inspection.publicToken = randomBytes(24).toString("base64url");
    }
    const approveLinkUrl = useInspectionLink
      ? publicInspectionUrl(inspection.publicToken)
      : publicEstimateUrl(estimatePublicToken);

    const aiTone = (shop.settings?.aiTone ?? "plain") as "plain" | "friendly";
    const model = modelDraft();

    // Resolve the body. Priority:
    //   1. owner-edited override (most common — frontend pre-fetched a draft
    //      and the owner approved it in the modal)
    //   2. useAi:true → call Bedrock fresh (server-side AI path)
    //   3. default → deterministic template (no AI cost)
    let draft: string;
    let aiDrafted = false;
    let promptVersion = TEMPLATE_VERSION;

    const estimateInput = {
      shopName: shop.name,
      customerFirstName: customer.firstName,
      vehicle: {
        year: vehicle?.year ?? undefined,
        make: vehicle?.make ?? undefined,
        model: vehicle?.model ?? undefined,
      },
      lineItems: (ro.lineItems ?? []).map((li: any) => ({
        kind: li.kind,
        description: li.description,
        total: li.total,
      })),
      totalCents: ro.total ?? 0,
      approveLinkUrl,
      aiTone,
    };

    if (dto.draftOverride && dto.draftOverride.trim().length > 0) {
      draft = dto.draftOverride.trim();
      // Frontend tells us whether the owner accepted an AI-polished version.
      // For now infer: callers using the Polish flow re-fetch the AI draft
      // and send it back here as the override. We can't tell from here whether
      // they polished or not, so we conservatively flag aiDrafted=false. The
      // frontend can pass useAi:true alongside override to mark provenance.
      aiDrafted = dto.useAi === true;
      promptVersion = aiDrafted ? ESTIMATE_PROMPT_VERSION : TEMPLATE_VERSION;
    } else if (dto.useAi) {
      const prompt = buildEstimatePrompt(estimateInput);
      const started = Date.now();
      let invokeResult;
      let error: string | undefined;
      try {
        invokeResult = await invokeModel({
          modelId: model,
          prompt,
          maxTokens: 400,
          temperature: 0.5,
        });
        draft = invokeResult.text.trim();
        aiDrafted = true;
        promptVersion = ESTIMATE_PROMPT_VERSION;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        await AiInteraction.create({
          shopId: user.shopId,
          kind: "send_estimate",
          model,
          promptVersion: ESTIMATE_PROMPT_VERSION,
          inputTokens: invokeResult?.inputTokens,
          outputTokens: invokeResult?.outputTokens,
          durationMs: Date.now() - started,
          error,
        }).catch((e) =>
          console.error("[ro/sendEstimate] failed to log AiInteraction", e)
        );
      }
    } else {
      draft = buildEstimateTemplate(estimateInput);
    }

    const owner = shop.ownerUserId
      ? await User.findById(shop.ownerUserId).lean()
      : null;
    const ownerEmail = owner?.email;
    const mockEmailRecipient = customer.email ?? ownerEmail;

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
      aiDrafted,
      aiModel: aiDrafted ? model : undefined,
      aiPromptVersion: promptVersion,
      awsMessageId: smsResult.messageId,
    });

    // Stamp the RO with sentAt + persist mint of publicToken.
    ro.estimate = {
      ...(ro.estimate ?? {}),
      sentAt: new Date(),
    } as typeof ro.estimate;
    await ro.save();

    return created({
      message: {
        id: String(message._id),
        customerId: String(message.customerId),
        repairOrderId: message.repairOrderId ? String(message.repairOrderId) : null,
        direction: message.direction,
        body: message.body,
        sentAt: message.sentAt,
        aiDrafted: message.aiDrafted,
        awsMessageId: message.awsMessageId ?? null,
      },
      publicToken: ro.publicToken,
      draft,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
