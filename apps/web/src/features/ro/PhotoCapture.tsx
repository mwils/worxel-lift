import { useState } from "react";
import { Button, FileButton, Group, Loader, Text } from "@mantine/core";
import { IconCamera } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";

export interface CapturedPhoto {
  id: string;
  s3Key: string;
  takenAt: string;
  caption: string | null;
}

export interface PhotoCaptureProps {
  repairOrderId: string;
  onUploaded: (photo: CapturedPhoto) => void;
  /** When set, the confirm call attaches the photo to this DVI item. */
  inspectionItemId?: string;
  /** Override the default "Add photo" button label. */
  label?: string;
}

interface PresignResponse {
  uploadUrl: string;
  s3Key: string;
  expiresInSec: number;
}

interface ConfirmResponse {
  photo: CapturedPhoto;
  inspectionItemId?: string | null;
}

export function PhotoCapture({
  repairOrderId,
  onUploaded,
  inspectionItemId,
  label,
}: PhotoCaptureProps) {
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      // 1. Ask the API for a presigned PUT URL.
      const presign = await api.post<PresignResponse>(
        `/repair-orders/${repairOrderId}/photos/presign`,
        { contentType: file.type || "image/jpeg" }
      );

      // 2. PUT the file bytes directly to S3 — no cookies, no JSON wrapper.
      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!putRes.ok) {
        throw new Error("Photo upload didn't go through. Try again.");
      }

      // 3. Tell the API the upload landed; it appends the photo to the RO.
      const confirmed = await api.post<ConfirmResponse>(
        `/repair-orders/${repairOrderId}/photos/confirm`,
        {
          s3Key: presign.s3Key,
          ...(inspectionItemId ? { inspectionItemId } : {}),
        }
      );

      onUploaded(confirmed.photo);
      notifications.show({ color: "green", message: "Photo uploaded" });
    } catch (err) {
      notifyError(err, { title: "Photo upload failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Group gap="sm" align="center">
      <FileButton
        onChange={handleFile}
        accept="image/*"
        // capture="environment" tells mobile browsers to open the rear camera
        // directly rather than the photo library. Desktop browsers fall back
        // to a normal file picker.
        inputProps={{ capture: "environment" }}
        disabled={busy}
      >
        {(props) => (
          <Button {...props} leftSection={<IconCamera size={16} />} variant="default">
            {label ?? "Add photo"}
          </Button>
        )}
      </FileButton>
      {busy && (
        <Group gap={6}>
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Uploading…
          </Text>
        </Group>
      )}
    </Group>
  );
}
