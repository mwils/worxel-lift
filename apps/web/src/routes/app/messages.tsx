import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { api } from "../../lib/api";
import { formatPhone, relativeTime } from "../../lib/format";
import { RemindersList } from "../../features/reminders/RemindersList";

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomerListResponse {
  customers: CustomerRow[];
  page: number;
  pageSize: number;
  total: number;
}

interface LatestMessage {
  id: string;
  body: string;
  direction: "in" | "out";
  sentAt: string;
  aiDrafted: boolean;
  autoReplied: boolean;
  automated?: boolean;
  deliveryStatus?: "sent" | "delivered" | "failed" | null;
}

interface ConversationResponse {
  messages: LatestMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface ConvoSummary {
  customer: CustomerRow;
  latest: LatestMessage | null;
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

function InboxTab() {
  // v1 inbox: list customers + grab the single latest message per customer.
  // Cheap-and-cheerful aggregation: server-side conversations endpoint would
  // be the right answer once message volume justifies it (see Slice H).
  const customersQ = useQuery({
    queryKey: ["customers", ""],
    queryFn: () => api.get<CustomerListResponse>("/customers?pageSize=100"),
  });

  const customers = customersQ.data?.customers ?? [];

  const messageQueries = useQueries({
    queries: customers.map((c) => ({
      queryKey: ["conversation-latest", c.id],
      queryFn: () =>
        api.get<ConversationResponse>(`/messages/conversation/${c.id}?limit=1`),
      enabled: !!c.id,
      staleTime: 30_000,
    })),
  });

  const conversations: ConvoSummary[] = useMemo(() => {
    const list: ConvoSummary[] = customers.map((c, i) => {
      const q = messageQueries[i];
      const messages = q?.data?.messages ?? [];
      const latest: LatestMessage | null =
        messages.length > 0 ? messages[messages.length - 1]! : null;
      return { customer: c, latest };
    });

    // Show customers with messages first (newest activity at the top), then the
    // rest alphabetically so the inbox is still useful before anyone has texted.
    return list.sort((a, b) => {
      if (a.latest && b.latest) {
        return new Date(b.latest.sentAt).getTime() - new Date(a.latest.sentAt).getTime();
      }
      if (a.latest) return -1;
      if (b.latest) return 1;
      const aName = `${a.customer.lastName ?? ""} ${a.customer.firstName}`;
      const bName = `${b.customer.lastName ?? ""} ${b.customer.firstName}`;
      return aName.localeCompare(bName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, messageQueries.map((q) => q.dataUpdatedAt).join(",")]);

  if (customersQ.isPending) {
    return (
      <Center py="lg">
        <Loader size="sm" />
      </Center>
    );
  }

  return (
    <Stack gap="sm">
      {conversations.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <Text c="dimmed">
              No conversations yet — they'll appear here when customers text you.
            </Text>
            <Button component={Link} to="/customers" variant="default">
              See customers
            </Button>
          </Stack>
        </Center>
      ) : (
        <Stack gap="xs">
          {conversations.map(({ customer, latest }) => {
            const fullName = [customer.firstName, customer.lastName]
              .filter(Boolean)
              .join(" ");
            return (
              <Card
                key={customer.id}
                withBorder
                component={Link as any}
                to={`/messages/${customer.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Group justify="space-between" wrap="nowrap" align="flex-start">
                  <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" wrap="nowrap">
                      <Text fw={600} truncate>
                        {fullName}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatPhone(customer.phone)}
                      </Text>
                    </Group>
                    {latest ? (
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {latest.direction === "out" ? "You: " : ""}
                        {latest.body}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed" fs="italic">
                        No messages yet
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={4} align="flex-end">
                    {latest && (
                      <Text size="xs" c="dimmed">
                        {relativeTime(latest.sentAt)}
                      </Text>
                    )}
                    <Group gap={4}>
                      {latest?.autoReplied && (
                        <Badge size="xs" color="grape" variant="light">
                          Auto-replied
                        </Badge>
                      )}
                      {latest?.automated && !latest.autoReplied && (
                        <Badge size="xs" color="gray" variant="light">
                          Automated
                        </Badge>
                      )}
                      {latest?.direction === "out" && latest.deliveryStatus === "failed" && (
                        <Badge size="xs" color="red" variant="light">
                          Not delivered
                        </Badge>
                      )}
                      {latest?.aiDrafted && (
                        <Badge size="xs" color="violet" variant="light">
                          AI draft
                        </Badge>
                      )}
                    </Group>
                  </Stack>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
