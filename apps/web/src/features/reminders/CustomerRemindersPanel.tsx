import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { IconCar } from "@tabler/icons-react";
import { api } from "../../lib/api";
import {
  CATEGORY_LABELS,
  type ServiceRemindersListResponse,
  type ServiceReminderRow,
} from "./types";

const DAY_MS = 86_400_000;

function vehicleLabel(v: ServiceReminderRow["vehicle"]): string {
  if (!v) return "Vehicle";
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || (v.plate ? `Plate ${v.plate}` : "Vehicle");
}

function dueLabel(due: string): string {
  const days = Math.round((new Date(due).getTime() - Date.now()) / DAY_MS);
  if (days < 0) return `due ${-days}d ago`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days}d`;
}

export function CustomerRemindersPanel({ customerId }: { customerId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["serviceReminders", { customerId, status: "pending" }],
    queryFn: () =>
      api.get<ServiceRemindersListResponse>(
        `/service-reminders?customerId=${customerId}&status=pending&limit=20`
      ),
  });

  if (isPending) return null;
  const reminders = data?.reminders ?? [];
  if (reminders.length === 0) return null;

  return (
    <Stack gap="xs">
      <Title order={4}>Upcoming reminders</Title>
      {reminders.map((r) => (
        <Card key={r.id} withBorder padding="sm">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
              <IconCar size={14} style={{ flexShrink: 0 }} />
              <Text size="sm" truncate>
                {vehicleLabel(r.vehicle)} — {CATEGORY_LABELS[r.category]}
              </Text>
            </Group>
            <Badge size="xs" color="blue" variant="light">
              {dueLabel(r.dueAt)}
            </Badge>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
