/**
 * VoiceCaptureButton — reusable mic button for the shop-scoped voice flows
 * (new customer, new vehicle, concern).
 *
 * Visually mirrors `apps/web/src/features/ro/VoiceCapture.tsx` (same mic +
 * state badges + pulse) but wraps the generic `useVoiceTranscribe` hook so
 * the result shape is kind-specific.
 */
import { ActionIcon, Badge, Group, Loader, Stack, Text, Tooltip } from "@mantine/core";
import { IconMicrophone, IconPlayerStopFilled } from "@tabler/icons-react";
import {
  useVoiceTranscribe,
  type VoiceKind,
  type VoiceTranscribeResult,
} from "../../lib/useVoiceTranscribe";

export interface VoiceCaptureButtonProps {
  kind: VoiceKind;
  /** Scopes vehicle-match search when kind === "vehicle". */
  customerId?: string;
  onResult: (result: VoiceTranscribeResult) => void;
  /** Override the idle-state hint text. */
  idleLabel?: string;
  /** Compact mode hides the state hint to save vertical space. */
  compact?: boolean;
}

export function VoiceCaptureButton({
  kind,
  customerId,
  onResult,
  idleLabel,
  compact,
}: VoiceCaptureButtonProps) {
  const { phase, elapsed, start, stop } = useVoiceTranscribe({ kind, customerId, onResult });
  const recording = phase === "recording";
  const busy = phase === "uploading" || phase === "transcribing";
  const defaultIdle =
    kind === "customer"
      ? "Tap to dictate the customer."
      : kind === "vehicle"
        ? "Tap to dictate the vehicle."
        : "Tap to dictate the concern.";

  return (
    <Stack gap="xs">
      <Group gap="sm" align="center">
        <Tooltip label={recording ? "Stop recording" : "Dictate"}>
          <ActionIcon
            size={40}
            radius="xl"
            variant={recording ? "filled" : "light"}
            color={recording ? "red" : "blue"}
            onClick={recording ? stop : start}
            disabled={busy}
            aria-label={recording ? "Stop recording" : "Start recording"}
          >
            {recording ? <IconPlayerStopFilled size={20} /> : <IconMicrophone size={20} />}
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
            <Text size="sm" c="dimmed">
              Uploading…
            </Text>
          </Group>
        )}

        {phase === "transcribing" && (
          <Group gap={6}>
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Listening…
            </Text>
          </Group>
        )}

        {phase === "idle" && !compact && (
          <Text size="sm" c="dimmed">
            {idleLabel ?? defaultIdle}
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
