import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Button,
  Checkbox,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  MANUAL_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type ManualPaymentMethod,
  type PaymentMethod,
  type PaymentStatus,
} from "@lift/shared/constants";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { notifyError, notifySuccess } from "../../lib/notify";

export { PAYMENT_METHOD_LABELS };

/** `payment` block as returned by GET /repair-orders/:id — derived from Payment rows. */
export interface RoPayment {
  status: PaymentStatus;
  collectedCents: number;
  balanceCents: number;
  /** Latest counted payment, for the pill. */
  method?: PaymentMethod | null;
  amountCents?: number | null;
  note?: string | null;
  paidAt?: string | null;
  stripePaymentIntentId?: string | null;
}

/** One Payment row as returned in `payments[]`. */
export interface PaymentRow {
  id: string;
  amountCents: number;
  status: string; // succeeded | voided | refunded | (stripe intent states)
  method: PaymentMethod | null;
  last4: string | null;
  paidAt: string | null;
  note: string | null;
  voidedAt: string | null;
  voidNote: string | null;
  stripe: boolean;
}

export interface MarkPaidModalProps {
  opened: boolean;
  onClose: () => void;
  repairOrderId: string;
  /** Cents still owed; prefilled as the amount collected. */
  balanceCents: number;
  /** RO total, for the "of $X" copy. */
  totalCents: number;
  onPaid: () => void;
}

/**
 * "Mark paid" for cash / in-person card / check shops. Appends a payment row;
 * a short amount leaves the RO PARTIAL with the rest due unless the owner
 * explicitly writes the difference off (which adds a negative Discount line).
 */
export function MarkPaidModal({
  opened,
  onClose,
  repairOrderId,
  balanceCents,
  totalCents,
  onPaid,
}: MarkPaidModalProps) {
  const [method, setMethod] = useState<ManualPaymentMethod>("cash");
  const [amountDollars, setAmountDollars] = useState<number | string>(balanceCents / 100);
  const [note, setNote] = useState("");
  const [writeOff, setWriteOff] = useState(false);

  // Re-seed each time it opens so a stale draft never carries across ROs.
  useEffect(() => {
    if (opened) {
      setMethod("cash");
      setAmountDollars(balanceCents / 100);
      setNote("");
      setWriteOff(false);
    }
  }, [opened, balanceCents]);

  const amountCents = Math.round(Number(amountDollars || 0) * 100);
  const shortBy = Math.max(0, balanceCents - amountCents);
  const isShort = amountCents > 0 && shortBy > 0;
  const overBy = Math.max(0, amountCents - balanceCents);

  const markPaid = useMutation({
    mutationFn: () =>
      api.post(`/repair-orders/${repairOrderId}/mark-paid`, {
        method,
        amountCents,
        note: note.trim() || undefined,
        writeOffRemainder: isShort && writeOff,
      }),
    onSuccess: () => {
      const label = PAYMENT_METHOD_LABELS[method].toLowerCase();
      if (isShort && !writeOff) {
        notifySuccess(`Recorded ${formatMoney(amountCents)} ${label} — ${formatMoney(shortBy)} still due.`);
      } else {
        notifySuccess(`Paid — ${formatMoney(amountCents)} ${label}.`);
      }
      onPaid();
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't record payment" }),
  });

  const partialPaid = balanceCents < totalCents;

  return (
    <Modal opened={opened} onClose={onClose} title="Mark paid" centered>
      <Stack>
        <Text size="sm" c="dimmed">
          Balance due {formatMoney(balanceCents)}
          {partialPaid ? ` of ${formatMoney(totalCents)}` : ""}. Recording this here doesn't move any
          money — it just keeps the books straight on this RO.
        </Text>
        <SegmentedControl
          fullWidth
          value={method}
          onChange={(v) => setMethod(v as ManualPaymentMethod)}
          data={MANUAL_PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))}
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
        {isShort && (
          <Stack gap={6}>
            <Text size="xs" c="orange.7">
              {formatMoney(shortBy)} short. The RO stays <b>partial</b> with {formatMoney(shortBy)}{" "}
              due until you record the rest — unless you're knocking it off.
            </Text>
            <Checkbox
              checked={writeOff}
              onChange={(e) => setWriteOff(e.currentTarget.checked)}
              label={`Write off the rest (${formatMoney(shortBy)}) — adds a Discount line so the RO closes as paid`}
            />
          </Stack>
        )}
        {overBy > 0 && (
          <Text size="xs" c="red.7">
            That's {formatMoney(overBy)} more than what's owed. Enter up to {formatMoney(balanceCents)}.
          </Text>
        )}
        <TextInput
          label="Note"
          placeholder="Check #1042, paid by wife, balance Friday…"
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
            disabled={amountCents <= 0 || overBy > 0}
          >
            {isShort && !writeOff ? "Record partial payment" : "Mark paid"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
