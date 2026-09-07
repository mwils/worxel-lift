import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconArchive,
  IconArchiveOff,
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconPencil,
  IconPhone,
  IconPlus,
  IconRefresh,
  IconSend,
  IconUsers,
} from "@tabler/icons-react";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { notifyError } from "../../../lib/notify";
import { MergeCustomerModal } from "../../../features/customer/MergeCustomerModal";
import { formatMoney, formatPhone, formatRoNumber, relativeTime } from "../../../lib/format";
import { VehicleForm } from "../../../features/vehicle/VehicleForm";
import { VehicleCard } from "../../../features/vehicle/VehicleCard";
import { CustomerForm } from "../../../features/customer/CustomerForm";
import { CustomerStatsStrip } from "../../../features/customer/CustomerStatsStrip";
import { TextHistoryLinkModal } from "../../../features/customer/TextHistoryLinkModal";
import { CustomerRemindersPanel } from "../../../features/reminders/CustomerRemindersPanel";
import type { z } from "zod";
import type { CreateVehicleDto } from "@lift/shared/dto";
import type { CreateCustomerInput } from "@lift/shared/dto";
import { RO_STATUS_LABELS } from "@lift/shared/constants";

/** Activity and messages default to this window; "Show older" drops it. */
const HISTORY_WINDOW_MONTHS = 12;
const ACTIVITY_PAGE = 10;
const MESSAGE_PAGE = 20;

interface CustomerHistory {
  redirectedFrom: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
    notes: string | null;
    taxExempt?: boolean;
    smsOptInAt: string | null;
    smsOptOutAt: string | null;
    createdAt: string;
    aliases?: Array<{
      firstName: string;
      lastName: string | null;
      phone: string;
      mergedAt: string;
    }>;
  };
  possibleDuplicate: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
  } | null;
  stats: {
    vehicleCount: number;
    roCount: number;
    lifetimeSpendCents: number;
    lifetimeBilledCents: number;
    firstVisitAt: string | null;
    lastVisitAt: string | null;
  };
  vehicles: VehicleRow[];
  archivedVehicles: VehicleRow[];
  hasMoreActivity: boolean;
  nextActivityCursor: string | null;
  recentRepairOrders: Array<{
    id: string;
    number: number;
    status: string;
    concern: string | null;
    total: number;
    vehicleId: string;
    paymentStatus: string;
    balanceCents?: number;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
  }>;
}

interface VehicleRow {
  id: string;
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
  archivedAt: string | null;
  roCount: number;
  lastServicedAt: string | null;
  lastConcern: string | null;
  lifetimeSpendCents: number;
}

type ActivityRow = CustomerHistory["recentRepairOrders"][number];

interface ThreadMessage {
  id: string;
  direction: "in" | "out";
  kind?: "sms" | "system";
  body: string;
  sentAt: string;
  aiDrafted: boolean;
  autoReplied: boolean;
  automated?: boolean;
  deliveryStatus?: "sent" | "delivered" | "failed" | null;
}

interface ConversationPage {
  messages: ThreadMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

/** Newest-first rows split into year buckets, newest year first. */
function groupByYear<T>(rows: T[], dateOf: (row: T) => string): Array<{ year: number; rows: T[] }> {
  const out: Array<{ year: number; rows: T[] }> = [];
  for (const row of rows) {
    const year = new Date(dateOf(row)).getFullYear();
    const last = out[out.length - 1];
    if (last && last.year === year) last.rows.push(row);
    else out.push({ year, rows: [row] });
  }
  return out;
}

type VehicleInput = z.infer<typeof CreateVehicleDto>;

export function CustomerDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { me } = useAuth();
  const [vehicleModal, vehicleModalCtl] = useDisclosure(false);
  const [editModal, editModalCtl] = useDisclosure(false);
  const [messagesOpen, messagesCtl] = useDisclosure(false);
  const [mergeModal, mergeModalCtl] = useDisclosure(false);
  const [archivedOpen, archivedCtl] = useDisclosure(false);
  const [historyLinkModal, historyLinkModalCtl] = useDisclosure(false);

  // Floor for the default window. Stable for the life of the page so paging
  // can't drift onto a different boundary mid-scroll.
  const since = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - HISTORY_WINDOW_MONTHS);
    return d.toISOString();
  }, []);

  // Activity: head page from the query, older pages appended locally (same
  // shape as the conversation view).
  const [activityAll, setActivityAll] = useState(false);
  const [olderActivity, setOlderActivity] = useState<ActivityRow[]>([]);
  const [activityCursor, setActivityCursor] = useState<string | null>(null);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);

  const [messagesAll, setMessagesAll] = useState(false);
  const [olderMessages, setOlderMessages] = useState<ThreadMessage[]>([]);
  const [messageCursor, setMessageCursor] = useState<string | null>(null);
  const [messagesHaveMore, setMessagesHaveMore] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["customer-history", id, activityAll],
    queryFn: async () => {
      const res = await api.get<CustomerHistory>(
        `/customers/${id}/history?limit=${ACTIVITY_PAGE}` +
          (activityAll ? "" : `&since=${encodeURIComponent(since)}`)
      );
      setOlderActivity([]);
      setActivityCursor(res.nextActivityCursor);
      setActivityHasMore(res.hasMoreActivity);
      return res;
    },
    enabled: !!id,
  });

  const messagesQ = useQuery({
    queryKey: ["customer-messages", id, messagesAll],
    queryFn: async () => {
      const res = await api.get<ConversationPage>(
        `/messages/conversation/${id}?limit=${MESSAGE_PAGE}` +
          (messagesAll ? "" : `&since=${encodeURIComponent(since)}`)
      );
      setOlderMessages([]);
      setMessageCursor(res.nextCursor);
      setMessagesHaveMore(res.hasMore);
      // The endpoint answers oldest-first within a page; this page reads newest-first.
      return { ...res, messages: [...res.messages].reverse() };
    },
    enabled: !!id,
  });

  // An old link to a merged-away duplicate resolves to the survivor — put the
  // survivor's id in the URL so refreshes and shares land in the right place.
  useEffect(() => {
    if (data?.redirectedFrom && data.customer.id !== id) {
      navigate(`/customers/${data.customer.id}`, { replace: true });
    }
  }, [data?.redirectedFrom, data?.customer.id, id, navigate]);

  async function loadOlderActivity() {
    if (!activityCursor) return;
    setLoadingActivity(true);
    try {
      const res = await api.get<CustomerHistory>(
        `/customers/${id}/history?limit=${ACTIVITY_PAGE}&cursor=${activityCursor}` +
          (activityAll ? "" : `&since=${encodeURIComponent(since)}`)
      );
      setOlderActivity((prev) => [...prev, ...res.recentRepairOrders]);
      setActivityCursor(res.nextActivityCursor);
      setActivityHasMore(res.hasMoreActivity);
    } catch (err) {
      notifyError(err, { title: "Couldn't load older jobs" });
    } finally {
      setLoadingActivity(false);
    }
  }

  async function loadOlderMessages() {
    if (!messageCursor) return;
    setLoadingMessages(true);
    try {
      const res = await api.get<ConversationPage>(
        `/messages/conversation/${id}?limit=${MESSAGE_PAGE}&cursor=${encodeURIComponent(messageCursor)}` +
          (messagesAll ? "" : `&since=${encodeURIComponent(since)}`)
      );
      setOlderMessages((prev) => [...prev, ...[...res.messages].reverse()]);
      setMessageCursor(res.nextCursor);
      setMessagesHaveMore(res.hasMore);
    } catch (err) {
      notifyError(err, { title: "Couldn't load older texts" });
    } finally {
      setLoadingMessages(false);
    }
  }

  const setVehicleArchived = useMutation({
    mutationFn: ({ vehicleId, archived }: { vehicleId: string; archived: boolean }) =>
      api.post(`/vehicles/${vehicleId}/${archived ? "archive" : "unarchive"}`),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["customer-history", id] });
      qc.invalidateQueries({ queryKey: ["customer", id] });
      qc.invalidateQueries({ queryKey: ["service-reminders"] });
      notifications.show({
        color: "green",
        message: vars.archived
          ? "Archived. It's off the pick lists and won't get reminders."
          : "Back on the pick lists.",
      });
    },
    onError: (err) => notifyError(err, { title: "Couldn't change that vehicle" }),
  });

  const clearDuplicateFlag = useMutation({
    mutationFn: () => api.patch(`/customers/${id}`, { possibleDuplicateOf: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customer-history", id] }),
    onError: (err) => notifyError(err, { title: "Couldn't clear that" }),
  });

  const addVehicle = useMutation({
    mutationFn: (values: VehicleInput) => api.post("/vehicles", values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-history", id] });
      notifications.show({ color: "green", message: "Vehicle added" });
      vehicleModalCtl.close();
    },
    onError: (err) => notifyError(err, { title: "Couldn't add vehicle" }),
  });

  const updateCustomer = useMutation({
    // CustomerForm strips cleared optionals to undefined, which PATCH would
    // ignore — null tells the API to actually clear the field.
    mutationFn: (values: CreateCustomerInput) =>
      api.patch(`/customers/${id}`, {
        ...values,
        lastName: values.lastName ?? null,
        email: values.email ?? null,
        notes: values.notes ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-history", id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      notifications.show({ color: "green", message: "Customer updated" });
      editModalCtl.close();
    },
    onError: (err) => notifyError(err, { title: "Couldn't save changes" }),
  });

  // Kills every history link already texted to this customer and mints a new
  // one — for a phone that changed hands, or a customer who asks.
  const rotateHistoryLink = useMutation({
    mutationFn: () => api.post(`/customers/${id}/history-link`, { rotate: true }),
    onSuccess: () => {
      notifications.show({
        color: "green",
        message: "New history link made. The old one no longer works — text them the new one.",
      });
    },
    onError: (err) => notifyError(err, { title: "Couldn't rotate the link" }),
  });

  if (isPending) return <Text c="dimmed">Loading…</Text>;
  if (!data)
    return (
      <Stack align="center">
        <Text>Can't find that customer.</Text>
        <Button component={Link} to="/app/customers" variant="light">
          Back to customers
        </Button>
      </Stack>
    );

  const { customer, stats, vehicles, archivedVehicles, recentRepairOrders, possibleDuplicate } =
    data;
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
  const activity = [...recentRepairOrders, ...olderActivity];
  const activityYears = groupByYear(activity, (r) => r.createdAt);
  const messages = [...(messagesQ.data?.messages ?? []), ...olderMessages];
  const messageYears = groupByYear(messages, (m) => m.sentAt);
  const aliases = customer.aliases ?? [];

  // Quick lookup from vehicleId → human label so the RO timeline can show
  // which car each visit was for. O(vehicles) build, O(1) reads — fine at
  // 1–3 bay shop scale.
  const vehicleLabels = new Map<string, string>();
  for (const v of vehicles) {
    vehicleLabels.set(
      v.id,
      [v.year, v.make, v.model].filter(Boolean).join(" ") || (v.plate ? `Plate ${v.plate}` : "Vehicle")
    );
  }

  return (
    <Stack gap="md">
      {/* Header card */}
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Title order={2}>{fullName}</Title>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                aria-label="Edit customer"
                onClick={editModalCtl.open}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <ActionIcon
                component="a"
                href={`tel:${customer.phone}`}
                variant="subtle"
                size="md"
                aria-label="Call customer"
              >
                <IconPhone size={16} />
              </ActionIcon>
              <Text
                component="a"
                href={`tel:${customer.phone}`}
                c="blue"
                size="sm"
                style={{ textDecoration: "none" }}
              >
                {formatPhone(customer.phone)}
              </Text>
              {customer.email && (
                <Text c="dimmed" size="sm" truncate>
                  · {customer.email}
                </Text>
              )}
            </Group>
            {customer.smsOptOutAt && (
              <Badge size="xs" color="red" variant="light">
                SMS opted out
              </Badge>
            )}
            {customer.taxExempt && (
              <Badge size="xs" color="gray" variant="light">
                Tax exempt
              </Badge>
            )}
          </Stack>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <Button
              variant="default"
              leftSection={<IconSend size={16} />}
              style={{ minHeight: 44 }}
              onClick={historyLinkModalCtl.open}
            >
              Text history link
            </Button>
            <Button
              component={Link}
              to={`/ro/new?customerId=${customer.id}`}
              leftSection={<IconPlus size={16} />}
              style={{ minHeight: 44 }}
            >
              New RO
            </Button>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label="More customer actions"
                >
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconRefresh size={14} />}
                  disabled={rotateHistoryLink.isPending}
                  onClick={() => rotateHistoryLink.mutate()}
                >
                  Rotate history link
                </Menu.Item>
                {/* Rare and irreversible — a menu item, not a button. */}
                <Menu.Item leftSection={<IconUsers size={14} />} onClick={mergeModalCtl.open}>
                  Merge a duplicate in
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {customer.notes && (
          <Box mt="sm">
            <Text size="xs" c="dimmed">
              Notes
            </Text>
            <Text size="sm">{customer.notes}</Text>
          </Box>
        )}
      </Card>

      {/* Booked online with a new number but the same name and car as someone
          on file. Never merged for them — Mike decides. */}
      {possibleDuplicate && (
        <Alert color="yellow" icon={<IconUsers size={18} />} title="Might be a duplicate">
          <Stack gap="xs">
            <Text size="sm">
              This customer booked online with a new number, but{" "}
              {[possibleDuplicate.firstName, possibleDuplicate.lastName]
                .filter(Boolean)
                .join(" ")}{" "}
              ({formatPhone(possibleDuplicate.phone)}) is already on file with the same name and
              the same vehicle.
            </Text>
            <Group gap="xs">
              <Button size="xs" onClick={mergeModalCtl.open}>
                Merge them
              </Button>
              <Button
                size="xs"
                variant="subtle"
                loading={clearDuplicateFlag.isPending}
                onClick={() => clearDuplicateFlag.mutate()}
              >
                Not the same person
              </Button>
              <Button
                size="xs"
                variant="subtle"
                component={Link}
                to={`/customers/${possibleDuplicate.id}`}
              >
                Open the other one
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      {aliases.length > 0 && (
        <Text size="xs" c="dimmed">
          Also on file as{" "}
          {aliases
            .map((a) =>
              `${[a.firstName, a.lastName].filter(Boolean).join(" ")} (${formatPhone(a.phone)})`
            )
            .join(", ")}
        </Text>
      )}

      {/* Stats strip */}
      <CustomerStatsStrip
        vehicleCount={stats.vehicleCount}
        roCount={stats.roCount}
        lifetimeSpendCents={stats.lifetimeSpendCents}
        lastVisitAt={stats.lastVisitAt}
      />

      {/* Vehicles */}
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Vehicles</Title>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={vehicleModalCtl.open}
          >
            Add vehicle
          </Button>
        </Group>
        {vehicles.length === 0 ? (
          <Text c="dimmed" size="sm">
            {archivedVehicles.length > 0 ? "No active vehicles." : "No vehicles on file."}
          </Text>
        ) : (
          vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              action={
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label="Archive vehicle"
                  title="Sold or totalled — archive it"
                  loading={
                    setVehicleArchived.isPending &&
                    setVehicleArchived.variables?.vehicleId === v.id
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setVehicleArchived.mutate({ vehicleId: v.id, archived: true });
                  }}
                >
                  <IconArchive size={16} />
                </ActionIcon>
              }
            />
          ))
        )}
      </Stack>

      {/* Sold / totalled cars — off the pick lists and reminders, still on
          their old ROs. */}
      {archivedVehicles.length > 0 && (
        <Stack gap="xs">
          <Group justify="space-between">
            <Title order={5} c="dimmed">
              Archived vehicles
            </Title>
            <Button
              variant="subtle"
              size="xs"
              onClick={archivedCtl.toggle}
              leftSection={
                archivedOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />
              }
            >
              {archivedOpen ? "Hide" : `Show ${archivedVehicles.length}`}
            </Button>
          </Group>
          <Collapse in={archivedOpen}>
            <Stack gap="xs">
              {archivedVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  action={
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Un-archive vehicle"
                      title="Put it back on the pick lists"
                      loading={
                        setVehicleArchived.isPending &&
                        setVehicleArchived.variables?.vehicleId === v.id
                      }
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setVehicleArchived.mutate({ vehicleId: v.id, archived: false });
                      }}
                    >
                      <IconArchiveOff size={16} />
                    </ActionIcon>
                  }
                />
              ))}
            </Stack>
          </Collapse>
        </Stack>
      )}

      {/* Upcoming service reminders (collapsed when empty) */}
      <CustomerRemindersPanel customerId={customer.id} />

      {/* Activity timeline — last 12 months, paged, grouped by year */}
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Activity</Title>
          {!activityAll && (
            <Text size="xs" c="dimmed">
              Last 12 months
            </Text>
          )}
        </Group>
        {activity.length === 0 ? (
          <Text c="dimmed" size="sm">
            {activityAll ? "No repair orders yet." : "Nothing in the last 12 months."}
          </Text>
        ) : (
          activityYears.map((group) => (
            <Stack gap="xs" key={group.year}>
              <Divider
                label={String(group.year)}
                labelPosition="left"
                styles={{ label: { fontWeight: 600 } }}
              />
              {group.rows.map((r) => (
                <Card
                  key={r.id}
                  withBorder
                  component={Link as any}
                  to={`/ro/${r.id}`}
                  style={{ textDecoration: "none", color: "inherit", minHeight: 44 }}
                  padding="sm"
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                      <Text fw={600}>{formatRoNumber(r.number)}</Text>
                      <Badge variant="light" size="sm">
                        {(RO_STATUS_LABELS as Record<string, string>)[r.status] ?? r.status}
                      </Badge>
                      {r.paymentStatus === "paid" && (
                        <Badge variant="light" color="green" size="sm">
                          paid
                        </Badge>
                      )}
                      {r.paymentStatus === "partial" && (
                        <Badge variant="light" color="orange" size="sm">
                          partial{r.balanceCents ? ` · ${formatMoney(r.balanceCents)} due` : ""}
                        </Badge>
                      )}
                    </Group>
                    <Text fw={600}>{formatMoney(r.total)}</Text>
                  </Group>
                  <Text size="xs" c="dimmed" mt={4} lineClamp={1}>
                    {vehicleLabels.get(r.vehicleId) ?? "Vehicle"}
                    {r.concern ? ` · "${r.concern}"` : ""}
                    {" · "}
                    {relativeTime(r.updatedAt)}
                  </Text>
                </Card>
              ))}
            </Stack>
          ))
        )}
        {(activityHasMore || !activityAll) && (
          <Group justify="center">
            {activityHasMore ? (
              <Button
                variant="subtle"
                size="xs"
                loading={loadingActivity}
                onClick={loadOlderActivity}
              >
                Load {ACTIVITY_PAGE} more
              </Button>
            ) : (
              <Button variant="subtle" size="xs" onClick={() => setActivityAll(true)}>
                Show older
              </Button>
            )}
          </Group>
        )}
      </Stack>

      {/* Messages — last 12 months, paged, grouped by year (collapsed) */}
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Messages</Title>
          {messages.length > 0 && (
            <Button
              variant="subtle"
              size="xs"
              onClick={messagesCtl.toggle}
              leftSection={
                messagesOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />
              }
            >
              {messagesOpen
                ? "Hide"
                : `Show ${messages.length}${messagesHaveMore || !messagesAll ? "+" : ""}`}
            </Button>
          )}
        </Group>
        {messagesQ.isPending ? (
          <Text c="dimmed" size="sm">
            Loading…
          </Text>
        ) : messages.length === 0 ? (
          <Text c="dimmed" size="sm">
            {messagesAll ? "No messages yet." : "No texts in the last 12 months."}
          </Text>
        ) : (
          <Collapse in={messagesOpen}>
            <Stack gap="xs">
              {messageYears.map((group) => (
                <Stack gap="xs" key={group.year}>
                  <Divider
                    label={String(group.year)}
                    labelPosition="left"
                    styles={{ label: { fontWeight: 600 } }}
                  />
                  {group.rows.map((m) => (
                    <Card key={m.id} withBorder padding="sm">
                      <Group justify="space-between">
                        <Badge variant="light" color={m.direction === "in" ? "blue" : "gray"} size="xs">
                          {m.kind === "system" ? "Note" : m.direction === "in" ? "Inbound" : "Outbound"}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {relativeTime(m.sentAt)}
                        </Text>
                      </Group>
                      <Text size="sm" mt={4}>
                        {m.body}
                      </Text>
                      {(m.aiDrafted ||
                        m.autoReplied ||
                        m.automated ||
                        (m.direction === "out" && m.deliveryStatus === "failed")) && (
                        <Group gap="xs" mt="xs">
                          {m.aiDrafted && (
                            <Badge size="xs" variant="light">
                              AI draft
                            </Badge>
                          )}
                          {m.autoReplied && (
                            <Badge size="xs" color="grape" variant="light">
                              Auto-replied
                            </Badge>
                          )}
                          {m.automated && !m.autoReplied && (
                            <Badge size="xs" color="gray" variant="light">
                              Automated
                            </Badge>
                          )}
                          {m.direction === "out" && m.deliveryStatus === "failed" && (
                            <Text size="xs" c="red.7" fw={500}>
                              Not delivered
                            </Text>
                          )}
                        </Group>
                      )}
                    </Card>
                  ))}
                </Stack>
              ))}
              {(messagesHaveMore || !messagesAll) && (
                <Group justify="center">
                  {messagesHaveMore ? (
                    <Button
                      variant="subtle"
                      size="xs"
                      loading={loadingMessages}
                      onClick={loadOlderMessages}
                    >
                      Load {MESSAGE_PAGE} more
                    </Button>
                  ) : (
                    <Button variant="subtle" size="xs" onClick={() => setMessagesAll(true)}>
                      Show older
                    </Button>
                  )}
                </Group>
              )}
            </Stack>
          </Collapse>
        )}
      </Stack>

      <MergeCustomerModal
        opened={mergeModal}
        onClose={mergeModalCtl.close}
        survivor={{ id: customer.id, firstName: customer.firstName, lastName: customer.lastName }}
        suggested={possibleDuplicate}
        onMerged={() => {
          qc.invalidateQueries({ queryKey: ["customer-history", customer.id] });
          qc.invalidateQueries({ queryKey: ["customer-messages", customer.id] });
        }}
      />

      <TextHistoryLinkModal
        opened={historyLinkModal}
        onClose={historyLinkModalCtl.close}
        customer={{ id: customer.id, firstName: customer.firstName }}
        shopName={me?.shop?.name ?? "the shop"}
        onSent={() => qc.invalidateQueries({ queryKey: ["customer-history", id] })}
      />

      <Modal
        opened={editModal}
        onClose={editModalCtl.close}
        title="Edit customer"
        size="lg"
        centered
      >
        <CustomerForm
          mode="edit"
          submitLabel="Save changes"
          initialValues={{
            firstName: customer.firstName,
            lastName: customer.lastName ?? "",
            phone: formatPhone(customer.phone),
            email: customer.email ?? undefined,
            notes: customer.notes ?? undefined,
            taxExempt: customer.taxExempt ?? false,
          }}
          loading={updateCustomer.isPending}
          onCancel={editModalCtl.close}
          onSubmit={async (values) => {
            await updateCustomer.mutateAsync(values);
          }}
        />
      </Modal>

      <Modal
        opened={vehicleModal}
        onClose={vehicleModalCtl.close}
        title="Add vehicle"
        size="lg"
        centered
      >
        <VehicleForm
          customerId={customer.id}
          submitLabel="Add vehicle"
          loading={addVehicle.isPending}
          onCancel={vehicleModalCtl.close}
          onSubmit={async (values) => {
            await addVehicle.mutateAsync(values);
          }}
        />
      </Modal>
    </Stack>
  );
}
