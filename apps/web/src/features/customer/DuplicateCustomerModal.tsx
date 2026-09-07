import { Badge, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { ApiError } from "../../lib/api";
import { formatPhone } from "../../lib/format";

export interface DuplicateCandidate {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
  reasons: Array<"name" | "email" | "vehicle">;
}

/**
 * POST /customers answers 409 with `possible_duplicates` when the phone is
 * new but the name (or email) matches someone on file. Returns the candidates
 * so the caller can prompt, or null for any other failure.
 */
export function duplicatesFromError(err: unknown): DuplicateCandidate[] | null {
  if (!(err instanceof ApiError) || err.status !== 409) return null;
  const details = (err.details as { error?: { details?: { reason?: string; candidates?: DuplicateCandidate[] } } })
    ?.error?.details;
  if (details?.reason !== "possible_duplicates") return null;
  return details.candidates ?? [];
}

const REASON_LABEL: Record<DuplicateCandidate["reasons"][number], string> = {
  name: "same name",
  email: "same email",
  vehicle: "same vehicle",
};

export interface DuplicateCustomerModalProps {
  opened: boolean;
  /** The name the owner just typed, for the "Is this the same …?" question. */
  typedName: string;
  candidates: DuplicateCandidate[];
  onUseExisting: (id: string) => void;
  onCreateAnyway: () => void;
  onClose: () => void;
  loading?: boolean;
}

/**
 * "Is this the same Dale O'Brien-Reyes?" — shown instead of silently making a
 * second record. Two ways out: open the one on file, or create anyway (their
 * kid, a namesake, a different phone that really is a different person).
 */
export function DuplicateCustomerModal({
  opened,
  typedName,
  candidates,
  onUseExisting,
  onCreateAnyway,
  onClose,
  loading,
}: DuplicateCustomerModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={typedName ? `Is this the same ${typedName}?` : "Is this the same person?"}
      centered
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {candidates.length === 1 ? "This customer is" : "These customers are"} already on file
          with a different phone number.
        </Text>
        {candidates.map((c) => (
          <Group key={c.id} justify="space-between" wrap="nowrap" align="center">
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="nowrap">
                <Text fw={600}>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</Text>
                {c.reasons.map((r) => (
                  <Badge key={r} size="xs" variant="light" color="yellow">
                    {REASON_LABEL[r]}
                  </Badge>
                ))}
              </Group>
              <Text size="xs" c="dimmed" truncate>
                {formatPhone(c.phone)}
                {c.email ? ` · ${c.email}` : ""}
              </Text>
            </Stack>
            <Button size="xs" onClick={() => onUseExisting(c.id)} style={{ minHeight: 36 }}>
              Use existing
            </Button>
          </Group>
        ))}
        <Group justify="flex-end" mt="xs">
          <Button variant="subtle" onClick={onClose}>
            Go back
          </Button>
          <Button variant="default" loading={loading} onClick={onCreateAnyway}>
            Create anyway
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
