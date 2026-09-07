import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Checkbox,
  Chip,
  Group,
  Loader,
  Menu,
  Select,
  Stack,
  Text,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { IconCar, IconClock, IconDotsVertical, IconX } from "@tabler/icons-react";
import {
  SERVICE_REMINDER_STATUS_LABELS,
  type ServiceReminderStatus,
} from "@lift/shared/constants";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { formatPhone, shopTimezone } from "../../lib/format";
import { useAuth } from "../../lib/auth";
import { customRange, presetRange } from "../history/dateRange";
import {
  CATEGORY_LABELS,
  DUE_RANGES,
  DUE_RANGE_LABELS,
  type DueRange,
  type ServiceRemindersListResponse,
  type ServiceReminderRow,
} from "./types";

const DAY_MS = 86_400_000;
const PAGE_SIZE = 30;
/** Matches BulkDismissServiceRemindersDto's cap. */
const BULK_MAX = 200;
const ANY_RANGE = "__any__";

/** Chips that are always offered; the rest appear only when they have rows. */
const PRIMARY_STATUSES: ServiceReminderStatus[] = ["pending", "sent", "dismissed"];
const SECONDARY_STATUSES: ServiceReminderStatus[] = ["opted_out", "failed"];

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

const RANGE_OPTIONS = [
  { value: ANY_RANGE, label: "Any due date" },
  ...DUE_RANGES.map((r) => ({ value: r, label: DUE_RANGE_LABELS[r] })),
];

type Page = ServiceRemindersListResponse;

export function RemindersList() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const tz = shopTimezone(me?.shop?.timezone);

  const [status, setStatus] = useState<ServiceReminderStatus>("pending");
  const [range, setRange] = useState<DueRange | "">("");
  const [customPick, setCustomPick] = useState<[Date | null, Date | null]>([null, null]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Resolved in the SHOP's timezone — "due this week" for a shop in Phoenix is
  // Phoenix's week. "Overdue" is anything before today started there.
  const dueWindow = useMemo(() => {
    if (range === "overdue") return { from: null, to: presetRange("today", tz).from };
    if (range === "this_week") return presetRange("this_week", tz);
    if (range === "this_month") return presetRange("this_month", tz);
    if (range === "custom") {
      if (!customPick[0] || !customPick[1]) return null;
      return customRange(customPick[0], customPick[1], tz);
    }
    return null;
  }, [range, customPick, tz]);

  const queryString = useMemo(() => {
    const p = new URLSearchParams({ status, limit: String(PAGE_SIZE) });
    if (dueWindow?.from) p.set("from", dueWindow.from.toISOString());
    if (dueWindow?.to) p.set("to", dueWindow.to.toISOString());
    return p.toString();
  }, [status, dueWindow]);

  const listKey = ["serviceReminders", "list", queryString] as const;

  const query = useInfiniteQuery({
    queryKey: listKey,
    queryFn: ({ pageParam }) =>
      api.get<Page>(
        `/service-reminders?${queryString}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : null),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["serviceReminders"] });

  const reminders = query.data?.pages.flatMap((p) => p.reminders) ?? [];
  const counts = query.data?.pages[0]?.counts ?? null;

  /** Drop rows from the cached pages so a dismiss doesn't wait on the refetch. */
  function dropFromCache(ids: string[]) {
    const gone = new Set(ids);
    qc.setQueryData<InfiniteData<Page, string | null>>(listKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((p, i) => {
          const nextCounts = i === 0 && p.counts ? { ...p.counts } : p.counts;
          if (nextCounts && i === 0) {
            nextCounts[status] = Math.max(0, nextCounts[status] - ids.length);
            nextCounts.dismissed = nextCounts.dismissed + ids.length;
          }
          return {
            ...p,
            reminders: p.reminders.filter((r) => !gone.has(r.id)),
            counts: nextCounts,
          };
        }),
      };
    });
  }

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
    mutationFn: (id: string) => api.patch(`/service-reminders/${id}`, { status: "dismissed" }),
    onMutate: (id) => dropFromCache([id]),
    onSuccess: () => notifications.show({ color: "green", message: "Dismissed." }),
    onError: (err) => notifyError(err, { title: "Couldn't dismiss" }),
    onSettled: () => invalidate(),
  });

  const bulkDismiss = useMutation({
    mutationFn: (ids: string[]) =>
      api.post<{ dismissed: number }>("/service-reminders/bulk-dismiss", { ids }),
    onMutate: (ids) => {
      dropFromCache(ids);
      setSelected(new Set());
    },
    onSuccess: (res, ids) => {
      const n = res?.dismissed ?? ids.length;
      notifications.show({
        color: "green",
        message: `Dismissed ${n} reminder${n === 1 ? "" : "s"}.`,
      });
    },
    onError: (err) => notifyError(err, { title: "Couldn't dismiss those" }),
    onSettled: () => invalidate(),
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

  // Dismissed rows have nowhere left to go, so selection is off in that lens.
  const selectable = status !== "dismissed";
  const pageIds = reminders.map((r) => r.id);
  const selectedOnPage = pageIds.filter((id) => selected.has(id));
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < BULK_MAX) next.add(id);
      return next;
    });
  }

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const id of pageIds) next.delete(id);
      } else {
        for (const id of pageIds) {
          if (next.size >= BULK_MAX) break;
          next.add(id);
        }
      }
      return next;
    });
  }

  function chipLabel(s: ServiceReminderStatus): string {
    const label = SERVICE_REMINDER_STATUS_LABELS[s];
    const n = counts?.[s];
    return n ? `${label} (${n})` : label;
  }

  const visibleStatuses = [
    ...PRIMARY_STATUSES,
    ...SECONDARY_STATUSES.filter((s) => s === status || (counts?.[s] ?? 0) > 0),
  ];

  const filtered = !!range;

  let emptyText: string;
  if (filtered) emptyText = "No reminders in that window.";
  else if (status === "pending")
    emptyText =
      "No reminders due. Close out an oil change or tire rotation and one will appear here.";
  else emptyText = `No ${SERVICE_REMINDER_STATUS_LABELS[status].toLowerCase()} reminders.`;

  return (
    <Stack gap="sm">
      <Group gap="xs">
        {visibleStatuses.map((s) => (
          <Chip
            key={s}
            checked={status === s}
            onChange={() => {
              setStatus(s);
              setSelected(new Set());
            }}
            size="sm"
            variant="light"
          >
            {chipLabel(s)}
          </Chip>
        ))}
      </Group>

      <Select
        aria-label="Due date"
        data={RANGE_OPTIONS}
        value={range || ANY_RANGE}
        onChange={(v) => {
          setRange(v && v !== ANY_RANGE ? (v as DueRange) : "");
          if (v !== "custom") setCustomPick([null, null]);
          setSelected(new Set());
        }}
        allowDeselect={false}
      />

      {range === "custom" && (
        <DatePickerInput
          type="range"
          aria-label="Custom due-date range"
          placeholder="Pick first and last day"
          value={customPick}
          onChange={([a, b]) => setCustomPick([a, b])}
          valueFormat="MMM D, YYYY"
          popoverProps={{ withinPortal: true }}
          clearable
        />
      )}

      {selectable && reminders.length > 0 && (
        <Group justify="space-between" wrap="nowrap">
          <Checkbox
            size="sm"
            checked={allOnPageSelected}
            indeterminate={selectedOnPage.length > 0 && !allOnPageSelected}
            onChange={toggleAllOnPage}
            label="Select all on this page"
          />
          {selected.size > 0 && (
            <Group gap="xs" wrap="nowrap">
              <Button variant="subtle" size="compact-sm" color="gray" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
              <Button
                size="compact-sm"
                leftSection={<IconX size={14} />}
                loading={bulkDismiss.isPending}
                onClick={() => bulkDismiss.mutate(Array.from(selected))}
              >
                Dismiss {selected.size}
              </Button>
            </Group>
          )}
        </Group>
      )}

      {query.isPending ? (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      ) : query.isError ? (
        <Text c="red" size="sm">
          Couldn't load reminders. Try again in a second.
        </Text>
      ) : reminders.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Text c="dimmed" size="sm" ta="center">
              {emptyText}
            </Text>
            {filtered && (
              <Button variant="subtle" size="xs" onClick={() => setRange("")}>
                Clear date filter
              </Button>
            )}
          </Stack>
        </Center>
      ) : (
        <Stack gap="xs">
          {reminders.map((r) => (
            <Card key={r.id} withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0, flex: 1 }}>
                  {selectable && (
                    <Checkbox
                      size="sm"
                      mt={2}
                      checked={selected.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      aria-label={`Select reminder for ${customerName(r.customer)}`}
                    />
                  )}
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
                        {SERVICE_REMINDER_STATUS_LABELS[r.status]}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {dueLabel(r)}
                      </Text>
                    </Group>
                  </Stack>
                </Group>
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

          {query.hasNextPage && (
            <Center pt="xs">
              <Button
                variant="default"
                onClick={() => query.fetchNextPage()}
                loading={query.isFetchingNextPage}
              >
                Load more
              </Button>
            </Center>
          )}
        </Stack>
      )}
    </Stack>
  );
}
