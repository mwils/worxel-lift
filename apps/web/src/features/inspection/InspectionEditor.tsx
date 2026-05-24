import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Accordion,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { api } from "../../lib/api";
import type { CapturedPhoto } from "../ro/PhotoCapture";
import { InspectionItemCard } from "./InspectionItemCard";
import {
  SEVERITY_COLORS,
  type InspectionItem,
  type InspectionSeverity,
  type InspectionState,
} from "./types";

export interface InspectionEditorProps {
  repairOrderId: string;
  inspection: InspectionState;
  /** Returns a viewable URL for a photo by its id, if known. */
  photoSrc: (photoId: string) => string | null;
  onPhotoAttached?: (photo: CapturedPhoto) => void;
}

export function InspectionEditor({
  repairOrderId,
  inspection,
  photoSrc,
  onPhotoAttached,
}: InspectionEditorProps) {
  const qc = useQueryClient();

  const items = useMemo(
    () => [...inspection.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [inspection.items]
  );

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["ro", repairOrderId] });
  }

  const createItem = useMutation({
    mutationFn: (severity: InspectionSeverity) =>
      api.post(`/repair-orders/${repairOrderId}/inspection/items`, {
        title: "New inspection item",
        severity,
        photoIds: [],
      }),
    onSuccess: () => invalidate(),
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  const patchItem = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<InspectionItem> }) =>
      api.patch(`/repair-orders/${repairOrderId}/inspection/items/${id}`, patch),
    onSuccess: () => invalidate(),
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) =>
      api.del(`/repair-orders/${repairOrderId}/inspection/items/${id}`),
    onSuccess: () => invalidate(),
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  const [pendingDelete, setPendingDelete] = useState<InspectionItem | null>(null);

  function reorder(item: InspectionItem, direction: "up" | "down") {
    const idx = items.findIndex((i) => i.id === item.id);
    const swapWith = direction === "up" ? items[idx - 1] : items[idx + 1];
    if (!swapWith) return;
    const a = item.order ?? idx;
    const b = swapWith.order ?? (direction === "up" ? idx - 1 : idx + 1);
    patchItem.mutate({ id: item.id, patch: { order: b } });
    patchItem.mutate({ id: swapWith.id, patch: { order: a } });
  }

  const severityCounts = useMemo(() => {
    const counts: Record<InspectionSeverity, number> = { red: 0, yellow: 0, green: 0 };
    for (const it of items) counts[it.severity] = (counts[it.severity] ?? 0) + 1;
    return counts;
  }, [items]);

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Group gap="xs">
          {(["red", "yellow", "green"] as InspectionSeverity[]).map((sev) => (
            <Badge key={sev} variant="light" color={SEVERITY_COLORS[sev]} size="lg">
              {severityCounts[sev]} {sev}
            </Badge>
          ))}
        </Group>
        <Group gap="xs">
          <Button
            size="xs"
            variant="default"
            leftSection={<IconPlus size={14} />}
            onClick={() => createItem.mutate("green")}
            loading={createItem.isPending}
          >
            Add item
          </Button>
        </Group>
      </Group>

      {items.length === 0 ? (
        <Text size="sm" c="dimmed">
          No items yet. Tap "Add item" to start.
        </Text>
      ) : (
        <Accordion multiple variant="separated" defaultValue={items.map((i) => i.id)}>
          {items.map((item, idx) => (
            <Accordion.Item key={item.id} value={item.id}>
              <Accordion.Control>
                <Group gap="sm" wrap="nowrap">
                  <Box
                    w={10}
                    h={10}
                    style={{
                      borderRadius: 999,
                      flex: "0 0 auto",
                      background: `var(--mantine-color-${SEVERITY_COLORS[item.severity]}-6)`,
                    }}
                  />
                  <Text fw={500} lineClamp={1}>
                    {item.title || "Untitled item"}
                  </Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <InspectionItemCard
                  repairOrderId={repairOrderId}
                  item={item}
                  photoSrc={photoSrc}
                  isFirst={idx === 0}
                  isLast={idx === items.length - 1}
                  onChange={(patch) => patchItem.mutate({ id: item.id, patch })}
                  onReorder={(dir) => reorder(item, dir)}
                  onDelete={() => setPendingDelete(item)}
                  onPhotoAttached={(photo) => {
                    onPhotoAttached?.(photo);
                    invalidate();
                  }}
                />
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}

      <Modal
        opened={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="Delete inspection item?"
      >
        <Stack>
          <Text size="sm">
            This removes "{pendingDelete?.title}" from the inspection. Photos stay on the RO.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleteItem.isPending}
              onClick={() => {
                if (pendingDelete) {
                  deleteItem.mutate(pendingDelete.id);
                  setPendingDelete(null);
                }
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
