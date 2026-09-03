import { Badge, Group, Paper, Stack, Text } from "@mantine/core";

export interface ConversationMessage {
  id: string;
  direction: "in" | "out";
  /** "system" notes (e.g. phone number changed) were never texted. */
  kind?: "sms" | "system";
  body: string;
  sentAt: string | Date;
  aiDrafted?: boolean;
  autoReplied?: boolean;
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
        if (m.kind === "system") {
          return (
            <Text key={m.id} size="xs" c="dimmed" ta="center" px="md">
              {m.body} · {fmtTime(m.sentAt)}
            </Text>
          );
        }
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
                {m.autoReplied && !outbound && (
                  <Badge size="xs" variant="light" color="grape">
                    Auto-replied
                  </Badge>
                )}
              </Group>
            </Stack>
          </Group>
        );
      })}
    </Stack>
  );
}
