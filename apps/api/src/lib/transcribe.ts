/**
 * AWS Transcribe wrapper — sync-style API that starts a transcription job and
 * polls until completion. Shared by /repair-orders/:id/voice-to-ro and the
 * shop-scoped /voice/transcribe endpoint.
 *
 * Lambda timeout on these routes is 30s (API Gateway HTTP API cap), so the
 * poll budget here is 26s, leaving ~4s for the Bedrock call after.
 */
import { randomBytes } from "node:crypto";
import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from "@aws-sdk/client-transcribe";
import { bucket } from "./s3.js";

let _transcribeClient: TranscribeClient | null = null;

function client() {
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

export function mediaFormatFromKey(s3Key: string): string {
  const ext = (s3Key.split(".").pop() ?? "").toLowerCase();
  return MEDIA_FORMAT_BY_EXT[ext] ?? "webm";
}

export async function runTranscribe(s3Key: string): Promise<string> {
  const jobName = `lift-${Date.now()}-${randomBytes(6).toString("hex")}`;
  const mediaUri = `s3://${bucket()}/${s3Key}`;

  await client().send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: "en-US",
      MediaFormat: mediaFormatFromKey(s3Key) as any,
      Media: { MediaFileUri: mediaUri },
    })
  );

  const start = Date.now();
  const budgetMs = 26_000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() - start > budgetMs) {
      throw new Error("Transcription timed out");
    }
    await new Promise((r) => setTimeout(r, 1000));
    const got = await client().send(
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
