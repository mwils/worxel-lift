import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import type { RoStatus } from "@lift/shared/constants";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { notifyError, notifySuccess } from "../../lib/notify";

export type PromptableStatus = Extract<RoStatus, "ready" | "picked_up">;

export interface StatusTextPromptProps {
  /** Which status just landed; null keeps the modal closed. */
  status: PromptableStatus | null;
  onClose: () => void;
  repairOrderId: string;
  customer: { id: string; firstName: string } | null;
  vehicleSummary: string;
  shopName: string;
  balanceCents: number;
  /** Shop's Stripe Connect account can take charges → append a pay link. */
  paymentsReady: boolean;
  onSent: () => void;
}

function buildBody(args: {
  status: PromptableStatus;
  firstName: string;
  vehicleSummary: string;
  shopName: string;
  balanceCents: number;
  payUrl: string | null;
}): string {
  const veh = args.vehicleSummary && args.vehicleSummary !== "—" ? args.vehicleSummary : "vehicle";
  const lines: string[] = [];
  if (args.status === "ready") {
    lines.push(`Hi ${args.firstName} — your ${veh} is ready for pickup at ${args.shopName}.`);
    if (args.balanceCents > 0) lines.push(`${formatMoney(args.balanceCents)} due.`);
  } else {
    lines.push(`Hi ${args.firstName} — thanks for picking up your ${veh} from ${args.shopName}.`);
    if (args.balanceCents > 0) {
      lines.push(`There's still ${formatMoney(args.balanceCents)} open on this one.`);
    }
  }
  lines.push("Reply here with any questions.");
  let body = lines.join(" ");
  if (args.payUrl && args.balanceCents > 0) body += `\n\nPay here: ${args.payUrl}`;
  return body;
}

/**
 * One-tap "text the customer" prompt shown right after an RO lands in Ready or
 * Picked up. Prefilled, editable, never auto-sent — the owner taps Send. Goes
 * out through POST /messages/send so it shows in the customer's thread.
 */
export function StatusTextPrompt(props: StatusTextPromptProps) {
  const { status, onClose, repairOrderId, customer, vehicleSummary, shopName, balanceCents, paymentsReady, onSent } =
    props;
  const [draft, setDraft] = useState("");
  const [preparing, setPreparing] = useState(false);

  // Build the draft each time the prompt opens. The pay link needs a round
  // trip to mint the RO's public token, so the body arrives in two beats.
  useEffect(() => {
    if (!status || !customer) return;
    let cancelled = false;
    const base = {
      status,
      firstName: customer.firstName,
      vehicleSummary,
      shopName,
      balanceCents,
    };
    setDraft(buildBody({ ...base, payUrl: null }));
    if (!paymentsReady || balanceCents <= 0) return;
    setPreparing(true);
    api
      .post<{ url: string }>("/payments/create-link", { repairOrderId })
      .then((res) => {
        if (!cancelled) setDraft(buildBody({ ...base, payUrl: res.url }));
      })
      .catch(() => {
        // No link is fine — the amount line still tells them what's due.
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, repairOrderId, balanceCents]);

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

  const title =
    status === "picked_up"
      ? `Text ${customer?.firstName ?? "customer"} a thank-you?`
      : `Text ${customer?.firstName ?? "customer"} it's ready?`;

  return (
    <Modal opened={!!status && !!customer} onClose={onClose} title={title} size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Edit before sending. Nothing goes out until you tap Send.
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
            disabled={!draft.trim()}
          >
            Send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
