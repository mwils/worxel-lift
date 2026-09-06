import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import {
  AiInteraction,
  Customer,
  DraftMessageDto,
  Message,
  RO_OPEN_STATUSES,
  RepairOrder,
  Shop,
  Vehicle,
  assemblePolishedEstimate,
  buildEstimatePrompt,
  buildEstimateTemplate,
  buildFreeformPrompt,
  buildPayLinkPrompt,
  buildPayLinkTemplate,
  buildStatusReplyPrompt,
  buildStatusReplyTemplate,
  type EstimatePromptInput,
  type FreeformPromptInput,
  type FreeformRoSituation,
  type PayLinkPromptInput,
  type StatusReplyInput,
  ESTIMATE_PROMPT_VERSION,
  FREEFORM_PROMPT_VERSION,
  PAY_LINK_PROMPT_VERSION,
  STATUS_REPLY_PROMPT_VERSION,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, forbidden, notFound, ok } from "../../lib/response.js";
import { invokeModel, modelDraft } from "../../lib/bedrock.js";

function publicEstimateUrl(token: string): string {
  const base = (process.env.WEB_APP_URL ?? "https://app.lift.com").replace(/\/+$/, "");
  return `${base}/public/estimate/${token}`;
}

function publicPayUrl(token: string): string {
  const base = (process.env.WEB_APP_URL ?? "https://app.lift.com").replace(/\/+$/, "");
  return `${base}/public/pay/${token}`;
}

/**
 * Freeform drafts need to know what's actually going on with this customer
 * (QA M2): open ROs with vehicle + estimate state, the last completed job when
 * nothing is open, and the tail of the thread.
 */
async function loadFreeformSituation(
  shopId: unknown,
  customerId: unknown,
  focusedRoId?: string
): Promise<Pick<FreeformPromptInput, "openRos" | "lastCompletedRo" | "recentMessages">> {
  const [openRos, lastCompleted, recent] = await Promise.all([
    RepairOrder.find({ shopId, customerId, status: { $in: RO_OPEN_STATUSES } })
      .sort({ updatedAt: -1 })
      .limit(3)
      .lean(),
    RepairOrder.findOne({ shopId, customerId, status: "picked_up" })
      .sort({ completedAt: -1, updatedAt: -1 })
      .lean(),
    Message.find({ shopId, customerId }).sort({ sentAt: -1 }).limit(6).lean(),
  ]);

  const ros = [...openRos, ...(lastCompleted ? [lastCompleted] : [])];
  const vehicleIds = [...new Set(ros.map((r) => String(r.vehicleId)))];
  const vehicles = vehicleIds.length
    ? await Vehicle.find({ _id: { $in: vehicleIds }, shopId }).lean()
    : [];
  const vehicleById = new Map(vehicles.map((v) => [String(v._id), v]));

  const toSituation = (ro: (typeof ros)[number]): FreeformRoSituation => {
    const v = vehicleById.get(String(ro.vehicleId));
    return {
      roNumber: ro.number,
      vehicle: {
        year: v?.year ?? undefined,
        make: v?.make ?? undefined,
        model: v?.model ?? undefined,
      },
      status: ro.status,
      concern: ro.concern ?? undefined,
      estimateSentAt: ro.estimate?.sentAt ?? null,
      estimateApprovedAt: ro.estimate?.approvedAt ?? null,
      estimateDeclinedAt: ro.estimate?.declinedAt ?? null,
      scheduledFor: ro.scheduledFor ?? null,
      totalCents: ro.total ?? 0,
      focused: focusedRoId ? String(ro._id) === focusedRoId : false,
    };
  };

  return {
    openRos: openRos.map(toSituation),
    lastCompletedRo: lastCompleted ? toSituation(lastCompleted) : null,
    recentMessages: recent
      .slice()
      .reverse()
      .map((m) => ({
        direction: m.direction as "in" | "out",
        body: m.body,
        sentAt: m.sentAt ?? null,
      })),
  };
}

/**
 * POST /messages/draft
 *
 * Default path is deterministic templates (no Bedrock call). Set `useAi: true`
 * in the body to invoke Bedrock for the polished, jargon-translated version —
 * surfaced in the UI as the explicit "✨ Polish with AI" button. Freeform
 * always requires AI because there's no useful template for free-form text.
 *
 * Response: `{ draft, source: "template" | "ai", promptVersion?, model? }`.
 */
export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, DraftMessageDto);

    const [customer, shop] = await Promise.all([
      Customer.findOne({ _id: dto.customerId, shopId: user.shopId }).lean(),
      Shop.findById(user.shopId).lean(),
    ]);
    if (!customer) return notFound("Customer not found");
    if (!shop) return notFound("Shop not found");

    const aiTone = (shop.settings?.aiTone ?? "plain") as "plain" | "friendly";
    const useAi = dto.useAi === true || dto.kind === "freeform";

    // ── Build the shared input shape per kind ──────────────────
    let estimateInput: EstimatePromptInput | null = null;
    let statusInput: StatusReplyInput | null = null;
    let payLinkInput: PayLinkPromptInput | null = null;

    if (dto.kind === "pay_link") {
      if (!dto.repairOrderId) {
        return badRequest("repairOrderId is required for pay-link drafts");
      }
      // Same lazy-setup gate as POST /payments/create-link, but at draft time
      // so the owner finds out before composing a message.
      if (shop.stripe?.connectChargesEnabled !== true) {
        return forbidden(
          "Payments aren't set up yet — go to Settings → Getting paid. Takes about 5 minutes, then you can text pay links."
        );
      }
      const ro = await RepairOrder.findOne({
        _id: dto.repairOrderId,
        shopId: user.shopId,
      });
      if (!ro) return notFound("Repair order not found");
      if (!ro.total || ro.total <= 0) {
        return badRequest(
          "Repair order has no total — add line items before sending a pay link"
        );
      }

      // Mint publicToken if absent so the SMS draft contains the real URL
      // (not a "PENDING" placeholder).
      if (!ro.publicToken) {
        ro.publicToken = randomBytes(16).toString("base64url");
        await ro.save();
      }

      const vehicle = await Vehicle.findOne({
        _id: ro.vehicleId,
        shopId: user.shopId,
      }).lean();

      payLinkInput = {
        shopName: shop.name,
        customerFirstName: customer.firstName,
        vehicle: {
          year: vehicle?.year ?? undefined,
          make: vehicle?.make ?? undefined,
          model: vehicle?.model ?? undefined,
        },
        totalCents: ro.total,
        payLinkUrl: publicPayUrl(ro.publicToken),
        aiTone,
      };
    } else if (dto.kind === "estimate") {
      if (!dto.repairOrderId) {
        return badRequest("repairOrderId is required for estimate drafts");
      }
      const ro = await RepairOrder.findOne({
        _id: dto.repairOrderId,
        shopId: user.shopId,
      }).lean();
      if (!ro) return notFound("Repair order not found");
      if (!ro.lineItems || ro.lineItems.length === 0) {
        return badRequest("Repair order has no line items to estimate");
      }

      const vehicle = await Vehicle.findOne({
        _id: ro.vehicleId,
        shopId: user.shopId,
      }).lean();

      estimateInput = {
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
        taxCents: ro.taxTotal ?? 0,
        approveLinkUrl: publicEstimateUrl(ro.publicToken ?? "PENDING"),
        aiTone,
        concern: ro.concern ?? undefined,
      };
    } else if (dto.kind === "status_update" || dto.kind === "ready_for_pickup") {
      let roStatus = dto.kind === "ready_for_pickup" ? "ready" : "in_repair";
      if (dto.repairOrderId) {
        const ro = await RepairOrder.findOne({
          _id: dto.repairOrderId,
          shopId: user.shopId,
        }).lean();
        if (!ro) return notFound("Repair order not found");
        roStatus = dto.kind === "ready_for_pickup" ? "ready" : ro.status;
      }
      statusInput = {
        customerFirstName: customer.firstName,
        shopName: shop.name,
        roStatus,
        etaText: dto.context,
        aiTone,
      };
    }

    // ── Template path (no AI) ──────────────────────────────────
    if (!useAi) {
      let draft = "";
      if (estimateInput) draft = buildEstimateTemplate(estimateInput);
      else if (payLinkInput) draft = buildPayLinkTemplate(payLinkInput);
      else if (statusInput) draft = buildStatusReplyTemplate(statusInput);
      else return badRequest("Kind not supported without useAi=true");

      return ok({ draft, source: "template" as const });
    }

    // ── AI path ────────────────────────────────────────────────
    let prompt: string;
    let promptVersion: string;
    let kindLabel: string;

    if (estimateInput) {
      prompt = buildEstimatePrompt(estimateInput);
      promptVersion = ESTIMATE_PROMPT_VERSION;
      kindLabel = "draft_estimate";
    } else if (payLinkInput) {
      prompt = buildPayLinkPrompt(payLinkInput);
      promptVersion = PAY_LINK_PROMPT_VERSION;
      kindLabel = "draft_pay_link";
    } else if (statusInput) {
      prompt = buildStatusReplyPrompt(statusInput);
      promptVersion = STATUS_REPLY_PROMPT_VERSION;
      kindLabel =
        dto.kind === "ready_for_pickup" ? "draft_ready_for_pickup" : "draft_status_update";
    } else {
      const situation = await loadFreeformSituation(
        user.shopId,
        customer._id,
        dto.repairOrderId
      );
      prompt = buildFreeformPrompt({
        shopName: shop.name,
        customerFirstName: customer.firstName,
        aiTone,
        context: dto.context,
        ...situation,
      });
      promptVersion = FREEFORM_PROMPT_VERSION;
      kindLabel = "draft_freeform";
    }

    const model = modelDraft();
    const started = Date.now();
    let result;
    let error: string | undefined;
    try {
      result = await invokeModel({
        modelId: model,
        prompt,
        maxTokens: 400,
        temperature: 0.5,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      await AiInteraction.create({
        shopId: user.shopId,
        kind: kindLabel,
        model,
        promptVersion,
        inputTokens: result?.inputTokens,
        outputTokens: result?.outputTokens,
        durationMs: Date.now() - started,
        error,
      }).catch((e) => console.error("[messages/draft] failed to log AiInteraction", e));
    }

    let draft = result!.text.trim();
    if (estimateInput) {
      // The model only wrote the opener; the itemized block, total and
      // "Approve:" line are assembled here so they can't be dropped (QA M1).
      const assembled = assemblePolishedEstimate(estimateInput, draft);
      if (assembled.usedFallback) {
        console.warn("[messages/draft] estimate polish unusable, fell back to template", {
          promptVersion,
          sample: draft.slice(0, 120),
        });
      }
      draft = assembled.sms;
    }

    return ok({
      draft,
      source: "ai" as const,
      promptVersion,
      model,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
