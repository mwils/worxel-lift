import { useEffect, useState } from "react";
import { Button, Group, Modal, NumberInput, Stack, Text } from "@mantine/core";

export type MileageValues = { mileageIn?: number | null; mileageOut?: number | null };

interface Props {
  opened: boolean;
  onClose: () => void;
  title: string;
  /** Short line under the title — why we're asking. */
  hint?: string;
  /** Which readings to show. `out` is the one-field pickup prompt. */
  fields: "in" | "out" | "both";
  mileageIn: number | null;
  mileageOut: number | null;
  /** Prefill for an empty "out" field — the car's last known reading. */
  suggestOut?: number | null;
  loading?: boolean;
  submitLabel?: string;
  /** Shown as a secondary button when the step can be skipped (pickup). */
  onSkip?: () => void;
  onSubmit: (values: MileageValues) => void;
}

function asNumber(v: string | number): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  const n = Number(String(v).replace(/[^0-9]/g, ""));
  return v === "" || !Number.isFinite(n) ? null : n;
}

/**
 * Odometer entry. Kept to one or two fields with no validation beyond "a
 * number" — Mike reads it off the dash and moves on. Clearing a field sends
 * null so a fat-fingered reading can be removed.
 */
export function MileageModal({
  opened,
  onClose,
  title,
  hint,
  fields,
  mileageIn,
  mileageOut,
  suggestOut,
  loading,
  submitLabel = "Save",
  onSkip,
  onSubmit,
}: Props) {
  const [inDraft, setInDraft] = useState<string | number>("");
  const [outDraft, setOutDraft] = useState<string | number>("");

  useEffect(() => {
    if (!opened) return;
    setInDraft(mileageIn ?? "");
    setOutDraft(mileageOut ?? suggestOut ?? "");
  }, [opened, mileageIn, mileageOut, suggestOut]);

  const showIn = fields === "in" || fields === "both";
  const showOut = fields === "out" || fields === "both";

  const submit = () => {
    const values: MileageValues = {};
    if (showIn) values.mileageIn = asNumber(inDraft);
    if (showOut) values.mileageOut = asNumber(outDraft);
    onSubmit(values);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered>
      <Stack>
        {hint && (
          <Text size="sm" c="dimmed">
            {hint}
          </Text>
        )}
        {showIn && (
          <NumberInput
            label="Mileage in"
            placeholder="Odometer at drop-off"
            min={0}
            max={9_999_999}
            thousandSeparator=","
            allowDecimal={false}
            allowNegative={false}
            value={inDraft}
            onChange={setInDraft}
            data-autofocus
          />
        )}
        {showOut && (
          <NumberInput
            label="Mileage out"
            placeholder="Odometer at pickup"
            min={0}
            max={9_999_999}
            thousandSeparator=","
            allowDecimal={false}
            allowNegative={false}
            value={outDraft}
            onChange={setOutDraft}
            data-autofocus={!showIn}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        )}
        <Group justify="flex-end">
          {onSkip ? (
            <Button variant="default" onClick={onSkip} disabled={loading}>
              Skip
            </Button>
          ) : (
            <Button variant="default" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button onClick={submit} loading={loading}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
