import { Badge, Group, Paper, Stack, Text } from "@mantine/core";

export interface ConversationMessage {
  id: string;
  direction: "in" | "out";
  body: string;
  sentAt: string | Date;
  aiDrafted?: boolean;
  /** Outbound reply sent without the owner, in response to an inbound text. */
  autoReplied?: boolean;
  /** Outbound text the system sent on its own (opt-in, booking notice, reminder). */
  automated?: boolean;
  /** From End User Messaging delivery receipts; null/undefined = no receipt yet. */
  deliveryStatus?: "sent" | "delivered" | "failed" | null;
}

export interface ConversationViewProps {
  messages: ConversationMessage[];
  emptyText?: string;
}

function fmtTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = new Date().toDateString() === d.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConversationView({ messages, emptyText }: ConversationViewProps) {
  if (messages.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="lg">
        {emptyText ?? "No messages yet."}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {messages.map((m) => {
        const outbound = m.direction === "out";
        return (
          <Group key={m.id} justify={outbound ? "flex-end" : "flex-start"} wrap="nowrap">
            <Stack
              gap={4}
              align={outbound ? "flex-end" : "flex-start"}
              style={{ maxWidth: "78%" }}
            >
              <Paper
                p="xs"
                radius="md"
                withBorder={!outbound}
                bg={outbound ? "blue.6" : undefined}
                c={outbound ? "white" : undefined}
                shadow={outbound ? "xs" : undefined}
              >
                <Text size="sm" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {m.body}
                </Text>
              </Paper>
              <Group gap={6} wrap="nowrap">
                <Text size="xs" c="dimmed">
                  {fmtTime(m.sentAt)}
                </Text>
                {m.aiDrafted && outbound && (
                  <Badge size="xs" variant="light" color="violet">
                    AI draft
                  </Badge>
                )}
                {m.autoReplied && outbound && (
                  <Badge size="xs" variant="light" color="grape">
                    Auto-replied
                  </Badge>
                )}
                {m.automated && !m.autoReplied && outbound && (
                  <Badge size="xs" variant="light" color="gray">
                    Automated
                  </Badge>
                )}
                {outbound && m.deliveryStatus === "failed" && (
                  <Text size="xs" c="red.7" fw={500}>
                    Not delivered
                  </Text>
                )}
                {outbound && m.deliveryStatus === "delivered" && (
                  <Text size="xs" c="dimmed">
                    Delivered
                  </Text>
                )}
              </Group>
            </Stack>
          </Group>
        );
      })}
    </Stack>
  );
}
