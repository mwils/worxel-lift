import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Anchor, Badge, Button, Card, Center, Divider, Group, Loader, SimpleGrid, Stack, Text } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { RO_STATUS_LABELS, type RoStatus } from "@lift/shared/constants";
import { api } from "../../lib/api";
import { formatMoney, formatRoNumber, relativeTime } from "../../lib/format";
import { PaidState } from "./PaidState";

interface ClosedRO {
  id: string;
  number: number;
  status: RoStatus;
  customerName: string;
  vehicleSummary: string;
  total: number;
  paymentStatus?: string;
  balanceCents?: number;
  updatedAt: string;
}

// Closed = off the board but not out of the books. Muted colors on purpose —
// this strip is a record, not a to-do list.
const CLOSED_STATUSES: Array<{ status: RoStatus; label: string; color: string }> = [
  { status: "picked_up", label: RO_STATUS_LABELS.picked_up, color: "teal" },
  { status: "voided", label: RO_STATUS_LABELS.voided, color: "gray" },
  { status: "cancelled_by_customer", label: RO_STATUS_LABELS.cancelled_by_customer, color: "red" },
];

// Ten is a glance, not an archive. Anything older lives on /ros, which has the
// filters and pagination this accordion never will.
const RECENT_LIMIT = 10;
export const CLOSED_STATUS_PARAM = CLOSED_STATUSES.map((c) => c.status).join(",");

/**
 * Collapsed strip under the board: the last few jobs that left. Fetched only
 * when opened — the board is for today's work, history stays one tap away.
 */
export function RecentlyClosed() {
  const [open, setOpen] = useState(false);
  const closedQ = useQuery({
    queryKey: ["ros", "closed"],
    queryFn: () =>
      api.get<{ ros: ClosedRO[] }>(`/repair-orders?status=${CLOSED_STATUS_PARAM}&limit=${RECENT_LIMIT}`),
    enabled: open,
  });
  const closed = closedQ.data?.ros ?? [];

  return (
    <>
      <Divider mt="sm" />
      <Group justify="center">
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          rightSection={open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        >
          Recently closed
        </Button>
      </Group>
      {open &&
        (closedQ.isPending ? (
          <Center py="sm">
            <Loader size="sm" />
          </Center>
        ) : closed.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center">
            Nothing closed yet.
          </Text>
        ) : (
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {closed.map((ro) => {
                const meta = CLOSED_STATUSES.find((c) => c.status === ro.status);
                return (
                  <Card
                    key={ro.id}
                    component={Link as any}
                    to={`/ro/${ro.id}`}
                    style={{ textDecoration: "none", color: "inherit", opacity: 0.85 }}
                  >
                    <Group justify="space-between">
                      <Text fw={600}>{formatRoNumber(ro.number)}</Text>
                      <Group gap={6} wrap="nowrap">
                        {ro.status === "picked_up" && (
                          <PaidState
                            total={ro.total}
                            paymentStatus={ro.paymentStatus}
                            balanceCents={ro.balanceCents}
                          />
                        )}
                        <Text size="sm">{formatMoney(ro.total)}</Text>
                      </Group>
                    </Group>
                    <Text size="sm">{ro.customerName}</Text>
                    <Group justify="space-between" mt={2}>
                      <Text size="xs" c="dimmed">
                        {ro.vehicleSummary} · {relativeTime(ro.updatedAt)}
                      </Text>
                      <Badge size="sm" variant="light" color={meta?.color ?? "gray"}>
                        {meta?.label ?? RO_STATUS_LABELS[ro.status] ?? ro.status}
                      </Badge>
                    </Group>
                  </Card>
                );
              })}
            </SimpleGrid>
            <Group justify="center">
              <Anchor component={Link} to="/ros?status=closed" size="sm">
                See all →
              </Anchor>
            </Group>
          </Stack>
        ))}
    </>
  );
}
