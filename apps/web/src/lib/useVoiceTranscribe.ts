/**
 * useVoiceTranscribe — reusable hook that captures a voice memo and ships it
 * through `/voice/presign` → S3 PUT → `/voice/transcribe`. The result shape
 * depends on `kind`:
 *   - "customer": { extracted: CustomerExtract, matches: CustomerMatch[] }
 *   - "vehicle":  { extracted: VehicleExtract,  matches: VehicleMatch[]  }
 *   - "concern":  { text: string }
 *
 * Used by VoiceCaptureButton; could also be called directly by a custom
 * UI that wants to render its own recorder.
 */
import { useEffect, useRef, useState } from "react";
import { notifications } from "@mantine/notifications";
import { api } from "./api";
import { notifyError } from "./notify";

export type VoiceKind = "customer" | "vehicle" | "concern";

export interface CustomerExtract {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface CustomerMatch {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  confidence: "exact" | "fuzzy";
}

export interface VehicleExtract {
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  mileage?: number;
  plate?: string;
  color?: string;
  notes?: string;
}

export interface VehicleMatch {
  id: string;
  customerId: string;
  customerName: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  plate: string | null;
  confidence: "exact" | "fuzzy";
}

export type VoiceTranscribeResult =
  | { kind: "customer"; extracted: CustomerExtract; matches: CustomerMatch[] }
  | { kind: "vehicle"; extracted: VehicleExtract; matches: VehicleMatch[] }
  | { kind: "concern"; text: string };

export type Phase = "idle" | "recording" | "uploading" | "transcribing";

interface PresignResponse {
  url: string;
  s3Key: string;
}

export interface UseVoiceTranscribeArgs {
  kind: VoiceKind;
  customerId?: string;
  onResult: (result: VoiceTranscribeResult) => void;
}

function pickRecorderMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export function useVoiceTranscribe({ kind, customerId, onResult }: UseVoiceTranscribeArgs) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }
  function stopStream() {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
  }

  async function start() {
    if (phase !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        void handleStop(recorder.mimeType || mime || "audio/webm");
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      setPhase("recording");
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        notifications.show({
          color: "red",
          title: "Microphone blocked",
          message: "Allow microphone access in your browser to dictate.",
        });
      } else {
        notifyError(err, { title: "Couldn't start the mic" });
      }
      stopStream();
      setPhase("idle");
    }
  }

  function stop() {
    if (phase !== "recording") return;
    stopTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopStream();
      setPhase("idle");
    }
  }

  async function handleStop(blobMime: string) {
    stopStream();
    const blob = new Blob(chunksRef.current, { type: blobMime });
    chunksRef.current = [];
    if (blob.size === 0) {
      notifications.show({ color: "red", message: "Didn't catch anything — try again." });
      setPhase("idle");
      return;
    }

    setPhase("uploading");
    try {
      // Normalize the recorder MIME to the canonical "audio/webm" the presign
      // DTO accepts. Some browsers append a codec parameter; the backend
      // doesn't need it and the regex only checks the audio/ prefix.
      const contentType =
        (blobMime.startsWith("audio/") ? blobMime.split(";")[0] : undefined) ?? "audio/webm";
      const presign = await api.post<PresignResponse>("/voice/presign", { contentType });

      const putRes = await fetch(presign.url, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": contentType },
      });
      if (!putRes.ok) throw new Error("Voice memo didn't upload. Try again.");

      setPhase("transcribing");
      const result = await api.post<any>("/voice/transcribe", {
        s3Key: presign.s3Key,
        kind,
        ...(customerId ? { customerId } : {}),
      });

      if (kind === "concern") {
        onResult({ kind: "concern", text: (result.text as string) ?? "" });
      } else if (kind === "customer") {
        onResult({
          kind: "customer",
          extracted: result.extracted ?? {},
          matches: result.matches ?? [],
        });
      } else {
        onResult({
          kind: "vehicle",
          extracted: result.extracted ?? {},
          matches: result.matches ?? [],
        });
      }
    } catch (err) {
      notifyError(err, { title: "Voice memo failed" });
    } finally {
      setPhase("idle");
      setElapsed(0);
    }
  }

  return { phase, elapsed, start, stop };
}
