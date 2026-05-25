import { useEffect, useState } from "react";
import { Button, Drawer, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconSend } from "@tabler/icons-react";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";

export interface AiDraftSheetProps {
  opened: boolean;
  onClose: () => void;
  customerId: string;
  repairOrderId?: string;
  initialDraft: string;
  /** Whether the initial draft came from the model (`true`) or is owner-typed (`false`). */
  aiDrafted: boolean;
  /** Optional override of the title shown at the top of the sheet. */
  title?: string;
  /** Fires after the message has been saved + sent. */
  onSent?: (message: SentMessage) => void;
}

export interface SentMessage {
  id: string;
  body: string;
  direction: "out";
  sentAt: string;
  aiDrafted: boolean;
}

interface SendResponse {
  message: SentMessage;
}

export function AiDraftSheet({
  opened,
  onClose,
  customerId,
  repairOrderId,
  initialDraft,
  aiDrafted,
  title,
  onSent,
}: AiDraftSheetProps) {
  const isMobile = useMediaQuery("(max-width: 640px)") ?? false;
  const qc = useQueryClient();
  const [body, setBody] = useState(initialDraft);
  const [edited, setEdited] = useState(false);

  // Sync incoming draft whenever the sheet is (re)opened with a new draft.
  useEffect(() => {
    if (opened) {
      setBody(initialDraft);
      setEdited(false);
    }
  }, [opened, initialDraft]);

  const sendMut = useMutation({
    mutationFn: () =>
      api.post<SendResponse>("/messages/send", {
        customerId,
        repairOrderId,
        body: body.trim(),
        // If the owner edited the draft we still flag aiDrafted=true when it
        // started as AI — useful for analytics. Switch to false once edited
        // would lose that signal, so prefer the original prop.
        aiDrafted,
      }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ["conversation", customerId] });
      qc.invalidateQueries({ queryKey: ["customer-history", customerId] });
      qc.invalidateQueries({ queryKey: ["conversations-inbox"] });
      notifications.show({ color: "green", message: "Message sent" });
      onSent?.(resp.message);
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't send message" }),
  });

  const canSend = body.trim().length > 0 && !sendMut.isPending;

  const inner = (
    <Stack>
      <Text size="sm" c="dimmed">
        {aiDrafted
          ? "Review the draft. You can edit before sending."
          : "Edit before sending."}
      </Text>
      <Textarea
        autosize
        minRows={4}
        maxRows={12}
        value={body}
        onChange={(e) => {
          setBody(e.currentTarget.value);
          setEdited(true);
        }}
        placeholder="Type the SMS body…"
      />
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          {body.length} chars{edited ? " · edited" : ""}
        </Text>
        <Group>
          <Button variant="subtle" onClick={onClose} disabled={sendMut.isPending}>
            Cancel
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
      </Group>
    </Stack>
  );

  const sheetTitle = title ?? (aiDrafted ? "Review AI draft" : "Text to customer");

  if (isMobile) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        position="bottom"
        size="80%"
        title={sheetTitle}
        radius="md"
      >
        {inner}
      </Drawer>
    );
  }
  return (
    <Modal opened={opened} onClose={onClose} title={sheetTitle} size="lg" centered>
      {inner}
    </Modal>
  );
}
