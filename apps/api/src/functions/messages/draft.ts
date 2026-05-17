import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  AiInteraction,
  Customer,
  DraftMessageDto,
  RepairOrder,
  Shop,
  Vehicle,
  buildEstimatePrompt,
  buildEstimateTemplate,
  buildStatusReplyPrompt,
  buildStatusReplyTemplate,
  type EstimatePromptInput,
  type StatusReplyInput,
  ESTIMATE_PROMPT_VERSION,
  STATUS_REPLY_PROMPT_VERSION,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { invokeClaude, modelDraft } from "../../lib/bedrock.js";

const FREEFORM_PROMPT_VERSION = "freeform.v1";

function buildFreeformPrompt(input: {
  shopName: string;
  customerFirstName: string;
  aiTone: "plain" | "friendly";
  context?: string;
}): string {
  const tone =
    input.aiTone === "friendly"
      ? "Warm, neighborly, first-name basis. At most one emoji."
      : "Plain, matter-of-fact, no emojis.";
  return `
You are drafting a short SMS from a small independent auto shop to a customer.

TONE: ${tone}
SHOP: ${input.shopName}
CUSTOMER FIRST NAME: ${input.customerFirstName}
CONTEXT FROM OWNER: ${input.context?.trim() || "(no extra context — draft a friendly check-in)"}

Rules:
- 1–3 sentences, under 320 chars.
- Address the customer by first name.
- Plain text only, no markdown.
- Do NOT add a signature — the shop name is the sender ID.
- Return ONLY the SMS body. No preamble.
`.trim();
}

function publicEstimateUrl(token: string): string {
  const base = (process.env.WEB_APP_URL ?? "https://app.lift.com").replace(/\/+$/, "");
  return `${base}/public/estimate/${token}`;
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

    if (dto.kind === "estimate") {
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
        approveLinkUrl: publicEstimateUrl(ro.publicToken ?? "PENDING"),
        aiTone,
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
    } else if (statusInput) {
      prompt = buildStatusReplyPrompt(statusInput);
      promptVersion = STATUS_REPLY_PROMPT_VERSION;
      kindLabel =
        dto.kind === "ready_for_pickup" ? "draft_ready_for_pickup" : "draft_status_update";
    } else {
      prompt = buildFreeformPrompt({
        shopName: shop.name,
        customerFirstName: customer.firstName,
        aiTone,
        context: dto.context,
      });
      promptVersion = FREEFORM_PROMPT_VERSION;
      kindLabel = "draft_freeform";
    }

    const model = modelDraft();
    const started = Date.now();
    let result;
    let error: string | undefined;
    try {
      result = await invokeClaude({
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

    return ok({
      draft: result!.text.trim(),
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
