import { useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Menu,
  SegmentedControl,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconArchiveOff, IconCheck, IconDots, IconSearch } from "@tabler/icons-react";
import { api } from "../../lib/api";
import { formatPhone, relativeTime } from "../../lib/format";
import { RemindersList } from "../../features/reminders/RemindersList";

type InboxFilter = "needs_reply" | "unread" | "all";

interface ThreadCustomer {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  smsOptOutAt: string | null;
}

interface ThreadLastMessage {
  id: string;
  direction: "in" | "out";
  kind: "sms" | "system";
  body: string;
  sentAt: string;
  aiDrafted: boolean;
  autoReplied: boolean;
  automated: boolean;
  deliveryStatus: "sent" | "delivered" | "failed" | null;
}

interface InboxThread {
  customerId: string;
  customer: ThreadCustomer;
  lastMessage: ThreadLastMessage | null;
  lastMessagePreview: string;
  lastMessageAt: string | null;
  bumpedAt: string;
  unreadCount: number;
  unread: boolean;
  needsReply: boolean;
  archived: boolean;
}

interface InboxResponse {
  threads: InboxThread[];
  hasMore: boolean;
  nextCursor: string | null;
  counts: { needsReply: number; unread: number } | null;
}

export function MessagesInboxRoute() {
  // Two sub-views, one route. Reminders explicitly live HERE (not as a new
  // top-level nav item) — same surface, different lens on customer comms.
  const [tab, setTab] = useState<"inbox" | "reminders">("inbox");

  return (
    <Stack>
      <Group justify="space-between" wrap="nowrap">
        <Title order={2}>Messages</Title>
        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as "inbox" | "reminders")}
          data={[
            { value: "inbox", label: "Inbox" },
            { value: "reminders", label: "Reminders" },
          ]}
        />
      </Group>
      {tab === "inbox" ? <InboxTab /> : <RemindersList />}
    </Stack>
  );
}

function withCount(label: string, n: number | undefined) {
  return n ? `${label} (${n})` : label;
}

function InboxTab() {
  // Server-side thread list (GET /messages/inbox) — one row per customer,
  // maintained on every message write. Default lens is "Needs reply": the
  // queue Mike actually works. Auto-answered status checks stay put.
  const [filter, setFilter] = useState<InboxFilter>("needs_reply");
  const [q, setQ] = useState("");
  const [debouncedQ] = useDebouncedValue(q.trim(), 250);
  const [showDone, setShowDone] = useState(false);
  const qc = useQueryClient();

  const inboxQ = useInfiniteQuery({
    queryKey: ["inbox", filter, debouncedQ, showDone],
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ filter, limit: "30" });
      if (debouncedQ) p.set("q", debouncedQ);
      if (showDone) p.set("archived", "1");
      if (pageParam) p.set("cursor", pageParam);
      return api.get<InboxResponse>(`/messages/inbox?${p.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : null),
    refetchInterval: 30_000,
  });

  const doneM = useMutation({
    mutationFn: ({ customerId, archived }: { customerId: string; archived: boolean }) =>
      api.post(`/messages/threads/${customerId}/${archived ? "unarchive" : "archive"}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });

  const threads = inboxQ.data?.pages.flatMap((p) => p.threads) ?? [];
  const counts = inboxQ.data?.pages[0]?.counts ?? undefined;

  let emptyText: string;
  if (debouncedQ) emptyText = `Nothing matches “${debouncedQ}”.`;
  else if (showDone) emptyText = "Nothing marked done yet.";
  else if (filter === "needs_reply") emptyText = "Nobody's waiting on you. Nice.";
  else if (filter === "unread") emptyText = "Nothing unread.";
  else emptyText = "No conversations yet — they'll appear here when customers text you.";

  return (
    <Stack gap="sm">
      <SegmentedControl
        fullWidth
        value={filter}
        onChange={(v) => setFilter(v as InboxFilter)}
        data={[
          { value: "needs_reply", label: withCount("Needs reply", counts?.needsReply) },
          { value: "unread", label: withCount("Unread", counts?.unread) },
          { value: "all", label: "All" },
        ]}
      />
      <Group wrap="nowrap" gap="sm" align="center">
        <TextInput
          style={{ flex: 1 }}
          placeholder="Search name, number, or text"
          leftSection={<IconSearch size={16} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          aria-label="Search messages"
        />
        <Switch
          size="sm"
          label="Done"
          checked={showDone}
          onChange={(e) => setShowDone(e.currentTarget.checked)}
          styles={{ label: { paddingInlineStart: 6 } }}
        />
      </Group>

      {inboxQ.isPending ? (
        <Center py="lg">
          <Loader size="sm" />
        </Center>
      ) : threads.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Text c="dimmed" ta="center">
              {emptyText}
            </Text>
            {filter !== "all" && !debouncedQ && !showDone ? (
              <Button variant="subtle" size="xs" onClick={() => setFilter("all")}>
                Show all conversations
              </Button>
            ) : (
              <Button component={Link} to="/customers" variant="default">
                See customers
              </Button>
            )}
          </Stack>
        </Center>
      ) : (
        <Stack gap="xs">
          {threads.map((t) => (
            <ThreadRow
              key={t.customerId}
              thread={t}
              busy={doneM.isPending && doneM.variables?.customerId === t.customerId}
              onToggleDone={() =>
                doneM.mutate({ customerId: t.customerId, archived: t.archived })
              }
            />
          ))}
          {inboxQ.hasNextPage && (
            <Center pt="xs">
              <Button
                variant="default"
                onClick={() => inboxQ.fetchNextPage()}
                loading={inboxQ.isFetchingNextPage}
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

function ThreadRow({
  thread: t,
  busy,
  onToggleDone,
}: {
  thread: InboxThread;
  busy: boolean;
  onToggleDone: () => void;
}) {
  const fullName = [t.customer.firstName, t.customer.lastName].filter(Boolean).join(" ");
  const last = t.lastMessage;
  const preview = last
    ? `${last.direction === "out" && last.kind !== "system" ? "You: " : ""}${last.body}`
    : t.lastMessagePreview;
  const when = t.lastMessageAt ?? t.bumpedAt;

  return (
    <Card withBorder p={0}>
      <Group wrap="nowrap" gap={0} align="stretch">
        <UnstyledButton
          component={Link}
          to={`/messages/${t.customerId}`}
          style={{ flex: 1, minWidth: 0, padding: "10px 12px" }}
        >
          <Group wrap="nowrap" align="flex-start" gap="sm">
            <Box
              w={8}
              h={8}
              mt={7}
              style={{
                flex: "0 0 8px",
                borderRadius: 4,
                background: t.unread ? "var(--mantine-color-blue-6)" : "transparent",
              }}
              aria-label={t.unread ? "Unread" : undefined}
            />
            <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
              <Group gap="xs" wrap="nowrap" justify="space-between">
                <Text fw={t.unread ? 700 : 600} truncate style={{ minWidth: 0 }}>
                  {fullName}
                </Text>
                <Text size="xs" c="dimmed" style={{ flex: "0 0 auto" }}>
                  {relativeTime(when)}
                </Text>
              </Group>
              <Text size="sm" c={t.unread ? undefined : "dimmed"} lineClamp={1}>
                {preview || "No messages yet"}
              </Text>
              <Group gap={4} wrap="wrap">
                <Text size="xs" c="dimmed">
                  {formatPhone(t.customer.phone)}
                </Text>
                {t.needsReply && (
                  <Badge size="xs" color="orange" variant="light">
                    Needs reply
                  </Badge>
                )}
                {last?.autoReplied && (
                  <Badge size="xs" color="grape" variant="light">
                    Auto-replied
                  </Badge>
                )}
                {last?.automated && !last.autoReplied && (
                  <Badge size="xs" color="gray" variant="light">
                    Automated
                  </Badge>
                )}
                {last?.direction === "out" && last.deliveryStatus === "failed" && (
                  <Badge size="xs" color="red" variant="light">
                    Not delivered
                  </Badge>
                )}
                {t.customer.smsOptOutAt && (
                  <Badge size="xs" color="gray" variant="outline">
                    Opted out
                  </Badge>
                )}
              </Group>
            </Stack>
          </Group>
        </UnstyledButton>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label="Thread actions"
              loading={busy}
              style={{ alignSelf: "center", marginRight: 6 }}
            >
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={t.archived ? <IconArchiveOff size={16} /> : <IconCheck size={16} />}
              onClick={onToggleDone}
            >
              {t.archived ? "Reopen" : "Mark done"}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Card>
  );
}
