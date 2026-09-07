import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Anchor, Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { api } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

export interface TextHistoryLinkModalProps {
  opened: boolean;
  onClose: () => void;
  customer: { id: string; firstName: string };
  shopName: string;
  onSent?: () => void;
}

export function buildHistoryLinkBody(args: { firstName: string; shopName: string; url: string }): string {
  return [
    `Hi ${args.firstName} — here's your service history with ${args.shopName}: ${args.url}`,
    "Every visit, what we did, and your receipts in one spot. Save it.",
    "Reply here with any questions.",
  ].join(" ");
}

/**
 * Prefilled, editable, never auto-sent. Mints (or fetches) the customer's
 * history link, drops it in the draft, and sends through POST /messages/send
 * so it lands in the thread like any other owner text.
 */
export function TextHistoryLinkModal(props: TextHistoryLinkModalProps) {
  const { opened, onClose, customer, shopName, onSent } = props;
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    setPreparing(true);
    api
      .post<{ url: string }>(`/customers/${customer.id}/history-link`)
      .then((res) => {
        if (cancelled) return;
        setUrl(res.url);
        setDraft(buildHistoryLinkBody({ firstName: customer.firstName, shopName, url: res.url }));
      })
      .catch((err) => {
        if (!cancelled) notifyError(err, { title: "Couldn't make the history link" });
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, customer.id]);

  const send = useMutation({
    mutationFn: () =>
      api.post("/messages/send", {
        customerId: customer.id,
        body: draft.trim(),
        aiDrafted: false,
      }),
    onSuccess: () => {
      notifySuccess(`Texted the history link to ${customer.firstName}.`);
      onSent?.();
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't send text" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Text history link" size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Edit before sending. Nothing goes out until you tap Send.
          {url && (
            <>
              {" "}
              <Anchor href={url} target="_blank" rel="noreferrer" size="sm">
                Open their history page
              </Anchor>
            </>
          )}
        </Text>
        <Textarea
          autosize
          minRows={4}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          disabled={preparing}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Not now
          </Button>
          <Button
            leftSection={<IconSend size={16} />}
            onClick={() => send.mutate()}
            loading={send.isPending || preparing}
            disabled={!draft.trim() || !url}
          >
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
