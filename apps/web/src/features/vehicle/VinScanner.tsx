import { useEffect, useRef, useState } from "react";
import { Alert, Button, Group, Loader, Modal, Stack, Text } from "@mantine/core";

// VIN: 17 chars, alphanumeric, excluding I, O, Q (per the standard).
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/i;

// TypeScript's DOM lib doesn't ship BarcodeDetector types yet across targets.
// We declare the minimum we use.
interface BcdResult {
  rawValue: string;
  format: string;
}
interface BcdInstance {
  detect(src: HTMLVideoElement): Promise<BcdResult[]>;
}
interface BcdCtor {
  new (opts?: { formats?: string[] }): BcdInstance;
  getSupportedFormats(): Promise<string[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: BcdCtor;
  }
}

export function isVinScannerSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export interface VinScannerProps {
  opened: boolean;
  onClose: () => void;
  /** Called with the scanned, validated VIN (17 chars, uppercase). */
  onScan: (vin: string) => void;
}

type Phase = "idle" | "starting" | "scanning" | "unsupported" | "denied" | "error";

export function VinScanner({ opened, onClose, onScan }: VinScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (opened) {
      void start();
    } else {
      stop();
    }
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  async function start() {
    setErrMsg(null);
    setPhase("starting");

    if (!window.BarcodeDetector) {
      setPhase("unsupported");
      return;
    }

    let formats: string[] = [];
    try {
      formats = await window.BarcodeDetector.getSupportedFormats();
    } catch {
      setPhase("unsupported");
      return;
    }
    if (!formats.includes("code_39")) {
      setPhase("unsupported");
      return;
    }

    const detector = new window.BarcodeDetector({ formats: ["code_39"] });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPhase("denied");
      } else {
        setPhase("error");
        setErrMsg((err as Error).message);
      }
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    try {
      await video.play();
    } catch (err) {
      setPhase("error");
      setErrMsg((err as Error).message);
      return;
    }
    setPhase("scanning");

    intervalRef.current = setInterval(async () => {
      const v = videoRef.current;
      if (!v) return;
      try {
        const results = await detector.detect(v);
        for (const r of results) {
          // Some Code 39 readers include leading/trailing '*' markers — strip
          // them defensively, then validate against the VIN format.
          const raw = r.rawValue.replace(/^\*+|\*+$/g, "").toUpperCase();
          if (VIN_REGEX.test(raw)) {
            stop();
            onScan(raw);
            onClose();
            return;
          }
        }
      } catch {
        // Detection errors on dim/blurry frames are normal — retry next tick.
      }
    }, 250);
  }

  function stop() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setPhase("idle");
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Scan VIN" centered size="md">
      <Stack gap="sm">
        {phase === "unsupported" && (
          <Alert color="yellow">
            This browser can't scan barcodes. Type the VIN by hand instead.
          </Alert>
        )}
        {phase === "denied" && (
          <Alert color="yellow">
            Camera blocked. Allow camera access in your browser settings, then try again.
          </Alert>
        )}
        {phase === "error" && (
          <Alert color="red">{errMsg ?? "Couldn't start the camera."}</Alert>
        )}

        {(phase === "starting" || phase === "scanning") && (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: "100%",
              maxHeight: 360,
              background: "#000",
              borderRadius: 8,
              objectFit: "cover",
            }}
          />
        )}

        {phase === "starting" && (
          <Group gap={6} justify="center">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Starting camera…
            </Text>
          </Group>
        )}

        {phase === "scanning" && (
          <Text size="sm" c="dimmed" ta="center">
            Point the camera at the VIN barcode. Usually on the driver-side door jamb sticker.
          </Text>
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
