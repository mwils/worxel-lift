import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ActionIcon,
  Badge,
  Card,
  Center,
  Chip,
  Group,
  Loader,
  Menu,
  Stack,
  Text,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { IconCar, IconClock, IconDotsVertical, IconX } from "@tabler/icons-react";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { formatPhone } from "../../lib/format";
import {
  CATEGORY_LABELS,
  type ServiceRemindersListResponse,
  type ServiceReminderRow,
  type ServiceReminderStatus,
} from "./types";

const DAY_MS = 86_400_000;

function vehicleLabel(v: ServiceReminderRow["vehicle"]): string {
  if (!v) return "Vehicle";
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || (v.plate ? `Plate ${v.plate}` : "Vehicle");
}

function dueLabel(r: ServiceReminderRow): string {
  if (r.status === "sent" && r.sentAt) {
    const days = Math.round((Date.now() - new Date(r.sentAt).getTime()) / DAY_MS);
    if (days <= 0) return "sent today";
    if (days === 1) return "sent yesterday";
    return `sent ${days} days ago`;
  }
  if (r.status === "dismissed" && r.dismissedAt) {
    const days = Math.round((Date.now() - new Date(r.dismissedAt).getTime()) / DAY_MS);
    if (days <= 0) return "dismissed today";
    return `dismissed ${days} day${days === 1 ? "" : "s"} ago`;
  }
  const due = new Date(r.dueAt).getTime();
  const days = Math.round((due - Date.now()) / DAY_MS);
  if (days < 0) return `due ${-days} day${days === -1 ? "" : "s"} ago`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

function customerName(c: ServiceReminderRow["customer"]): string {
  if (!c) return "Customer removed";
  return [c.firstName, c.lastName].filter(Boolean).join(" ");
}

function statusColor(s: ServiceReminderStatus): string {
  switch (s) {
    case "pending":
      return "blue";
    case "sent":
      return "green";
    case "dismissed":
      return "gray";
    case "opted_out":
      return "red";
    case "failed":
      return "orange";
  }
}

export function RemindersList() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ServiceReminderStatus>("pending");

  const { data, isPending } = useQuery({
    queryKey: ["serviceReminders", { status }],
    queryFn: () =>
      api.get<ServiceRemindersListResponse>(`/service-reminders?status=${status}&limit=100`),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["serviceReminders"] });

  const snooze = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/service-reminders/${id}`, {
        status: "pending",
        dueAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: "Snoozed 30 days." });
      invalidate();
    },
    onError: (err) => notifyError(err, { title: "Couldn't snooze" }),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/service-reminders/${id}`, { status: "dismissed" }),
    onSuccess: () => {
      notifications.show({ color: "green", message: "Dismissed." });
      invalidate();
    },
    onError: (err) => notifyError(err, { title: "Couldn't dismiss" }),
  });

  const disableForVehicle = useMutation({
    mutationFn: (r: ServiceReminderRow) =>
      api.post(`/service-reminders/disable-for-vehicle`, {
        vehicleId: r.vehicleId,
        category: r.category,
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: "Disabled for this vehicle." });
      invalidate();
    },
    onError: (err) => notifyError(err, { title: "Couldn't disable reminders" }),
  });

  const reminders = data?.reminders ?? [];

  return (
    <Stack gap="sm">
      <Group gap="xs">
        {(["pending", "sent", "dismissed"] as const).map((s) => (
          <Chip
            key={s}
            checked={status === s}
            onChange={() => setStatus(s)}
            size="sm"
            variant="light"
          >
            {s[0]?.toUpperCase() + s.slice(1)}
          </Chip>
        ))}
      </Group>

      {isPending ? (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      ) : reminders.length === 0 ? (
        <Center py="xl">
          <Text c="dimmed" size="sm">
            {status === "pending"
              ? "No reminders due. Close out an oil change or tire rotation and one will appear here."
              : `No ${status} reminders.`}
          </Text>
        </Center>
      ) : (
        <Stack gap="xs">
          {reminders.map((r) => (
            <Card key={r.id} withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                  <Group gap="xs" wrap="nowrap">
                    <Text
                      component={Link as any}
                      to={`/customers/${r.customerId}`}
                      fw={600}
                      style={{ textDecoration: "none", color: "inherit" }}
                    >
                      {customerName(r.customer)}
                    </Text>
                    {r.customer && (
                      <Text size="xs" c="dimmed">
                        {formatPhone(r.customer.phone)}
                      </Text>
                    )}
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <IconCar size={14} style={{ flexShrink: 0 }} />
                    <Text size="sm" truncate>
                      {vehicleLabel(r.vehicle)} — {CATEGORY_LABELS[r.category]}
                      {r.mileageAtService != null
                        ? ` at ${r.mileageAtService.toLocaleString()} mi`
                        : ""}
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <Badge size="xs" color={statusColor(r.status)} variant="light">
                      {r.status.replace("_", " ")}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {dueLabel(r)}
                    </Text>
                  </Group>
                </Stack>
                {r.status === "pending" && (
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="subtle" aria-label="Reminder actions">
                        <IconDotsVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconClock size={14} />}
                        onClick={() => snooze.mutate(r.id)}
                      >
                        Snooze 30 days
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconX size={14} />}
                        onClick={() => dismiss.mutate(r.id)}
                      >
                        Dismiss
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item color="red" onClick={() => disableForVehicle.mutate(r)}>
                        Disable {CATEGORY_LABELS[r.category].toLowerCase()} for this car
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
