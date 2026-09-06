import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArchiveOff, IconCheck, IconChevronLeft } from "@tabler/icons-react";
import { api } from "../../../lib/api";
import { formatPhone } from "../../../lib/format";
import {
  ConversationView,
  type ConversationMessage,
} from "../../../features/messaging/ConversationView";
import { MessageComposer } from "../../../features/messaging/MessageComposer";

interface ConversationResponse {
  messages: ConversationMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface ThreadState {
  thread: { archived: boolean; needsReply: boolean; unreadCount: number } | null;
}

interface CustomerLite {
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
  };
}

export function ConversationRoute() {
  const { customerId } = useParams<{ customerId: string }>();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Older pages fetched by clicking "Load older messages". The conversation
  // endpoint returns oldest→newest within a page, so we prepend.
  const [olderPages, setOlderPages] = useState<ConversationMessage[]>([]);
  const [oldestCursor, setOldestCursor] = useState<string | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const customerQ = useQuery({
    queryKey: ["customer", customerId],
    queryFn: () => api.get<CustomerLite>(`/customers/${customerId}`),
    enabled: !!customerId,
  });

  const convoQ = useQuery({
    queryKey: ["conversation", customerId],
    queryFn: async () => {
      const res = await api.get<ConversationResponse>(
        `/messages/conversation/${customerId}?limit=50`
      );
      // Reset pagination state when the head page refetches.
      setOlderPages([]);
      setOldestCursor(res.nextCursor);
      setHasMoreOlder(res.hasMore);
      return res;
    },
    enabled: !!customerId,
    refetchInterval: 15_000,
  });

  const allMessages: ConversationMessage[] = [
    ...olderPages,
    ...(convoQ.data?.messages ?? []),
  ];

  async function loadOlder() {
    if (!customerId || !oldestCursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await api.get<ConversationResponse>(
        `/messages/conversation/${customerId}?limit=50&cursor=${encodeURIComponent(oldestCursor)}`
      );
      setOlderPages((prev) => [...res.messages, ...prev]);
      setOldestCursor(res.nextCursor);
      setHasMoreOlder(res.hasMore);
    } finally {
      setLoadingOlder(false);
    }
  }

  // Auto-scroll to newest on data change (but not when we prepend older).
  const newestCount = convoQ.data?.messages.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [newestCount]);

  // Opening the thread marks it read; so does a new text arriving while
  // it's open (newestCount changes on the 15s poll).
  const readM = useMutation({
    mutationFn: () => api.post<ThreadState>(`/messages/threads/${customerId}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });
  const markRead = readM.mutate;
  const loaded = !!convoQ.data;
  useEffect(() => {
    if (customerId && loaded) markRead();
  }, [customerId, newestCount, loaded, markRead]);

  const thread = readM.data?.thread ?? null;
  const doneM = useMutation({
    mutationFn: (archived: boolean) =>
      api.post<ThreadState>(
        `/messages/threads/${customerId}/${archived ? "unarchive" : "archive"}`
      ),
    onSuccess: (_res, archived) => {
      qc.invalidateQueries({ queryKey: ["inbox"] });
      if (!archived) navigate("/messages");
      else markRead();
    },
  });

  if (!customerId) {
    return <Text c="dimmed">Missing customer id.</Text>;
  }

  const customer = customerQ.data?.customer;
  const fullName = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(" ")
    : "Conversation";

  return (
    <Stack gap="sm" style={{ height: "calc(100vh - 100px)" }}>
      <Group wrap="nowrap" justify="space-between">
        <Group wrap="nowrap" style={{ minWidth: 0 }}>
          <ActionIcon component={Link} to="/messages" variant="subtle" aria-label="Back to messages">
            <IconChevronLeft size={20} />
          </ActionIcon>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Title order={4} lineClamp={1}>
              {fullName}
            </Title>
            {customer && (
              <Text size="xs" c="dimmed" truncate>
                {formatPhone(customer.phone)}
                {customer.email ? ` · ${customer.email}` : ""}
              </Text>
            )}
          </Stack>
        </Group>
        {thread && (
          <Button
            size="xs"
            variant={thread.archived ? "subtle" : "default"}
            leftSection={
              thread.archived ? <IconArchiveOff size={14} /> : <IconCheck size={14} />
            }
            loading={doneM.isPending}
            onClick={() => doneM.mutate(thread.archived)}
            style={{ flex: "0 0 auto" }}
          >
            {thread.archived ? "Reopen" : "Mark done"}
          </Button>
        )}
      </Group>

      <Card withBorder p="sm" style={{ flex: 1, overflow: "hidden" }}>
        <Box ref={scrollRef} style={{ height: "100%", overflowY: "auto" }}>
          {convoQ.isPending ? (
            <Center py="lg">
              <Loader size="sm" />
            </Center>
          ) : allMessages.length === 0 ? (
            <Center py="lg">
              <Text c="dimmed" size="sm">
                No messages yet. Text them first below.
              </Text>
            </Center>
          ) : (
            <>
              {hasMoreOlder && (
                <Center pb="sm">
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={loadOlder}
                    loading={loadingOlder}
                  >
                    Load older messages
                  </Button>
                </Center>
              )}
              <ConversationView messages={allMessages} />
            </>
          )}
        </Box>
      </Card>

      <MessageComposer
        customerId={customerId}
        onSent={() => {
          convoQ.refetch();
          qc.invalidateQueries({ queryKey: ["inbox"] });
        }}
      />
    </Stack>
  );
}
