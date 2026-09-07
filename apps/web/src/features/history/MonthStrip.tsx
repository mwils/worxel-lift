import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Group, Skeleton, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatMoney, shopTimezone } from "../../lib/format";
import { readSnapshot, writeSnapshot } from "../../lib/snapshot";
import { monthLabel, presetRange } from "./dateRange";

interface Totals {
  count: number;
  revenueCents: number;
  collectedCents: number;
  outstandingCents: number;
}
interface HistoryResponse {
  totals?: Totals;
}

/**
 * "This month" at a glance, above the board columns: cars picked up, money in
 * the drawer, money still owed. The whole strip is one tap into /ros with the
 * same filter, so the numbers there match these exactly.
 *
 * Counts picked-up ROs whose completion date falls in the shop's current
 * calendar month. Voided / cancelled work isn't revenue, so it isn't here.
 * Snapshot-cached like the board so a PWA launch paints it instantly.
 */
export function MonthStrip() {
  const { me } = useAuth();
  const tz = shopTimezone(me?.shop?.timezone);
  const range = presetRange("this_month", tz);
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const snapshotKey = `month:${me?.shop?.id ?? "none"}:${fromIso.slice(0, 7)}`;

  const { data, isPending, isPlaceholderData } = useQuery({
    queryKey: ["ros", "history", "month-strip", fromIso],
    queryFn: () =>
      api.get<HistoryResponse>(
        `/repair-orders/history?status=picked_up&from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=1`
      ),
    staleTime: 60_000,
    placeholderData: () => readSnapshot<HistoryResponse>(snapshotKey),
  });
  useEffect(() => {
    if (data && !isPlaceholderData) writeSnapshot(snapshotKey, data);
  }, [data, isPlaceholderData, snapshotKey]);

  const t = data?.totals;
  const cells: Array<{ label: string; value: string }> = [
    { label: "Closed", value: t ? String(t.count) : "—" },
    { label: "Collected", value: t ? formatMoney(t.collectedCents) : "—" },
    { label: "Outstanding", value: t ? formatMoney(t.outstandingCents) : "—" },
  ];

  return (
    <UnstyledButton
      component={Link}
      to="/ros?range=this_month&status=picked_up"
      aria-label={`This month: ${cells.map((c) => `${c.label} ${c.value}`).join(", ")}. See all.`}
      style={{ display: "block" }}
    >
      <Card withBorder padding="sm" radius="md">
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Group gap="lg" wrap="nowrap" style={{ overflowX: "auto" }}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ flexShrink: 0 }}>
              {monthLabel(tz)}
            </Text>
            {cells.map((c) => (
              <Stack key={c.label} gap={0} style={{ flexShrink: 0 }}>
                <Text size="xs" c="dimmed">
                  {c.label}
                </Text>
                {isPending && !t ? (
                  <Skeleton height={20} width={56} mt={2} />
                ) : (
                  <Text
                    fw={700}
                    size="md"
                    c={c.label === "Outstanding" && (t?.outstandingCents ?? 0) > 0 ? "orange.7" : undefined}
                  >
                    {c.value}
                  </Text>
                )}
              </Stack>
            ))}
          </Group>
          <Group gap={2} wrap="nowrap" c="dimmed" style={{ flexShrink: 0 }}>
            <Text size="sm" visibleFrom="xs">
              See all
            </Text>
            <IconChevronRight size={16} />
          </Group>
        </Group>
      </Card>
    </UnstyledButton>
  );
}
