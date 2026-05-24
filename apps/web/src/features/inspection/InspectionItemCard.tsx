import { useEffect, useState } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Image,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconTrash } from "@tabler/icons-react";
import { PhotoCapture, type CapturedPhoto } from "../ro/PhotoCapture";
import { SEVERITY_COLORS, SEVERITY_LABELS, type InspectionItem, type InspectionSeverity } from "./types";

export interface InspectionItemCardProps {
  repairOrderId: string;
  item: InspectionItem;
  photoSrc: (photoId: string) => string | null;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<Pick<InspectionItem, "title" | "severity" | "note">>) => void;
  onReorder: (direction: "up" | "down") => void;
  onDelete: () => void;
  onPhotoAttached: (photo: CapturedPhoto) => void;
}

const SEVERITY_OPTIONS: { value: InspectionSeverity; label: string }[] = [
  { value: "green", label: "Good" },
  { value: "yellow", label: "Watch" },
  { value: "red", label: "Needs work" },
];

export function InspectionItemCard({
  repairOrderId,
  item,
  photoSrc,
  isFirst,
  isLast,
  onChange,
  onReorder,
  onDelete,
  onPhotoAttached,
}: InspectionItemCardProps) {
  // Local state lets the user type without each keystroke firing a network
  // mutation; the parent debounces / saves on blur.
  const [title, setTitle] = useState(item.title);
  const [note, setNote] = useState(item.note ?? "");

  useEffect(() => {
    setTitle(item.title);
  }, [item.title]);
  useEffect(() => {
    setNote(item.note ?? "");
  }, [item.note]);

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <TextInput
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.currentTarget.value)}
          onBlur={() => {
            if (title.trim() && title !== item.title) onChange({ title: title.trim() });
          }}
          placeholder="e.g. Front brake pads at 3mm"
          style={{ flex: 1 }}
        />
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Move up">
            <ActionIcon
              variant="default"
              disabled={isFirst}
              onClick={() => onReorder("up")}
              aria-label="Move up"
            >
              <IconChevronUp size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Move down">
            <ActionIcon
              variant="default"
              disabled={isLast}
              onClick={() => onReorder("down")}
              aria-label="Move down"
            >
              <IconChevronDown size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon variant="default" color="red" onClick={onDelete} aria-label="Delete item">
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      <SegmentedControl
        fullWidth
        size="md"
        value={item.severity}
        onChange={(v) => onChange({ severity: v as InspectionSeverity })}
        data={SEVERITY_OPTIONS.map((o) => ({
          value: o.value,
          label: (
            <Group gap={6} justify="center">
              <Box
                w={10}
                h={10}
                style={{
                  borderRadius: 999,
                  background: `var(--mantine-color-${SEVERITY_COLORS[o.value]}-6)`,
                }}
              />
              <Text size="sm">{o.label}</Text>
            </Group>
          ),
        }))}
      />

      <Textarea
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
        onBlur={() => {
          if (note !== (item.note ?? "")) onChange({ note });
        }}
        placeholder="Plain-English explanation the customer will read"
        autosize
        minRows={2}
        maxLength={500}
      />

      {item.photoIds.length > 0 ? (
        <ScrollArea type="auto" scrollbarSize={6} offsetScrollbars>
          <Group gap="xs" wrap="nowrap" style={{ scrollSnapType: "x mandatory" }}>
            {item.photoIds.map((pid) => {
              const src = photoSrc(pid);
              if (!src) return null;
              return (
                <Image
                  key={pid}
                  src={src}
                  alt="Inspection photo"
                  radius="sm"
                  fit="cover"
                  h={96}
                  w={128}
                  style={{ flex: "0 0 auto", scrollSnapAlign: "start" }}
                  fallbackSrc="https://placehold.co/128x96?text=…"
                />
              );
            })}
          </Group>
        </ScrollArea>
      ) : (
        <Text size="xs" c="dimmed">
          No photos on this item yet.
        </Text>
      )}

      <Group justify="space-between" align="center">
        <Text size="xs" c="dimmed">
          {SEVERITY_LABELS[item.severity]} · {item.photoIds.length} photo
          {item.photoIds.length === 1 ? "" : "s"}
        </Text>
        <PhotoCaptureForItem
          repairOrderId={repairOrderId}
          inspectionItemId={item.id}
          onUploaded={onPhotoAttached}
        />
      </Group>
    </Stack>
  );
}

function PhotoCaptureForItem(props: {
  repairOrderId: string;
  inspectionItemId: string;
  onUploaded: (p: CapturedPhoto) => void;
}) {
  return (
    <PhotoCapture
      repairOrderId={props.repairOrderId}
      inspectionItemId={props.inspectionItemId}
      onUploaded={props.onUploaded}
      label="Add photo to this item"
    />
  );
}

// Re-export so detail.tsx can also Button-trigger the editor easily.
export { Button };
