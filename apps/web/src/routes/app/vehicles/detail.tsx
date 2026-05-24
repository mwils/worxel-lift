import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Button, Card, Group, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { api } from "../../../lib/api";
import { formatMoney, relativeTime } from "../../../lib/format";
import { VehicleHeader } from "../../../features/vehicle/VehicleHeader";
import { RepairOrderTimelineCard } from "../../../features/vehicle/RepairOrderTimelineCard";

interface LineItemDto {
  id: string;
  kind: "labor" | "part" | "fee";
  description: string;
  hours: number | null;
  rate: number | null;
  qty: number | null;
  unitPrice: number | null;
  total: number;
}

interface RepairOrderDto {
  id: string;
  number: number;
  status: string;
  concern: string | null;
  diagnosis: string | null;
  laborTotal: number;
  partsTotal: number;
  taxTotal: number;
  total: number;
  paymentStatus: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: LineItemDto[];
}

interface VehicleHistoryPage {
  vehicle: {
    id: string;
    customerId: string;
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    engine: string | null;
    mileage: number | null;
    plate: string | null;
    color: string | null;
    notes: string | null;
  };
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
  } | null;
  stats: {
    roCount: number;
    lifetimeSpendCents: number;
    lastServicedAt: string | null;
  };
  repairOrders: RepairOrderDto[];
  nextCursor: string | null;
}

const PAGE_LIMIT = 20;

export function VehicleDetailRoute() {
  const { id } = useParams<{ id: string }>();

  const query = useInfiniteQuery({
    queryKey: ["vehicle-history", id],
    enabled: !!id,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
      if (pageParam) params.set("cursor", pageParam);
      return api.get<VehicleHistoryPage>(`/vehicles/${id}/history?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  if (query.isPending) return <Text c="dimmed">Loading…</Text>;
  const pages = query.data?.pages;
  const first: VehicleHistoryPage | undefined = pages?.[0];
  if (!pages || !first) return <Text c="dimmed">Vehicle not found.</Text>;

  const { vehicle, customer, stats } = first;
  const allRepairOrders = pages.flatMap((p) => p.repairOrders);

  // Chips
  const chips: Array<{ label: string; value: string }> = [
    { label: "Lifetime spend", value: formatMoney(stats.lifetimeSpendCents) },
    { label: "Visits", value: String(stats.roCount) },
    {
      label: "Last service",
      value: stats.lastServicedAt ? relativeTime(stats.lastServicedAt) : "—",
    },
  ];

  return (
    <Stack gap="md">
      <Card withBorder padding="md" radius="md">
        <VehicleHeader vehicle={vehicle} customer={customer} />
      </Card>

      <ScrollArea type="never" offsetScrollbars={false}>
        <Group gap="sm" wrap="nowrap" style={{ minWidth: "max-content" }}>
          {chips.map((c) => (
            <Card key={c.label} withBorder padding="sm" radius="md" style={{ minWidth: 130, flexShrink: 0 }}>
              <Stack gap={2}>
                <Text size="xs" c="dimmed">
                  {c.label}
                </Text>
                <Text fw={700} size="lg">
                  {c.value}
                </Text>
              </Stack>
            </Card>
          ))}
        </Group>
      </ScrollArea>

      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Service history</Title>
          {customer && (
            <Button
              component={Link}
              to={`/ro/new?customerId=${customer.id}&vehicleId=${vehicle.id}`}
              leftSection={<IconPlus size={14} />}
              variant="default"
              size="xs"
            >
              New RO
            </Button>
          )}
        </Group>

        {allRepairOrders.length === 0 ? (
          <Text c="dimmed" size="sm">
            No repair orders yet.
          </Text>
        ) : (
          allRepairOrders.map((r) => <RepairOrderTimelineCard key={r.id} ro={r} />)
        )}

        {query.hasNextPage && (
          <Group justify="center" mt="sm">
            <Button
              variant="default"
              size="sm"
              loading={query.isFetchingNextPage}
              onClick={() => query.fetchNextPage()}
              style={{ minHeight: 44 }}
            >
              Load more
            </Button>
          </Group>
        )}
      </Stack>
    </Stack>
  );
}
