import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Anchor, Button, Checkbox, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSend } from "@tabler/icons-react";
import type { ReadyTextMode, RoStatus } from "@lift/shared/constants";
import { api } from "../../lib/api";
import type { BookingHour } from "../../lib/auth";
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
  /** Sum of succeeded payments — a pickup with money in is a receipt text. */
  collectedCents: number;
  /** Shop's Stripe Connect account can take charges → append a pay link. */
  paymentsReady: boolean;
  /** prompt (default) / auto / off — governs the Ready text only. */
  readyTextMode: ReadyTextMode;
  /** For the "We're open until 5 today" line on the Ready text. */
  businessHours?: BookingHour[];
  timezone: string;
  onSent: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 0 = Sunday … 6 = Saturday, as the SHOP reads it — not the browser. */
function weekdayInTz(tz: string): number {
  try {
    const short = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(
      new Date()
    );
    return WEEKDAYS.indexOf(short);
  } catch {
    return new Date().getDay();
  }
}

/** "17:00" → "5", "17:30" → "5:30", "11:00" → "11 AM". Afternoon needs no suffix. */
function spokenClock(hhmm: string): string | null {
  const parts = hhmm.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || h < 0 || h > 23) return null;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mins = Number.isFinite(m) && m ? `:${String(m).padStart(2, "0")}` : "";
  return h < 12 ? `${h12}${mins} AM` : `${h12}${mins}`;
}

/**
 * "We're open until 5 today." from the shop's own business hours. Null — and
 * the sentence is left out entirely — when hours aren't set, today is marked
 * closed, or the close time is unparseable. Never guesses.
 */
function todayHoursSentence(hours: BookingHour[] | undefined, tz: string): string | null {
  if (!hours || hours.length === 0) return null;
  const today = hours.find((h) => h.day === weekdayInTz(tz));
  if (!today || today.closed || !today.close) return null;
  const clock = spokenClock(today.close);
  return clock ? `We're open until ${clock} today.` : null;
}

function vehicleWords(vehicleSummary: string): string {
  return vehicleSummary && vehicleSummary !== "—" ? vehicleSummary : "vehicle";
}

export function buildReadyBody(args: {
  firstName: string;
  vehicleSummary: string;
  shopName: string;
  balanceCents: number;
  payUrl: string | null;
  hoursSentence: string | null;
}): string {
  const veh = vehicleWords(args.vehicleSummary);
  const lines = [`Hi ${args.firstName} — your ${veh} is ready for pickup at ${args.shopName}.`];
  if (args.balanceCents > 0) lines.push(`${formatMoney(args.balanceCents)} due.`);
  if (args.hoursSentence) lines.push(args.hoursSentence);
  lines.push("Reply here with any questions.");
  let body = lines.join(" ");
  if (args.payUrl && args.balanceCents > 0) body += `\n\nPay here: ${args.payUrl}`;
  return body;
}

/**
 * Pickup copy. With a payment on the RO this becomes the receipt text — one
 * link to this visit's receipt, one to every visit — and drops the "reply with
 * questions" line so two URLs plus the greeting still fit in two segments.
 */
export function buildPickedUpBody(args: {
  firstName: string;
  vehicleSummary: string;
  shopName: string;
  balanceCents: number;
  receiptUrl: string | null;
  historyUrl: string | null;
}): string {
  const veh = vehicleWords(args.vehicleSummary);
  if (args.receiptUrl) {
    const lines = [
      `Hi ${args.firstName} — thanks for picking up your ${veh} from ${args.shopName}.`,
      `Receipt: ${args.receiptUrl}`,
    ];
    if (args.historyUrl) lines.push(`Past visits: ${args.historyUrl}`);
    if (args.balanceCents > 0) {
      lines.push(`${formatMoney(args.balanceCents)} is still open on this one.`);
    }
    return lines.join(" ");
  }
  const lines = [`Hi ${args.firstName} — thanks for picking up your ${veh} from ${args.shopName}.`];
  if (args.balanceCents > 0) {
    lines.push(`There's still ${formatMoney(args.balanceCents)} open on this one.`);
  }
  lines.push("Reply here with any questions.");
  return lines.join(" ");
}

/**
 * The "text the customer" step right after an RO lands in Ready or Picked up.
 *
 * Ready follows `shop.settings.readyTextMode`:
 *   prompt (default) — prefilled, editable, nothing sends until Send is tapped
 *   auto             — the same copy goes out on its own, toasted with the body
 *                      it sent and a one-tap way back to prompt mode
 *   off              — nothing at all
 * Only the owner ticking "Don't ask again" inside this dialog can reach `auto`,
 * so no copy ever sends that they haven't read once.
 *
 * Picked up always prompts — a receipt is not something to fire blind.
 *
 * Every send goes through POST /messages/send so it lands in the customer's
 * thread; auto-mode sends carry `automated: true` so the inbox doesn't read
 * them as the shop having replied.
 */
export function StatusTextPrompt(props: StatusTextPromptProps) {
  const {
    status,
    onClose,
    repairOrderId,
    customer,
    vehicleSummary,
    shopName,
    balanceCents,
    collectedCents,
    paymentsReady,
    readyTextMode,
    businessHours,
    timezone,
    onSent,
  } = props;
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  // One auto-send per (RO, status) landing, whatever React does with effects.
  const autoSentKey = useRef<string | null>(null);

  const isReady = status === "ready";
  const autoReady = isReady && readyTextMode === "auto";
  const silentReady = isReady && readyTextMode === "off";

  const setMode = useMutation({
    mutationFn: (mode: ReadyTextMode) => api.patch("/shop", { settings: { readyTextMode: mode } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
    onError: (err) => notifyError(err, { title: "Couldn't save that preference" }),
  });

  const autoSend = useMutation({
    mutationFn: (body: string) =>
      api.post("/messages/send", {
        customerId: customer!.id,
        repairOrderId,
        body,
        aiDrafted: false,
        automated: true,
      }),
    onSuccess: (_res, body) => {
      // Closest thing to Undo that exists — a sent SMS can't be recalled, so
      // the toast shows exactly what went out and offers to stop the next one.
      const toastId = `ready-text-${repairOrderId}`;
      notifications.show({
        id: toastId,
        color: "green",
        title: `Texted ${customer?.firstName ?? "the customer"} — it's ready`,
        autoClose: 12_000,
        message: (
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {body}
            </Text>
            <Anchor
              component="button"
              type="button"
              size="xs"
              onClick={() => {
                setMode.mutate("prompt");
                notifications.hide(toastId);
              }}
            >
              Ask me first next time
            </Anchor>
          </Stack>
        ),
      });
      onSent();
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't send the ready text" }),
  });

  // Compose the draft each time the prompt opens. The pay link and the receipt
  // link each need a round trip to mint a token, so the body lands in two
  // beats; in auto mode we wait for the final body before sending.
  useEffect(() => {
    // Prompt closed — re-arm, so moving the same RO back to Ready later texts
    // again instead of being swallowed by the one-send-per-landing guard.
    if (!status || !customer) {
      autoSentKey.current = null;
      return;
    }
    if (silentReady) {
      onClose();
      return;
    }
    const key = `${repairOrderId}:${status}`;
    if (autoReady && autoSentKey.current === key) return;

    let cancelled = false;
    setDontAskAgain(false);
    setPreparing(true);

    const compose = async (): Promise<string> => {
      if (status === "ready") {
        const hoursSentence = todayHoursSentence(businessHours, timezone);
        const base = { firstName: customer.firstName, vehicleSummary, shopName, balanceCents, hoursSentence };
        if (!autoReady) setDraft(buildReadyBody({ ...base, payUrl: null }));
        if (!paymentsReady || balanceCents <= 0) return buildReadyBody({ ...base, payUrl: null });
        try {
          const res = await api.post<{ url: string }>("/payments/create-link", { repairOrderId });
          return buildReadyBody({ ...base, payUrl: res.url });
        } catch {
          // No link is fine — the amount line still tells them what's due.
          return buildReadyBody({ ...base, payUrl: null });
        }
      }

      const base = { firstName: customer.firstName, vehicleSummary, shopName, balanceCents };
      setDraft(buildPickedUpBody({ ...base, receiptUrl: null, historyUrl: null }));
      // Nothing collected → no receipt to point at; keep the plain thank-you.
      if (collectedCents <= 0) {
        return buildPickedUpBody({ ...base, receiptUrl: null, historyUrl: null });
      }
      try {
        const res = await api.post<{ url: string; historyUrl?: string | null }>(
          `/repair-orders/${repairOrderId}/receipt-link`
        );
        return buildPickedUpBody({
          ...base,
          receiptUrl: res.url,
          historyUrl: res.historyUrl ?? null,
        });
      } catch {
        return buildPickedUpBody({ ...base, receiptUrl: null, historyUrl: null });
      }
    };

    compose()
      .then((body) => {
        if (cancelled) return;
        if (autoReady) {
          autoSentKey.current = key;
          autoSend.mutate(body);
        } else {
          setDraft(body);
        }
      })
      .finally(() => {
        if (!cancelled) setPreparing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, repairOrderId, balanceCents, collectedCents, autoReady, silentReady]);

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
      if (isReady && dontAskAgain) setMode.mutate("auto");
      onSent();
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't send text" }),
  });

  const title =
    status === "picked_up"
      ? collectedCents > 0
        ? `Text ${customer?.firstName ?? "customer"} their receipt?`
        : `Text ${customer?.firstName ?? "customer"} a thank-you?`
      : `Text ${customer?.firstName ?? "customer"} it's ready?`;

  return (
    <Modal
      opened={!!status && !!customer && !autoReady && !silentReady}
      onClose={onClose}
      title={title}
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
          disabled={preparing}
        />
        {isReady && (
          <Checkbox
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.currentTarget.checked)}
            label="Don't ask again — send automatically"
            description="Next time a car hits Ready, Lift texts this for you and shows you what it sent. Change it any time in Settings."
          />
        )}
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
