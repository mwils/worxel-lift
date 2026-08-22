import { Group, Stack, Title, Button, Text, Card, Badge, SimpleGrid, Center } from "@mantine/core";
import { IconPlus, IconCalendarEvent } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatMoney, formatRoNumber, formatVisit, relativeTime, shopTimezone } from "../../lib/format";
import type { RoStatus } from "@lift/shared/constants";
import { useAuth } from "../../lib/auth";
import { StarterLibraryPrompt } from "../../features/jobTemplates/StarterLibraryPrompt";

interface BoardRO {
  id: string;
  number: number;
  status: RoStatus;
  customerName: string;
  vehicleSummary: string;
  total: number;
  updatedAt: string;
  scheduledFor: string | null;
}

const STATUS_BUCKETS: Array<{ status: RoStatus; label: string; color: string }> = [
  { status: "scheduled", label: "Scheduled", color: "gray" },
  { status: "in", label: "In", color: "blue" },
  { status: "diagnosing", label: "Diagnosing", color: "yellow" },
  { status: "awaiting_parts", label: "Awaiting parts", color: "orange" },
  { status: "in_repair", label: "In repair", color: "cyan" },
  { status: "ready", label: "Ready", color: "green" },
];

export function BoardRoute() {
  const { me } = useAuth();
  const tz = shopTimezone(me?.shop?.timezone);

  const { data, isPending } = useQuery({
    queryKey: ["ros", "board"],
    queryFn: () => api.get<{ ros: BoardRO[] }>("/repair-orders"),
  });

  const grouped = new Map<RoStatus, BoardRO[]>();
  for (const bucket of STATUS_BUCKETS) grouped.set(bucket.status, []);
  for (const ro of data?.ros ?? []) {
    if (grouped.has(ro.status)) grouped.get(ro.status)!.push(ro);
  }

  // Scheduled work reads as a queue, so order it by when the car is due in
  // (soonest first) rather than the API's last-touched order. Undated ROs sink
  // to the bottom — they need a date, not a spot in the run order.
  grouped.get("scheduled")?.sort((a, b) => {
    if (!a.scheduledFor) return b.scheduledFor ? 1 : 0;
    if (!b.scheduledFor) return -1;
    return a.scheduledFor.localeCompare(b.scheduledFor);
  });

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Today</Title>
        <Button component={Link} to="/ro/new" leftSection={<IconPlus size={16} />}>
          New RO
        </Button>
      </Group>

      <StarterLibraryPrompt />

      {isPending ? (
        <Text c="dimmed">Loading…</Text>
      ) : (data?.ros ?? []).length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Text c="dimmed">No repair orders yet — let's create your first one.</Text>
            <Button component={Link} to="/ro/new" leftSection={<IconPlus size={16} />}>
              New RO
            </Button>
          </Stack>
        </Center>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {STATUS_BUCKETS.map((bucket) => {
            const ros = grouped.get(bucket.status) ?? [];
            return (
              <Stack key={bucket.status} gap="xs">
                <Group justify="space-between">
                  <Badge color={bucket.color} variant="light">
                    {bucket.label}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {ros.length}
                  </Text>
                </Group>
                {ros.length === 0 && (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                )}
                {ros.map((ro) => (
                  <Card key={ro.id} component={Link as any} to={`/ro/${ro.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    <Group justify="space-between">
                      <Text fw={600}>{formatRoNumber(ro.number)}</Text>
                      <Text size="sm">{formatMoney(ro.total)}</Text>
                    </Group>
                    <Text size="sm">{ro.customerName}</Text>
                    {ro.status === "scheduled" && <VisitLine ro={ro} tz={tz} />}
                    <Text size="xs" c="dimmed">
                      {ro.vehicleSummary} · {relativeTime(ro.updatedAt)}
                    </Text>
                  </Card>
                ))}
              </Stack>
            );
          })}
        </SimpleGrid>
      )}
    </Stack>
  );
}

/**
 * The visit date on a Scheduled card. This is the one thing the owner needs off
 * a scheduled card — whether the car is due in today, and when.
 *
 * A scheduled RO whose time has already passed is called out: it means either a
 * no-show or a car that arrived and never got moved off Scheduled. Both need
 * the owner's attention, so it can't look the same as an upcoming visit.
 */
function VisitLine({ ro, tz }: { ro: BoardRO; tz: string }) {
  if (!ro.scheduledFor) {
    return (
      <Group gap={4} wrap="nowrap">
        <IconCalendarEvent size={14} opacity={0.5} />
        <Text size="sm" c="dimmed">
          No date set
        </Text>
      </Group>
    );
  }

  const overdue = new Date(ro.scheduledFor).getTime() < Date.now();
  return (
    <Group gap={4} wrap="nowrap">
      <IconCalendarEvent size={14} color={overdue ? "var(--mantine-color-orange-6)" : undefined} />
      <Text size="sm" fw={500} c={overdue ? "orange.7" : undefined}>
        {formatVisit(ro.scheduledFor, tz)}
      </Text>
      {overdue && (
        <Text size="xs" c="orange.7">
          · past due
        </Text>
      )}
    </Group>
  );
}
