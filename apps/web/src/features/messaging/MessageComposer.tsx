import { useState } from "react";
import { Button, Group, Stack, Textarea } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { IconSend, IconSparkles } from "@tabler/icons-react";
import { api, ApiError } from "../../lib/api";
import { AiDraftSheet } from "./AiDraftSheet";

export interface MessageComposerProps {
  customerId: string;
  repairOrderId?: string;
  /** Optional onSent callback. */
  onSent?: () => void;
}

interface DraftResponse {
  draft: string;
  promptVersion: string;
  model: string;
}

interface SendResponse {
  message: { id: string };
}

export function MessageComposer({ customerId, repairOrderId, onSent }: MessageComposerProps) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");

  // Drafts open the AiDraftSheet rather than send directly.
  const [sheetOpened, setSheetOpened] = useState(false);
  const [sheetDraft, setSheetDraft] = useState("");
  const [sheetAi, setSheetAi] = useState(false);

  const draftMut = useMutation({
    mutationFn: () =>
      api.post<DraftResponse>("/messages/draft", {
        customerId,
        repairOrderId,
        kind: "freeform",
        context: body.trim() || undefined,
      }),
    onSuccess: (resp) => {
      setSheetDraft(resp.draft);
      setSheetAi(true);
      setSheetOpened(true);
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      notifications.show({ color: "red", message: msg });
    },
  });

  const sendMut = useMutation({
    mutationFn: () =>
      api.post<SendResponse>("/messages/send", {
        customerId,
        repairOrderId,
        body: body.trim(),
        aiDrafted: false,
      }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["conversation", customerId] });
      qc.invalidateQueries({ queryKey: ["customer-history", customerId] });
      qc.invalidateQueries({ queryKey: ["conversations-inbox"] });
      notifications.show({ color: "green", message: "Message sent" });
      onSent?.();
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : (err as Error).message;
      notifications.show({ color: "red", message: msg });
    },
  });

  const canSend = body.trim().length > 0 && !sendMut.isPending;

  return (
    <Stack gap="xs">
      <Textarea
        autosize
        minRows={2}
        maxRows={6}
        value={body}
        onChange={(e) => setBody(e.currentTarget.value)}
        placeholder="Type a message, or click Draft with AI…"
      />
      <Group justify="space-between" wrap="wrap">
        <Button
          variant="light"
          leftSection={<IconSparkles size={16} />}
          onClick={() => draftMut.mutate()}
          loading={draftMut.isPending}
        >
          Draft with AI
        </Button>
        <Button
          leftSection={<IconSend size={16} />}
          disabled={!canSend}
          loading={sendMut.isPending}
          onClick={() => sendMut.mutate()}
        >
          Send
        </Button>
      </Group>

      <AiDraftSheet
        opened={sheetOpened}
        onClose={() => setSheetOpened(false)}
        customerId={customerId}
        repairOrderId={repairOrderId}
        initialDraft={sheetDraft}
        aiDrafted={sheetAi}
        onSent={() => {
          setBody("");
          onSent?.();
        }}
      />
    </Stack>
  );
}
