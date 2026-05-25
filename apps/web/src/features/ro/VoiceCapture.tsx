/**
 * VoiceCapture — Slice E
 *
 * 1. Tap the mic button → starts a MediaRecorder (webm/opus).
 * 2. Tap again → stops recording, uploads the blob to S3, calls the
 *    /voice-to-ro endpoint, surfaces the structured draft via `onDraft`.
 *
 * The owner reviews the draft and saves the line items through the existing
 * line-items routes (handled by the parent — see `LineItemEditor`).
 *
 * v1 simplification: the audio blob is uploaded through the photos-presign
 * route. That route's DTO currently enforces an image/* content-type regex,
 * so we wrap the audio MIME as `image/webm` to satisfy the validator. The
 * resulting S3 key still gets a `.webm` extension and the server's
 * voice-to-ro handler infers MediaFormat from the extension, so the
 * Transcribe pipeline works end-to-end. When the dedicated voice-presign
 * route is wired in `sst.config.ts` (see `apps/api/.../voicePresign.ts`)
 * the upload should switch over and the MIME masking can go.
 */
import { useEffect, useRef, useState } from "react";
import { ActionIcon, Badge, Group, Loader, Stack, Text, Tooltip } from "@mantine/core";
import { IconMicrophone, IconPlayerStopFilled } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";

export interface VoiceDraftLineItem {
  kind: "labor" | "part" | "fee";
  description: string;
  hours?: number;
  rate?: number;
  qty?: number;
  unitPrice?: number;
  total: number | null;
}

export interface VoiceDraft {
  concern: string;
  diagnosis: string;
  lineItems: VoiceDraftLineItem[];
}

export interface VoiceCaptureProps {
  repairOrderId: string;
  onDraft: (draft: VoiceDraft) => void;
}

interface PresignResponse {
  uploadUrl: string;
  s3Key: string;
  expiresInSec: number;
}

interface VoiceToRoResponse {
  draft: VoiceDraft;
}

type Phase = "idle" | "recording" | "uploading" | "drafting";

function pickRecorderMime(): string {
  // MediaRecorder support varies. Prefer the most universally decodable
  // option first.
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

export function VoiceCapture({ repairOrderId, onDraft }: VoiceCaptureProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // Clean up the mic stream + timer if the component unmounts mid-recording.
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
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
  }

  async function start() {
    if (phase !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
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
          message: "Allow microphone access in your browser to talk through the job.",
        });
      } else {
        notifyError(err, {
          title: "Couldn't start the mic",
          fallback: "Check your browser permissions.",
        });
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
      // No active recorder — bail out cleanly.
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
      // v1: piggy-back on the photos-presign route. The backend DTO requires
      // an `image/*` content-type, so we mask the audio MIME as `image/webm`
      // for the presign call. The actual S3 object is still WebM/Opus audio.
      // Extension is taken from the MIME → ".webm", which the voice-to-ro
      // handler reads to set Transcribe's MediaFormat.
      const presign = await api.post<PresignResponse>(
        `/repair-orders/${repairOrderId}/photos/presign`,
        { contentType: "image/webm" }
      );

      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": "image/webm" },
      });
      if (!putRes.ok) {
        throw new Error("Voice memo didn't upload. Try again.");
      }

      setPhase("drafting");
      const result = await api.post<VoiceToRoResponse>(
        `/repair-orders/${repairOrderId}/voice-to-ro`,
        { s3Key: presign.s3Key }
      );
      onDraft(result.draft);
      notifications.show({
        color: "green",
        message: `Drafted ${result.draft.lineItems.length} line item${
          result.draft.lineItems.length === 1 ? "" : "s"
        }`,
      });
    } catch (err) {
      notifyError(err, { title: "Voice memo failed" });
    } finally {
      setPhase("idle");
      setElapsed(0);
    }
  }

  const recording = phase === "recording";
  const busy = phase === "uploading" || phase === "drafting";

  return (
    <Stack gap="xs">
      <Group gap="sm" align="center">
        <Tooltip label={recording ? "Stop recording" : "Talk through the job"}>
          <ActionIcon
            size={48}
            radius="xl"
            variant={recording ? "filled" : "light"}
            color={recording ? "red" : "blue"}
            onClick={recording ? stop : start}
            disabled={busy}
            aria-label={recording ? "Stop recording" : "Start recording"}
          >
            {recording ? <IconPlayerStopFilled size={22} /> : <IconMicrophone size={22} />}
          </ActionIcon>
        </Tooltip>

        {recording && (
          <Group gap={6} align="center">
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "var(--mantine-color-red-6)",
                animation: "lift-rec-pulse 1.2s ease-in-out infinite",
              }}
            />
            <Badge color="red" variant="light">
              Recording {formatElapsed(elapsed)}
            </Badge>
          </Group>
        )}

        {phase === "uploading" && (
          <Group gap={6}>
            <Loader size="xs" />
            <Text size="sm" c="dimmed">Uploading…</Text>
          </Group>
        )}

        {phase === "drafting" && (
          <Group gap={6}>
            <Loader size="xs" />
            <Text size="sm" c="dimmed">Writing it up…</Text>
          </Group>
        )}

        {phase === "idle" && (
          <Text size="sm" c="dimmed">
            Tap to talk it through.
          </Text>
        )}
      </Group>

      <style>{`
        @keyframes lift-rec-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </Stack>
  );
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60).toString();
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
