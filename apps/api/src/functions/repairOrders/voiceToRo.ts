/**
 * POST /repair-orders/:id/voice-to-ro
 *
 * Slice E — Voice-to-RO.
 *
 * Pipeline:
 *   client records audio (webm/opus from MediaRecorder)
 *     → uploads to S3 via a presigned PUT (re-using the /photos/presign route)
 *     → POSTs { s3Key } here
 *     → server runs Amazon Transcribe on the S3 object
 *     → server calls Bedrock (Sonnet) with `buildVoiceToRoPrompt` to structure
 *       the transcript into a draft (concern + diagnosis + line items)
 *     → server returns the draft WITHOUT persisting line items
 *
 * The owner reviews the draft client-side and creates the line items via the
 * existing /line-items endpoints.
 *
 * Transcription strategy decision:
 *   Bedrock's Anthropic Claude models don't accept audio input on Bedrock today,
 *   so we use AWS Transcribe as a separate step. Transcribe is async (StartJob +
 *   poll), and Lambda timeout is 15s, so we keep the poll budget tight (~10s).
 *   For deterministic testing (and as a graceful fallback when a job doesn't
 *   complete in time) the client may pass an explicit `transcript` string —
 *   if present we skip Transcribe entirely.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  AiInteraction,
  RepairOrder,
  Vehicle,
  buildVoiceToRoPrompt,
  VOICE_TO_RO_PROMPT_VERSION,
} from "@lift/shared";
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok, serverError } from "../../lib/response.js";
import { invokeModel, modelDraft } from "../../lib/bedrock.js";
import { bucket } from "../../lib/s3.js";

const VoiceToRoDto = z.object({
  s3Key: z.string().min(1),
  // Optional explicit transcript — bypasses Transcribe when supplied. Used by
  // tests and as a degraded-mode escape hatch.
  transcript: z.string().min(1).optional(),
});

let _transcribeClient: TranscribeClient | null = null;
function transcribe() {
  if (!_transcribeClient) {
    _transcribeClient = new TranscribeClient({
      region: process.env.AWS_REGION ?? "us-east-1",
    });
  }
  return _transcribeClient;
}

const MEDIA_FORMAT_BY_EXT: Record<string, string> = {
  webm: "webm",
  ogg: "ogg",
  mp3: "mp3",
  mp4: "mp4",
  m4a: "mp4",
  wav: "wav",
  flac: "flac",
  amr: "amr",
};

function mediaFormatFromKey(s3Key: string): string {
  const ext = (s3Key.split(".").pop() ?? "").toLowerCase();
  return MEDIA_FORMAT_BY_EXT[ext] ?? "webm";
}

async function runTranscribe(s3Key: string): Promise<string> {
  const jobName = `lift-${Date.now()}-${randomBytes(6).toString("hex")}`;
  const mediaUri = `s3://${bucket()}/${s3Key}`;

  await transcribe().send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: "en-US",
      MediaFormat: mediaFormatFromKey(s3Key) as any,
      Media: { MediaFileUri: mediaUri },
    })
  );

  // Poll with a tight budget — Lambda timeout is 15s; we want to leave enough
  // headroom for the Bedrock call afterward. ~10s max here.
  const start = Date.now();
  const budgetMs = 10_000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - start > budgetMs) {
      throw new Error("Transcription timed out");
    }
    await new Promise((r) => setTimeout(r, 1500));
    const got = await transcribe().send(
      new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
    );
    const status = got.TranscriptionJob?.TranscriptionJobStatus;
    if (status === "COMPLETED") {
      const url = got.TranscriptionJob?.Transcript?.TranscriptFileUri;
      if (!url) throw new Error("Transcription completed without a transcript URL");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch transcript (${res.status})`);
      const body = (await res.json()) as {
        results?: { transcripts?: Array<{ transcript?: string }> };
      };
      const text = body.results?.transcripts?.[0]?.transcript ?? "";
      return text.trim();
    }
    if (status === "FAILED") {
      throw new Error(
        got.TranscriptionJob?.FailureReason ?? "Transcription job failed"
      );
    }
  }
}

function safeParseDraft(text: string): {
  concern: string;
  diagnosis: string;
  lineItems: Array<{
    kind: "labor" | "part" | "fee";
    description: string;
    hours?: number;
    rate?: number;
    qty?: number;
    unitPrice?: number;
    total: number | null;
  }>;
} | null {
  // Strip markdown fences if Claude added them despite instructions.
  let body = text.trim();
  if (body.startsWith("```")) {
    body = body.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  }
  try {
    const parsed = JSON.parse(body);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.concern === "string" &&
      typeof parsed.diagnosis === "string" &&
      Array.isArray(parsed.lineItems)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing repair order id");

    const dto = await parseBody(event, VoiceToRoDto);

    // Verify RO + shop ownership.
    const ro = await RepairOrder.findOne({ _id: id, shopId: user.shopId }).lean();
    if (!ro) return notFound("Repair order not found");

    // Validate s3Key is shop-scoped + RO-scoped. Photos presign produces keys
    // of the form `shops/<shopId>/ros/<roId>/...` — voice uploads reuse that
    // endpoint, so the prefix check is the same.
    const expectedPrefix = `shops/${user.shopId}/ros/${id}/`;
    if (!dto.s3Key.startsWith(expectedPrefix)) {
      return badRequest("s3Key is not scoped to this repair order");
    }

    const vehicle = await Vehicle.findOne({
      _id: ro.vehicleId,
      shopId: user.shopId,
    }).lean();

    // Step 1 — get the transcript. Honour the client-supplied transcript if
    // present (test / degraded mode); otherwise run AWS Transcribe.
    let transcript = dto.transcript ?? "";
    if (!transcript) {
      try {
        transcript = await runTranscribe(dto.s3Key);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transcription failed";
        return serverError(`Voice transcription failed: ${msg}`);
      }
    }
    if (!transcript) {
      return badRequest("Transcript was empty");
    }

    // Step 2 — structure with Bedrock Sonnet.
    const prompt = buildVoiceToRoPrompt({
      transcript,
      vehicle: vehicle
        ? {
            year: vehicle.year ?? undefined,
            make: vehicle.make ?? undefined,
            model: vehicle.model ?? undefined,
          }
        : undefined,
    });

    const modelId = modelDraft();
    const startedAt = Date.now();
    let bedrockResult;
    try {
      bedrockResult = await invokeModel({
        modelId,
        prompt,
        maxTokens: 1024,
        temperature: 0.2,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bedrock error";
      await AiInteraction.create({
        shopId: user.shopId,
        kind: "voice_to_ro",
        model: modelId,
        promptVersion: VOICE_TO_RO_PROMPT_VERSION,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      return serverError(`AI drafting failed: ${message}`);
    }
    const durationMs = Date.now() - startedAt;

    const draft = safeParseDraft(bedrockResult.text);
    if (!draft) {
      await AiInteraction.create({
        shopId: user.shopId,
        kind: "voice_to_ro",
        model: modelId,
        promptVersion: VOICE_TO_RO_PROMPT_VERSION,
        inputTokens: bedrockResult.inputTokens,
        outputTokens: bedrockResult.outputTokens,
        durationMs,
        error: "Could not parse Bedrock JSON response",
      });
      return serverError("AI returned an unparseable draft");
    }

    await AiInteraction.create({
      shopId: user.shopId,
      kind: "voice_to_ro",
      model: modelId,
      promptVersion: VOICE_TO_RO_PROMPT_VERSION,
      inputTokens: bedrockResult.inputTokens,
      outputTokens: bedrockResult.outputTokens,
      durationMs,
    });

    // Sanitize: drop unknown line-item kinds and coerce numbers. We do NOT
    // persist these — the owner reviews and saves via the line-items routes.
    const sanitizedLineItems = draft.lineItems
      .filter(
        (li) =>
          li &&
          (li.kind === "labor" || li.kind === "part" || li.kind === "fee") &&
          typeof li.description === "string" &&
          li.description.length > 0
      )
      .map((li) => ({
        kind: li.kind,
        description: li.description,
        hours: typeof li.hours === "number" ? li.hours : undefined,
        rate: typeof li.rate === "number" ? li.rate : undefined,
        qty: typeof li.qty === "number" ? li.qty : undefined,
        unitPrice: typeof li.unitPrice === "number" ? li.unitPrice : undefined,
        total: typeof li.total === "number" ? li.total : null,
      }));

    return ok({
      draft: {
        concern: draft.concern,
        diagnosis: draft.diagnosis,
        lineItems: sanitizedLineItems,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
