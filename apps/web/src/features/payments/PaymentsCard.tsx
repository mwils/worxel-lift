import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { IconDotsVertical, IconReceipt, IconSend } from "@tabler/icons-react";
import { PAYMENT_METHOD_LABELS } from "@lift/shared/constants";
import { api } from "../../lib/api";
import { formatMoney, formatRoNumber, formatVisit } from "../../lib/format";
import { notifyError, notifySuccess } from "../../lib/notify";
import type { PaymentRow, RoPayment } from "./MarkPaidModal";

export interface PaymentsCardProps {
  repairOrderId: string;
  roNumber: number;
  totalCents: number;
  payment: RoPayment;
  payments: PaymentRow[];
  tz: string;
  customer: { id: string; firstName: string } | null;
  vehicleSummary: string;
  shopName: string;
  onChanged: () => void;
  onTexted: () => void;
}

function methodLabel(row: PaymentRow): string {
  const base = row.method ? PAYMENT_METHOD_LABELS[row.method] : "Payment";
  return row.last4 ? `${base} ···${row.last4}` : base;
}

/**
 * Every payment against the RO — method, amount, when, and the owner's note —
 * plus collected / balance. Undo (mis-tap) and Record refund live here per
 * row instead of a single "unpaid" flag, so a second cash payment against a
 * partial never wipes the first one.
 */
export function PaymentsCard(props: PaymentsCardProps) {
  const { repairOrderId, roNumber, totalCents, payment, payments, tz, customer, vehicleSummary, shopName, onChanged, onTexted } =
    props;
  const [voidTarget, setVoidTarget] = useState<{ row: PaymentRow; kind: "void" | "refund" } | null>(null);
  const [voidNote, setVoidNote] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);

  const voidPayment = useMutation({
    mutationFn: ({ row, kind }: { row: PaymentRow; kind: "void" | "refund" }) =>
      api.post(`/repair-orders/${repairOrderId}/payments/${row.id}/void`, {
        kind,
        note: voidNote.trim() || undefined,
      }),
    onSuccess: (_res, vars) => {
      notifySuccess(vars.kind === "refund" ? "Refund recorded." : "Payment undone.");
      setVoidTarget(null);
      setVoidNote("");
      onChanged();
    },
    onError: (err) => notifyError(err, { title: "Couldn't update payment" }),
  });

  if (payments.length === 0 && payment.collectedCents <= 0) return null;

  return (
    <Card withBorder>
      <Group justify="space-between" mb="xs" wrap="wrap">
        <Group gap="xs">
          <IconReceipt size={18} />
          <Title order={5}>Payments</Title>
        </Group>
        {payment.collectedCents > 0 && customer && (
          <Button
            variant="default"
            size="xs"
            leftSection={<IconSend size={14} />}
            onClick={() => setReceiptOpen(true)}
          >
            Text receipt
          </Button>
        )}
      </Group>

      <Stack gap="xs">
        {payments.length === 0 && (
          // Legacy round-1 mark-paid: the row gets created on the next payment
          // action or by the backfill; show what the RO knows meanwhile.
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={0}>
              <Text size="sm">
                {payment.method ? PAYMENT_METHOD_LABELS[payment.method] : "Payment"}
                {payment.paidAt ? ` · ${formatVisit(payment.paidAt, tz)}` : ""}
              </Text>
              {payment.note && (
                <Text size="xs" c="dimmed">
                  {payment.note}
                </Text>
              )}
            </Stack>
            <Text size="sm" fw={500}>
              {formatMoney(payment.collectedCents)}
            </Text>
          </Group>
        )}
        {payments.map((row) => {
          const counted = row.status === "succeeded";
          const dead = row.status === "voided" || row.status === "refunded";
          const pending = !counted && !dead;
          return (
            <Group key={row.id} justify="space-between" align="flex-start" wrap="nowrap">
              <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                <Group gap={6} wrap="nowrap">
                  <Text size="sm" td={row.status === "voided" ? "line-through" : undefined}>
                    {methodLabel(row)}
                    {row.paidAt ? ` · ${formatVisit(row.paidAt, tz)}` : ""}
                  </Text>
                  {row.status === "voided" && (
                    <Badge size="xs" variant="light" color="gray">
                      Undone
                    </Badge>
                  )}
                  {row.status === "refunded" && (
                    <Badge size="xs" variant="light" color="red">
                      Refunded
                    </Badge>
                  )}
                  {pending && (
                    <Badge size="xs" variant="light" color="blue">
                      Processing
                    </Badge>
                  )}
                </Group>
                {row.note && (
                  <Text size="xs" c="dimmed">
                    {row.note}
                  </Text>
                )}
                {dead && row.voidNote && (
                  <Text size="xs" c="dimmed">
                    {row.status === "refunded" ? "Refund: " : "Undo: "}
                    {row.voidNote}
                  </Text>
                )}
              </Stack>
              <Group gap={4} wrap="nowrap">
                <Text size="sm" fw={500} td={row.status === "voided" ? "line-through" : undefined}>
                  {formatMoney(row.amountCents)}
                </Text>
                {counted && (
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <Button variant="subtle" color="gray" size="compact-xs" px={4} aria-label="Payment actions">
                        <IconDotsVertical size={14} />
                      </Button>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {!row.stripe && (
                        <Menu.Item onClick={() => setVoidTarget({ row, kind: "void" })}>
                          Undo — entered by mistake
                        </Menu.Item>
                      )}
                      <Menu.Item color="red" onClick={() => setVoidTarget({ row, kind: "refund" })}>
                        Record refund
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            </Group>
          );
        })}
        <Divider />
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Collected
          </Text>
          <Text size="sm">{formatMoney(payment.collectedCents)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" fw={600} c={payment.balanceCents > 0 ? "orange.7" : undefined}>
            {payment.balanceCents > 0 ? "Balance due" : "Balance"}
          </Text>
          <Text size="sm" fw={600} c={payment.balanceCents > 0 ? "orange.7" : undefined}>
            {formatMoney(payment.balanceCents)}
          </Text>
        </Group>
      </Stack>

      {/* Undo / refund confirmation */}
      <Modal
        opened={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        title={voidTarget?.kind === "refund" ? "Record refund" : "Undo payment"}
        centered
      >
        {voidTarget && (
          <Stack>
            <Text size="sm">
              {voidTarget.kind === "refund" ? (
                <>
                  Marks the {formatMoney(voidTarget.row.amountCents)} {methodLabel(voidTarget.row).toLowerCase()}{" "}
                  payment as refunded. This doesn't move any money
                  {voidTarget.row.stripe ? " — issue the refund in Stripe first" : ""}.
                </>
              ) : (
                <>
                  Removes the {formatMoney(voidTarget.row.amountCents)}{" "}
                  {methodLabel(voidTarget.row).toLowerCase()} entry as if it never happened. Use this for a
                  mis-tap; use Record refund if you actually handed money back.
                </>
              )}
            </Text>
            <TextInput
              label="Note"
              placeholder={voidTarget.kind === "refund" ? "Why it was refunded" : "Wrong RO, typo, etc."}
              maxLength={200}
              value={voidNote}
              onChange={(e) => setVoidNote(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setVoidTarget(null)}>
                Cancel
              </Button>
              <Button
                color={voidTarget.kind === "refund" ? "red" : undefined}
                onClick={() => voidPayment.mutate(voidTarget)}
                loading={voidPayment.isPending}
              >
                {voidTarget.kind === "refund" ? "Record refund" : "Undo payment"}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <TextReceiptModal
        opened={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        repairOrderId={repairOrderId}
        roNumber={roNumber}
        customer={customer}
        vehicleSummary={vehicleSummary}
        shopName={shopName}
        balanceCents={payment.balanceCents}
        totalCents={totalCents}
        onSent={onTexted}
      />
    </Card>
  );
}

interface TextReceiptModalProps {
  opened: boolean;
  onClose: () => void;
  repairOrderId: string;
  roNumber: number;
  customer: { id: string; firstName: string } | null;
  vehicleSummary: string;
  shopName: string;
  balanceCents: number;
  totalCents: number;
  onSent: () => void;
}

function buildReceiptBody(args: {
  firstName: string;
  vehicleSummary: string;
  shopName: string;
  roNumber: number;
  balanceCents: number;
  url: string;
  historyUrl?: string | null;
}): string {
  const veh = args.vehicleSummary && args.vehicleSummary !== "—" ? args.vehicleSummary : "vehicle";
  const lines = [
    `Hi ${args.firstName} — here's your receipt from ${args.shopName} for your ${veh} (${formatRoNumber(
      args.roNumber
    )}): ${args.url}`,
  ];
  if (args.balanceCents > 0) lines.push(`${formatMoney(args.balanceCents)} is still open on this one.`);
  if (args.historyUrl) lines.push(`Your full history: ${args.historyUrl}`);
  lines.push("Reply here with any questions.");
  return lines.join(" ");
}

/**
 * Prefilled, editable, never auto-sent. Mints the RO's receipt link, drops it
 * in the draft, and sends through POST /messages/send so it lands in the
 * customer's thread like any other owner text.
 */
function TextReceiptModal(props: TextReceiptModalProps) {
  const { opened, onClose, repairOrderId, roNumber, customer, vehicleSummary, shopName, balanceCents, onSent } = props;
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (!opened || !customer) return;
    let cancelled = false;
    setPreparing(true);
    api
      .post<{ url: string; historyUrl?: string | null }>(
        `/repair-orders/${repairOrderId}/receipt-link`
      )
      .then((res) => {
        if (cancelled) return;
        setUrl(res.url);
        setDraft(
          buildReceiptBody({
            firstName: customer.firstName,
            vehicleSummary,
            shopName,
            roNumber,
            balanceCents,
            url: res.url,
            historyUrl: res.historyUrl,
          })
        );
      })
      .catch((err) => {
        if (!cancelled) notifyError(err, { title: "Couldn't make the receipt link" });
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, repairOrderId, balanceCents]);

  const send = useMutation({
    mutationFn: () =>
      api.post("/messages/send", {
        customerId: customer!.id,
        repairOrderId,
        body: draft.trim(),
        aiDrafted: false,
      }),
    onSuccess: () => {
      notifySuccess(`Texted the receipt to ${customer?.firstName ?? "the customer"}.`);
      onSent();
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't send text" }),
  });

  return (
    <Modal opened={opened && !!customer} onClose={onClose} title="Text receipt" size="lg">
      <Stack>
        <Text size="sm" c="dimmed">
          Edit before sending. Nothing goes out until you tap Send.
          {url && (
            <>
              {" "}
              <Anchor href={url} target="_blank" rel="noreferrer" size="sm">
                Open / print the receipt
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
