import { Group, Stack, Title, Button, Text, Card, Badge, SimpleGrid, Center } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatMoney, formatRoNumber, relativeTime } from "../../lib/format";
import type { RoStatus } from "@lift/shared/constants";
import { StarterLibraryPrompt } from "../../features/jobTemplates/StarterLibraryPrompt";

interface BoardRO {
  id: string;
  number: number;
  status: RoStatus;
  customerName: string;
  vehicleSummary: string;
  total: number;
  updatedAt: string;
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
  const { data, isPending } = useQuery({
    queryKey: ["ros", "board"],
    queryFn: () => api.get<{ ros: BoardRO[] }>("/repair-orders"),
  });

  const grouped = new Map<RoStatus, BoardRO[]>();
  for (const bucket of STATUS_BUCKETS) grouped.set(bucket.status, []);
  for (const ro of data?.ros ?? []) {
    if (grouped.has(ro.status)) grouped.get(ro.status)!.push(ro);
  }

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
