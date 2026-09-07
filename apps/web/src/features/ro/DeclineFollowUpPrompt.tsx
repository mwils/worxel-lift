import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { api } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";

export interface DeclineFollowUpPromptProps {
  opened: boolean;
  onClose: () => void;
  repairOrderId: string;
  customer: { id: string; firstName: string } | null;
  /** How many lines are on the estimate — shapes the "part of it" offer. */
  lineItemCount: number;
  onSent: () => void;
}

/**
 * Prefilled follow-up after a customer declines an estimate. Plain and open-
 * ended on purpose: a decline is usually about money or timing, and the point
 * is to keep the conversation going, not to argue the number. Per-line
 * approve/decline and discount offers are out of scope (feature gap 7).
 */
export function buildDeclineFollowUp(firstName: string, lineItemCount: number): string {
  const ask =
    lineItemCount >= 2
      ? "Want us to just do part of it for now, or hold off?"
      : "Want to hold off for now, or talk through options?";
  return `Hi ${firstName} — no problem. ${ask} Reply here and we'll sort it out.`;
}

/**
 * One-tap "text them?" prompt off the declined-estimate alert on the RO page.
 * Prefilled, editable, never auto-sent — the owner taps Send. Goes out through
 * POST /messages/send so it lands in the customer's thread, and the API stamps
 * estimate.declineFollowedUpAt so the board banner clears.
 */
export function DeclineFollowUpPrompt(props: DeclineFollowUpPromptProps) {
  const { opened, onClose, repairOrderId, customer, lineItemCount, onSent } = props;
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!opened || !customer) return;
    setDraft(buildDeclineFollowUp(customer.firstName, lineItemCount));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, customer?.id]);

  const send = useMutation({
    mutationFn: () =>
      api.post("/messages/send", {
        customerId: customer!.id,
        repairOrderId,
        body: draft.trim(),
        aiDrafted: false,
      }),
    onSuccess: () => {
      notifySuccess(`Texted ${customer?.firstName ?? "the customer"}.`);
      onSent();
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't send text" }),
  });

  return (
    <Modal
      opened={opened && !!customer}
      onClose={onClose}
      title={`Text ${customer?.firstName ?? "customer"} about the estimate?`}
      size="lg"
    >
      <Stack>
        <Text size="sm" c="dimmed">
          Edit before sending. Nothing goes out until you tap Send.
        </Text>
        <Textarea
          autosize
          minRows={4}
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Not now
          </Button>
          <Button
            leftSection={<IconSend size={16} />}
            onClick={() => send.mutate()}
            loading={send.isPending}
            disabled={!draft.trim()}
          >
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
