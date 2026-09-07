import { Group, Stack, Title, Button, Text, Card, Badge, SimpleGrid, Center, Skeleton, Alert, Anchor } from "@mantine/core";
import { IconPlus, IconCalendarEvent, IconCash, IconMessageCircle } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { readSnapshot, writeSnapshot } from "../../lib/snapshot";
import { formatMoney, formatRoNumber, formatVisit, relativeTime, shopTimezone } from "../../lib/format";
import { RO_STATUS_LABELS, resolveTaxSettings, type RoStatus } from "@lift/shared/constants";
import { useAuth } from "../../lib/auth";
import { StarterLibraryPrompt } from "../../features/jobTemplates/StarterLibraryPrompt";
import { MonthStrip } from "../../features/history/MonthStrip";
import { RecentlyClosed } from "../../features/history/RecentlyClosed";

interface BoardRO {
  id: string;
  number: number;
  status: RoStatus;
  customerName: string;
  vehicleSummary: string;
  total: number;
  paymentStatus?: "unpaid" | "authorized" | "partial" | "paid" | "refunded";
  collectedCents?: number;
  balanceCents?: number;
  updatedAt: string;
  scheduledFor: string | null;
  // Null unless the customer declined the estimate and hasn't since approved.
  estimateDeclinedAt?: string | null;
  estimateDeclineFollowedUpAt?: string | null;
}

const STATUS_BUCKETS: Array<{ status: RoStatus; label: string; color: string }> = [
  { status: "scheduled", label: RO_STATUS_LABELS.scheduled, color: "gray" },
  { status: "in", label: RO_STATUS_LABELS.in, color: "blue" },
  { status: "diagnosing", label: RO_STATUS_LABELS.diagnosing, color: "yellow" },
  { status: "awaiting_parts", label: RO_STATUS_LABELS.awaiting_parts, color: "orange" },
  { status: "in_repair", label: RO_STATUS_LABELS.in_repair, color: "cyan" },
  { status: "ready", label: RO_STATUS_LABELS.ready, color: "green" },
];

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function BoardRoute() {
  const { me } = useAuth();
  const tz = shopTimezone(me?.shop?.timezone);

  // Open statuses only — closed ROs pile up forever and would crowd the
  // 100-row payload out from under the live columns.
  const openStatuses = STATUS_BUCKETS.map((b) => b.status).join(",");
  // Paint the last known board instantly on a fresh page load (PWA launch,
  // tab reopen) while the real fetch runs — TanStack's cache is in-memory, so
  // without this every launch is a "Loading…" round-trip. Keyed by shop.
  const snapshotKey = `board:${me?.shop?.id ?? "none"}`;
  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["ros", "board"],
    queryFn: () => api.get<{ ros: BoardRO[] }>(`/repair-orders?status=${openStatuses}`),
    placeholderData: () => readSnapshot<{ ros: BoardRO[] }>(snapshotKey),
  });
  useEffect(() => {
    if (data && !isPlaceholderData) writeSnapshot(snapshotKey, data);
  }, [data, isPlaceholderData, snapshotKey]);

  // One-time nudge to set a tax rate, once there's at least one RO to be wrong
  // about. Dismissal is per shop, per browser — nothing to store server-side.
  // Shops that chose "No sales tax" on purpose never see it.
  const taxBannerKey = `taxBanner:dismissed:${me?.shop?.id ?? "none"}`;
  const [taxBannerHidden, setTaxBannerHidden] = useState(false);
  const shopTax = resolveTaxSettings(me?.shop?.settings);
  const showTaxBanner =
    !taxBannerHidden &&
    !!me?.shop &&
    shopTax.taxRateBps === 0 &&
    shopTax.taxAppliesTo !== "none" &&
    (data?.ros?.length ?? 0) > 0 &&
    !readDismissed(taxBannerKey);
  function dismissTaxBanner() {
    try {
      localStorage.setItem(taxBannerKey, "1");
    } catch {
      // private mode / storage blocked — hide for this visit anyway
    }
    setTaxBannerHidden(true);
  }

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

  // Declined estimates nobody has texted back about. A silent decline is a
  // lost job unless the owner notices — so it can't hide inside a card.
  const needsReply = (data?.ros ?? []).filter(
    (ro) => ro.estimateDeclinedAt && !ro.estimateDeclineFollowedUpAt
  );

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Today</Title>
        <Button component={Link} to="/ro/new" leftSection={<IconPlus size={16} />}>
          New RO
        </Button>
      </Group>

      <StarterLibraryPrompt />

      {needsReply.length > 0 && (
        <Alert
          color="red"
          variant="light"
          icon={<IconMessageCircle size={18} />}
          title={`${needsReply.length} declined estimate${needsReply.length === 1 ? "" : "s"} need${
            needsReply.length === 1 ? "s" : ""
          } a reply`}
        >
          <Stack gap={2}>
            {needsReply.map((ro) => (
              <Text key={ro.id} size="sm">
                <Anchor component={Link} to={`/ro/${ro.id}`} size="sm" fw={600}>
                  {formatRoNumber(ro.number)}
                </Anchor>{" "}
                · {ro.customerName} · {formatMoney(ro.total)}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      {showTaxBanner && (
        <Alert
          color="yellow"
          variant="light"
          withCloseButton
          onClose={dismissTaxBanner}
          title="Add your sales tax rate so estimates are right"
        >
          Estimates, texts and receipts are pre-tax until you set it.{" "}
          <Anchor component={Link} to="/settings" size="sm">
            Set it in Settings
          </Anchor>
        </Alert>
      )}

      <MonthStrip />

      {isPending ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" aria-busy="true" aria-label="Loading board">
          {STATUS_BUCKETS.map((bucket) => (
            <Stack key={bucket.status} gap="xs">
              <Group justify="space-between">
                <Skeleton height={20} width={96} radius="xl" />
                <Skeleton height={14} width={16} />
              </Group>
              <Skeleton height={84} radius="md" />
            </Stack>
          ))}
        </SimpleGrid>
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
                      <Group gap={6} wrap="nowrap">
                        <DeclinedMark ro={ro} />
                        <PaidMark ro={ro} />
                        <Text size="sm">{formatMoney(ro.total)}</Text>
                      </Group>
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

      {!isPending && <RecentlyClosed />}
    </Stack>
  );
}

/** Customer declined the estimate. Red until the owner texts back, then gray. */
function DeclinedMark({ ro }: { ro: BoardRO }) {
  if (!ro.estimateDeclinedAt) return null;
  return (
    <Badge size="xs" variant="light" color={ro.estimateDeclineFollowedUpAt ? "gray" : "red"}>
      Declined
    </Badge>
  );
}

/**
 * Paid / partial / unpaid at a glance. Quiet until it matters: a paid RO gets
 * a small teal mark; a partial always shows what's still due (money changed
 * hands, the rest is a loose end); an unpaid one only shouts once the car is
 * Ready or already gone.
 */
function PaidMark({ ro }: { ro: BoardRO }) {
  if (ro.total <= 0) return null;
  if (ro.paymentStatus === "paid") {
    return (
      <Badge size="xs" variant="light" color="teal" leftSection={<IconCash size={10} />}>
        Paid
      </Badge>
    );
  }
  const balance = ro.balanceCents ?? ro.total;
  if (ro.paymentStatus === "partial" && balance > 0) {
    return (
      <Badge size="xs" variant="light" color="orange" leftSection={<IconCash size={10} />}>
        Partial · {formatMoney(balance)} due
      </Badge>
    );
  }
  const loud = ro.status === "ready" || ro.status === "picked_up";
  if (!loud || balance <= 0) return null;
  return (
    <Badge size="xs" variant="light" color="orange">
      Unpaid
    </Badge>
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
