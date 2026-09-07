import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useDebouncedValue, useMediaQuery } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { RO_OPEN_STATUSES, RO_STATUSES, RO_STATUS_LABELS, type RoStatus } from "@lift/shared/constants";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { formatMoney, formatRoNumber, shopTimezone } from "../../lib/format";
import { PaidState } from "../../features/history/PaidState";
import { CLOSED_STATUS_PARAM } from "../../features/history/RecentlyClosed";
import {
  RANGE_LABELS,
  RANGE_PRESETS,
  customRange,
  formatHistoryDate,
  presetRange,
  type RangePreset,
} from "../../features/history/dateRange";

interface HistoryRO {
  id: string;
  number: number;
  status: RoStatus;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehicleSummary: string;
  plate: string | null;
  total: number;
  paymentStatus: string;
  collectedCents: number;
  balanceCents: number;
  date: string;
}
interface Totals {
  count: number;
  revenueCents: number;
  collectedCents: number;
  outstandingCents: number;
}
interface HistoryPage {
  ros: HistoryRO[];
  nextCursor: string | null;
  totals?: Totals;
}

const PAGE_SIZE = 50;

// `status` in the URL is either one of these aliases or a raw RO status.
const STATUS_ALIASES: Record<string, string> = {
  closed: CLOSED_STATUS_PARAM,
  open: RO_OPEN_STATUSES.join(","),
};
// Mantine's Select treats "" as "no value", so each filter's "any" choice
// needs a real sentinel. It never reaches the URL or the API.
const ANY = "__any";
const STATUS_OPTIONS = [
  { value: ANY, label: "Any status" },
  { value: "closed", label: "Closed (picked up, voided, cancelled)" },
  { value: "open", label: "Open (on the board)" },
  ...RO_STATUSES.map((s) => ({ value: s, label: RO_STATUS_LABELS[s] })),
];
const PAID_OPTIONS = [
  { value: ANY, label: "Paid or not" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "unpaid", label: "Unpaid" },
];
const RANGE_OPTIONS = [
  { value: ANY, label: "All time" },
  ...RANGE_PRESETS.map((p) => ({ value: p, label: RANGE_LABELS[p] })),
];

const STATUS_COLORS: Partial<Record<RoStatus, string>> = {
  scheduled: "gray",
  in: "blue",
  diagnosing: "yellow",
  awaiting_parts: "orange",
  in_repair: "cyan",
  ready: "green",
  picked_up: "teal",
  voided: "gray",
  cancelled_by_customer: "red",
};

function isPreset(v: string | null): v is RangePreset {
  return !!v && (RANGE_PRESETS as readonly string[]).includes(v);
}

/**
 * /ros — every RO the shop has written, newest first. Answers "you did my
 * brakes in June, what did I pay?" and "how did I do this month?" without
 * digging through the board or a customer page.
 *
 * Filter state lives in the URL so the board strip / Recently closed / a
 * bookmark can land on a specific view.
 */
export function RosRoute() {
  const { me } = useAuth();
  const tz = shopTimezone(me?.shop?.timezone);
  const isMobile = useMediaQuery("(max-width: 48em)") ?? false;
  const [params, setParams] = useSearchParams();

  const rangeParam = params.get("range");
  const range: RangePreset | "" = isPreset(rangeParam) ? rangeParam : "";
  const statusParam = params.get("status") ?? "";
  const paidParam = params.get("paid") ?? "";
  const qParam = params.get("q") ?? "";
  const customFrom = params.get("from");
  const customTo = params.get("to");

  const [qDraft, setQDraft] = useState(qParam);
  const [debouncedQ] = useDebouncedValue(qDraft.trim(), 250);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  // Custom picks are stored in the URL as YYYY-MM-DD so the link is shareable
  // and re-resolves in the shop's zone on load.
  const customPick: [Date | null, Date | null] = [
    customFrom ? ymdToLocal(customFrom) : null,
    customTo ? ymdToLocal(customTo) : null,
  ];

  const resolved = useMemo(() => {
    if (range === "custom") {
      if (!customPick[0] || !customPick[1]) return null;
      return customRange(customPick[0], customPick[1], tz);
    }
    if (range) return presetRange(range, tz);
    return null;
  }, [range, customFrom, customTo, tz]);

  const apiStatus = STATUS_ALIASES[statusParam] ?? statusParam;
  const queryString = useMemo(() => {
    const p = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (resolved) {
      p.set("from", resolved.from.toISOString());
      p.set("to", resolved.to.toISOString());
    }
    if (apiStatus) p.set("status", apiStatus);
    if (paidParam) p.set("paid", paidParam);
    if (debouncedQ) p.set("q", debouncedQ);
    return p.toString();
  }, [resolved, apiStatus, paidParam, debouncedQ]);

  const query = useInfiniteQuery({
    queryKey: ["ros", "history", queryString],
    queryFn: ({ pageParam }) =>
      api.get<HistoryPage>(
        `/repair-orders/history?${queryString}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const rows = query.data?.pages.flatMap((p) => p.ros) ?? [];
  const totals = query.data?.pages[0]?.totals;
  const filtered = !!(range || statusParam || paidParam || debouncedQ);

  function clearFilters() {
    setQDraft("");
    setParams(new URLSearchParams(), { replace: true });
  }

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <Title order={2}>History</Title>
        {filtered && (
          <Button variant="subtle" size="compact-sm" color="gray" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </Group>

      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder="RO number, customer, plate, or VIN…"
        value={qDraft}
        onChange={(e) => {
          setQDraft(e.currentTarget.value);
          setParam("q", e.currentTarget.value.trim() || null);
        }}
        aria-label="Search repair orders"
      />

      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
        <Select
          aria-label="Date range"
          data={RANGE_OPTIONS}
          value={range || ANY}
          onChange={(v) => {
            const next = new URLSearchParams(params);
            if (v && v !== ANY) next.set("range", v);
            else next.delete("range");
            if (v !== "custom") {
              next.delete("from");
              next.delete("to");
            }
            setParams(next, { replace: true });
          }}
          allowDeselect={false}
        />
        <Select
          aria-label="Status"
          data={STATUS_OPTIONS}
          value={statusParam || ANY}
          onChange={(v) => setParam("status", v === ANY ? null : v)}
          allowDeselect={false}
        />
        <Select
          aria-label="Paid state"
          data={PAID_OPTIONS}
          value={paidParam || ANY}
          onChange={(v) => setParam("paid", v === ANY ? null : v)}
          allowDeselect={false}
        />
      </SimpleGrid>

      {range === "custom" && (
        <DatePickerInput
          type="range"
          aria-label="Custom date range"
          placeholder="Pick first and last day"
          value={customPick}
          onChange={([a, b]) => {
            const next = new URLSearchParams(params);
            if (a) next.set("from", localToYmd(a));
            else next.delete("from");
            if (b) next.set("to", localToYmd(b));
            else next.delete("to");
            setParams(next, { replace: true });
          }}
          valueFormat="MMM D, YYYY"
          maxDate={new Date()}
          popoverProps={{ withinPortal: true }}
          clearable
        />
      )}

      <TotalsRow totals={totals} loading={query.isPending} />

      {query.isPending ? (
        <Text c="dimmed">Loading…</Text>
      ) : query.isError ? (
        <Text c="red">Couldn't load history. Pull to refresh or try again.</Text>
      ) : rows.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Text c="dimmed">{filtered ? "No repair orders match these filters." : "No repair orders yet."}</Text>
            {filtered ? (
              <Button variant="light" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button component={Link} to="/ro/new">
                New RO
              </Button>
            )}
          </Stack>
        </Center>
      ) : isMobile ? (
        <Stack gap="xs">
          {rows.map((ro) => (
            <Card
              key={ro.id}
              component={Link as any}
              to={`/ro/${ro.id}`}
              withBorder
              padding="sm"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text fw={600}>{formatRoNumber(ro.number)}</Text>
                  <Text size="sm" c="dimmed">
                    {formatHistoryDate(ro.date, tz)}
                  </Text>
                </Group>
                <Text fw={600}>{formatMoney(ro.total)}</Text>
              </Group>
              <Text size="sm">{ro.customerName}</Text>
              <Text size="xs" c="dimmed">
                {ro.vehicleSummary}
                {ro.plate ? ` · ${ro.plate}` : ""}
              </Text>
              <Group justify="space-between" mt={6}>
                <StatusBadge status={ro.status} />
                <PaidState total={ro.total} paymentStatus={ro.paymentStatus} balanceCents={ro.balanceCents} />
              </Group>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card withBorder p={0}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>RO #</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th>Vehicle</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="right">Total</Table.Th>
                <Table.Th>Paid</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((ro) => (
                <Table.Tr key={ro.id}>
                  <Table.Td>
                    <Text component={Link} to={`/ro/${ro.id}`} fw={600} size="sm" c="inherit" td="none">
                      {formatRoNumber(ro.number)}
                    </Text>
                  </Table.Td>
                  <Table.Td>{formatHistoryDate(ro.date, tz)}</Table.Td>
                  <Table.Td>
                    <Text component={Link} to={`/customers/${ro.customerId}`} size="sm" c="inherit" td="none">
                      {ro.customerName}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text component={Link} to={`/vehicles/${ro.vehicleId}`} size="sm" c="inherit" td="none">
                      {ro.vehicleSummary}
                    </Text>
                    {ro.plate && (
                      <Text size="xs" c="dimmed">
                        {ro.plate}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={ro.status} />
                  </Table.Td>
                  <Table.Td ta="right">{formatMoney(ro.total)}</Table.Td>
                  <Table.Td>
                    <PaidState total={ro.total} paymentStatus={ro.paymentStatus} balanceCents={ro.balanceCents} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {query.hasNextPage && (
        <Group justify="center">
          <Button
            variant="default"
            loading={query.isFetchingNextPage}
            onClick={() => query.fetchNextPage()}
            style={{ minHeight: 44 }}
          >
            Load more
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function StatusBadge({ status }: { status: RoStatus }) {
  return (
    <Badge size="sm" variant="light" color={STATUS_COLORS[status] ?? "gray"}>
      {RO_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

/** Count / revenue / collected / outstanding for whatever's filtered. */
function TotalsRow({ totals, loading }: { totals: Totals | undefined; loading: boolean }) {
  const cells: Array<{ label: string; value: string; warn?: boolean }> = [
    { label: "Repair orders", value: totals ? String(totals.count) : loading ? "…" : "0" },
    { label: "Revenue", value: totals ? formatMoney(totals.revenueCents) : loading ? "…" : "$0.00" },
    { label: "Collected", value: totals ? formatMoney(totals.collectedCents) : loading ? "…" : "$0.00" },
    {
      label: "Outstanding",
      value: totals ? formatMoney(totals.outstandingCents) : loading ? "…" : "$0.00",
      warn: (totals?.outstandingCents ?? 0) > 0,
    },
  ];
  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
      {cells.map((c) => (
        <Card key={c.label} withBorder padding="sm" radius="md">
          <Text size="xs" c="dimmed">
            {c.label}
          </Text>
          <Text fw={700} size="lg" c={c.warn ? "orange.7" : undefined}>
            {c.value}
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

// YYYY-MM-DD ⇄ browser-local Date for the picker; the shop-zone conversion
// happens in customRange().
function ymdToLocal(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function localToYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
