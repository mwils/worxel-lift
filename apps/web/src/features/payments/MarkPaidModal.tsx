import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import type { PaymentMethod, PaymentStatus } from "@lift/shared/constants";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { notifyError, notifySuccess } from "../../lib/notify";

/** `payment` subdoc as returned by GET /repair-orders/:id. */
export interface RoPayment {
  status: PaymentStatus;
  method?: PaymentMethod | null;
  amountCents?: number | null;
  note?: string | null;
  paidAt?: string | null;
  stripePaymentIntentId?: string | null;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  check: "Check",
  other: "Other",
  stripe: "Stripe",
};

/** Cents still owed. A paid RO owes nothing regardless of what was collected. */
export function roBalanceCents(total: number, payment: RoPayment | null | undefined): number {
  return payment?.status === "paid" ? 0 : total;
}

type ManualMethod = Exclude<PaymentMethod, "stripe">;

export interface MarkPaidModalProps {
  opened: boolean;
  onClose: () => void;
  repairOrderId: string;
  /** Cents owed; prefilled as the amount collected. */
  balanceCents: number;
  onPaid: () => void;
}

/**
 * "Mark paid" for cash / in-person card / check shops. Records the method and
 * what was collected on the RO so lifetime spend and the board read right.
 */
export function MarkPaidModal({ opened, onClose, repairOrderId, balanceCents, onPaid }: MarkPaidModalProps) {
  const [method, setMethod] = useState<ManualMethod>("cash");
  const [amountDollars, setAmountDollars] = useState<number | string>(balanceCents / 100);
  const [note, setNote] = useState("");

  // Re-seed each time it opens so a stale draft never carries across ROs.
  useEffect(() => {
    if (opened) {
      setMethod("cash");
      setAmountDollars(balanceCents / 100);
      setNote("");
    }
  }, [opened, balanceCents]);

  const markPaid = useMutation({
    mutationFn: () =>
      api.post(`/repair-orders/${repairOrderId}/mark-paid`, {
        paid: true,
        method,
        amountCents: Math.round(Number(amountDollars || 0) * 100),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      notifySuccess(`Marked paid — ${PAYMENT_METHOD_LABELS[method].toLowerCase()}.`);
      onPaid();
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't mark paid" }),
  });

  const amountCents = Math.round(Number(amountDollars || 0) * 100);

  return (
    <Modal opened={opened} onClose={onClose} title="Mark paid" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Balance due {formatMoney(balanceCents)}. Recording this here doesn't move any money —
          it just closes the books on this RO.
        </Text>
        <SegmentedControl
          fullWidth
          value={method}
          onChange={(v) => setMethod(v as ManualMethod)}
          data={[
            { value: "cash", label: "Cash" },
            { value: "card", label: "Card" },
            { value: "check", label: "Check" },
            { value: "other", label: "Other" },
          ]}
        />
        <NumberInput
          label="Amount collected"
          prefix="$"
          min={0}
          decimalScale={2}
          fixedDecimalScale
          thousandSeparator
          value={amountDollars}
          onChange={setAmountDollars}
        />
        {amountCents < balanceCents && amountCents > 0 && (
          <Text size="xs" c="orange.7">
            {formatMoney(balanceCents - amountCents)} less than the total — fine if you knocked
            something off. The RO still closes as paid.
          </Text>
        )}
        <TextInput
          label="Note"
          placeholder="Check #1042, paid by wife, etc."
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => markPaid.mutate()}
            loading={markPaid.isPending}
            disabled={amountCents <= 0 && balanceCents > 0}
          >
            Mark paid
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
