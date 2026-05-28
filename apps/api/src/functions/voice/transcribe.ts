/**
 * POST /voice/transcribe
 *
 * One endpoint, three modes (chosen via `kind`):
 *   - customer: extract { firstName, lastName, phone, email, notes } from a
 *     voice memo, then find existing customers in the shop that match.
 *   - vehicle: extract vehicle fields + find matching vehicles. customerId
 *     in the body scopes the fuzzy "same customer + ymm" match.
 *   - concern: return a single cleaned-up concern sentence. No matching.
 *
 * Bedrock model defaults to BEDROCK_MODEL_DRAFT (Llama 4 Scout via the
 * Converse API). Each call logs an AiInteraction row for cost tracking.
 *
 * Lambda timeout for this route is 30s (set in sst.config.ts — the API
 * Gateway HTTP API integration cap). The transcription poll budget is
 * 26s; ~4s reserved for the Bedrock call.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  AiInteraction,
  VoiceTranscribeDto,
  buildVoiceConcernPrompt,
  buildVoiceCustomerPrompt,
  buildVoiceVehiclePrompt,
  VOICE_CONCERN_PROMPT_VERSION,
  VOICE_CUSTOMER_PROMPT_VERSION,
  VOICE_VEHICLE_PROMPT_VERSION,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, ok, serverError } from "../../lib/response.js";
import { invokeModel, modelDraft } from "../../lib/bedrock.js";
import { runTranscribe } from "../../lib/transcribe.js";
import { matchCustomer } from "../../lib/matchCustomer.js";
import { matchVehicle } from "../../lib/matchVehicle.js";

function tryParseJson<T>(text: string): T | null {
  let body = text.trim();
  if (body.startsWith("```")) {
    body = body.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  // Some models wrap a single JSON object in extra prose despite the prompt —
  // grab the first { ... } block as a last resort.
  if (!body.startsWith("{")) {
    const first = body.indexOf("{");
    const last = body.lastIndexOf("}");
    if (first >= 0 && last > first) body = body.slice(first, last + 1);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const dto = await parseBody(event, VoiceTranscribeDto);

    const expectedPrefix = `shops/${user.shopId}/`;
    if (!dto.s3Key.startsWith(expectedPrefix)) {
      return badRequest("s3Key is not scoped to this shop");
    }

    // 1. Transcribe (or use the test-mode override).
    let transcript = dto.transcript ?? "";
    if (!transcript) {
      try {
        transcript = await runTranscribe(dto.s3Key);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transcription failed";
        return serverError(`Voice transcription failed: ${msg}`);
      }
    }
    if (!transcript) return badRequest("Transcript was empty");

    // 2. Dispatch on kind. Each branch builds its prompt, invokes Bedrock,
    //    logs an AiInteraction row, and returns the kind-specific shape.
    const modelId = modelDraft();
    const startedAt = Date.now();

    if (dto.kind === "concern") {
      const prompt = buildVoiceConcernPrompt({ transcript });
      let invokeResult;
      let error: string | undefined;
      try {
        invokeResult = await invokeModel({
          modelId,
          prompt,
          maxTokens: 200,
          temperature: 0.2,
        });
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        await AiInteraction.create({
          shopId: user.shopId,
          kind: "voice_concern",
          model: modelId,
          promptVersion: VOICE_CONCERN_PROMPT_VERSION,
          durationMs: Date.now() - startedAt,
          error,
        }).catch(() => {});
        return serverError(`AI drafting failed: ${error}`);
      }
      await AiInteraction.create({
        shopId: user.shopId,
        kind: "voice_concern",
        model: modelId,
        promptVersion: VOICE_CONCERN_PROMPT_VERSION,
        inputTokens: invokeResult.inputTokens,
        outputTokens: invokeResult.outputTokens,
        durationMs: Date.now() - startedAt,
      }).catch(() => {});
      return ok({ text: invokeResult.text.trim() });
    }

    // customer | vehicle — both expect JSON.
    const isCustomer = dto.kind === "customer";
    const prompt = isCustomer
      ? buildVoiceCustomerPrompt({ transcript })
      : buildVoiceVehiclePrompt({ transcript });
    const promptVersion = isCustomer ? VOICE_CUSTOMER_PROMPT_VERSION : VOICE_VEHICLE_PROMPT_VERSION;
    const aiKind = isCustomer ? "voice_customer" : "voice_vehicle";

    let invokeResult;
    let error: string | undefined;
    try {
      invokeResult = await invokeModel({
        modelId,
        prompt,
        maxTokens: 500,
        temperature: 0.2,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      await AiInteraction.create({
        shopId: user.shopId,
        kind: aiKind,
        model: modelId,
        promptVersion,
        durationMs: Date.now() - startedAt,
        error,
      }).catch(() => {});
      return serverError(`AI drafting failed: ${error}`);
    }

    const durationMs = Date.now() - startedAt;
    await AiInteraction.create({
      shopId: user.shopId,
      kind: aiKind,
      model: modelId,
      promptVersion,
      inputTokens: invokeResult.inputTokens,
      outputTokens: invokeResult.outputTokens,
      durationMs,
    }).catch(() => {});

    if (isCustomer) {
      const extracted = tryParseJson<{
        firstName?: string;
        lastName?: string;
        phone?: string;
        email?: string;
        notes?: string;
      }>(invokeResult.text) ?? {};
      const matches = await matchCustomer({
        shopId: String(user.shopId),
        firstName: extracted.firstName,
        lastName: extracted.lastName,
        phone: extracted.phone,
        email: extracted.email,
      });
      return ok({ extracted, matches });
    }

    // vehicle
    const extracted = tryParseJson<{
      vin?: string;
      year?: number;
      make?: string;
      model?: string;
      trim?: string;
      mileage?: number;
      plate?: string;
      color?: string;
      notes?: string;
    }>(invokeResult.text) ?? {};
    const matches = await matchVehicle({
      shopId: String(user.shopId),
      customerId: dto.customerId,
      vin: extracted.vin,
      plate: extracted.plate,
      year: extracted.year,
      make: extracted.make,
      model: extracted.model,
    });
    return ok({ extracted, matches });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
