import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Group, Modal, Stack, Switch, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { formatMoney } from "../../lib/format";

export interface SendInspectionModalProps {
  opened: boolean;
  onClose: () => void;
  repairOrderId: string;
  customerFirstName: string;
  vehicleSummary: string;
  itemCount: number;
  totalCents: number;
  hasLineItems: boolean;
  // Customer already approved the estimate — the text shouldn't ask them to
  // approve again, and "Include estimate" defaults off.
  estimateApproved?: boolean;
  onSent?: () => void;
}

function buildClientDraft(args: {
  customerFirstName: string;
  vehicleSummary: string;
  itemCount: number;
  totalCents: number;
  includeEstimate: boolean;
  estimateApproved: boolean;
}): string {
  const veh = args.vehicleSummary || "your vehicle";
  const head = `Hi ${args.customerFirstName} — we pulled ${veh} in and walked through it.`;
  if (args.estimateApproved) {
    const approvedHead = `Hi ${args.customerFirstName} — here's the inspection from today's visit on ${veh}.`;
    return [
      args.includeEstimate && args.totalCents > 0
        ? `${approvedHead} Photos and notes are here, with the estimate you approved (${formatMoney(
            args.totalCents
          )}) at the bottom for reference.`
        : `${approvedHead} Photos and notes are here so you can see what we found.`,
      "",
      "(secure link arrives when you tap send)",
    ].join("\n");
  }
  if (args.includeEstimate && args.totalCents > 0) {
    return [
      `${head} Photos and notes are here, with the estimate (${formatMoney(
        args.totalCents
      )}) at the bottom — you can approve right from the page.`,
      "",
      "(secure link arrives when you tap send)",
    ].join("\n");
  }
  return [
    `${head} Photos and notes are here so you can see what we found.`,
    "",
    "(secure link arrives when you tap send)",
  ].join("\n");
}

export function SendInspectionModal({
  opened,
  onClose,
  repairOrderId,
  customerFirstName,
  vehicleSummary,
  itemCount,
  totalCents,
  hasLineItems,
  estimateApproved = false,
  onSent,
}: SendInspectionModalProps) {
  const [includeEstimate, setIncludeEstimate] = useState(!estimateApproved);
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);

  const initialDraft = useMemo(
    () =>
      buildClientDraft({
        customerFirstName,
        vehicleSummary,
        itemCount,
        totalCents,
        includeEstimate: includeEstimate && hasLineItems,
        estimateApproved,
      }),
    [
      customerFirstName,
      vehicleSummary,
      itemCount,
      totalCents,
      includeEstimate,
      hasLineItems,
      estimateApproved,
    ]
  );

  // Re-derive the default toggle each time the modal opens — approval state
  // may have changed since the last send.
  useEffect(() => {
    if (opened) setIncludeEstimate(!estimateApproved);
  }, [opened, estimateApproved]);

  useEffect(() => {
    if (!opened) {
      setTouched(false);
      return;
    }
    if (!touched) setDraft(initialDraft);
  }, [opened, initialDraft, touched]);

  const send = useMutation({
    mutationFn: () =>
      api.post(`/repair-orders/${repairOrderId}/send-inspection`, {
        includeEstimate,
        draftOverride: touched ? draft : undefined,
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: "Inspection sent." });
      onSent?.();
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't send inspection" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Send inspection" size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Customer gets this as a text. The link is added when you send.
        </Text>
        <Switch
          checked={includeEstimate}
          onChange={(e) => {
            setIncludeEstimate(e.currentTarget.checked);
            // Re-render with new template until the owner manually edits.
            setTouched(false);
          }}
          label="Include estimate in this message"
          description={
            !hasLineItems
              ? "No line items on this RO yet — the inspection page won't show an estimate."
              : estimateApproved
              ? "Already approved — the page shows it for reference, no second approval asked."
              : "Customer can approve or decline right from the link."
          }
          disabled={!hasLineItems && !includeEstimate}
        />
        <Textarea
          autosize
          minRows={6}
          value={draft}
          onChange={(e) => {
            setDraft(e.currentTarget.value);
            setTouched(true);
          }}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => send.mutate()}
            loading={send.isPending}
            disabled={itemCount === 0}
          >
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
