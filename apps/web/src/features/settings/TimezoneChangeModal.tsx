import { useState } from "react";
import { Button, Group, Modal, Radio, Stack, Text } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";

export type AppointmentMode = "keep_clock" | "keep_instant";

/** Settings has counted upcoming visits and needs the owner to pick a mode. */
export interface TimezoneChangeRequest {
  count: number;
  fromTz: string;
  toTz: string;
}

/** What PATCH /shop reports back after a timezone change. */
export interface AppointmentShift {
  mode: AppointmentMode;
  affected: number;
  roIds: string[];
  previousTimezone: string;
  timezone: string;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** "America/New_York" → "New York" for the modal copy. */
function zoneLabel(tz: string) {
  return tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
}

/**
 * Two-step guard for changing the shop timezone when visits are already on
 * the books (QA round-2 M1).
 *
 *  1. `request` set → ask keep-clock vs keep-instant. Keep-clock is the
 *     default because it's what a shop means when fixing a wrong zone.
 *  2. `shift` set (keep_instant, affected > 0) → the customers' confirmation
 *     texts now disagree with the board. Offer one tap to send corrected
 *     times. Nothing is sent without that tap.
 */
export function TimezoneChangeModal(props: {
  request: TimezoneChangeRequest | null;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (mode: AppointmentMode) => void;
  shift: AppointmentShift | null;
  onShiftDone: () => void;
}) {
  const { request, saving, onCancel, onConfirm, shift, onShiftDone } = props;
  const [mode, setMode] = useState<AppointmentMode>("keep_clock");

  const sendNotices = useMutation({
    mutationFn: (s: AppointmentShift) =>
      api.post<{ sent: number; skipped: number }>("/shop/appointment-notices", {
        roIds: s.roIds,
        previousTimezone: s.previousTimezone,
      }),
    onSuccess: (res) => {
      notifications.show({
        color: "green",
        message:
          res.skipped > 0
            ? `Sent corrected times to ${plural(res.sent, "customer")} (${res.skipped} opted out or already past).`
            : `Sent corrected times to ${plural(res.sent, "customer")}.`,
      });
      onShiftDone();
    },
    onError: (err) => notifyError(err, { title: "Couldn't send corrected times" }),
  });

  const showNotice = !!shift && shift.mode === "keep_instant" && shift.affected > 0;

  return (
    <>
      <Modal
        opened={!!request}
        onClose={onCancel}
        title="Upcoming appointments"
        closeOnClickOutside={!saving}
        withCloseButton={!saving}
      >
        {request && (
          <Stack>
            <Text size="sm">
              You have {plural(request.count, "upcoming appointment")}. Switching from{" "}
              {zoneLabel(request.fromTz)} to {zoneLabel(request.toTz)} time — keep them at the
              same clock time or the same instant?
            </Text>
            <Radio.Group value={mode} onChange={(v) => setMode(v as AppointmentMode)}>
              <Stack gap="xs">
                <Radio
                  value="keep_clock"
                  label="Same clock time (recommended)"
                  description="9:00 AM stays 9:00 AM. Matches what customers were already told."
                />
                <Radio
                  value="keep_instant"
                  label="Same instant"
                  description="The times on your board move to the new zone. Customers were texted the old times — you'll be offered a correction text next."
                />
              </Stack>
            </Radio.Group>
            <Group justify="flex-end">
              <Button variant="default" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => onConfirm(mode)} loading={saving}>
                Save timezone
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Modal
        opened={showNotice}
        onClose={onShiftDone}
        title="Text customers the corrected times?"
        closeOnClickOutside={!sendNotices.isPending}
        withCloseButton={!sendNotices.isPending}
      >
        {shift && (
          <Stack>
            <Text size="sm">
              {plural(shift.affected, "customer")} got a confirmation text with the old time.
              Each one gets a short correction like:
            </Text>
            <Text size="sm" c="dimmed" style={{ fontStyle: "italic" }}>
              &ldquo;Correction from your shop: your visit is Thu Sep 10 at 10:00 AM (not 9:00
              AM). Need to change it? …&rdquo;
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={onShiftDone} disabled={sendNotices.isPending}>
                Not now
              </Button>
              <Button onClick={() => sendNotices.mutate(shift)} loading={sendNotices.isPending}>
                Send to {plural(shift.affected, "customer")}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}
