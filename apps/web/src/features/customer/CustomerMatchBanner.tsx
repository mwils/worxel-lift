import { Alert, Badge, Button, Group, Stack, Text } from "@mantine/core";
import { IconUserCheck } from "@tabler/icons-react";
import { formatPhone } from "../../lib/format";
import type { CustomerMatch } from "../../lib/useVoiceTranscribe";

export interface CustomerMatchBannerProps {
  matches: CustomerMatch[];
  onUseExisting: (id: string) => void;
  onDismiss: () => void;
}

/**
 * Shown above CustomerForm when voice-extraction found one or more existing
 * customers in the shop that resemble the dictated draft. Owner picks "Use
 * existing" (pivots the wizard to that customer) or "Create new anyway"
 * (dismisses the banner, leaves the form ready to submit).
 */
export function CustomerMatchBanner({
  matches,
  onUseExisting,
  onDismiss,
}: CustomerMatchBannerProps) {
  const [top, ...rest] = matches;
  if (!top) return null;

  return (
    <Alert
      color={top.confidence === "exact" ? "blue" : "yellow"}
      icon={<IconUserCheck size={18} />}
      title={
        top.confidence === "exact"
          ? "Looks like this customer already exists"
          : "Possible existing customer"
      }
    >
      <Stack gap="xs">
        <MatchRow match={top} onUseExisting={onUseExisting} />
        {rest.map((m) => (
          <MatchRow key={m.id} match={m} onUseExisting={onUseExisting} />
        ))}
        <Group justify="flex-end">
          <Button variant="subtle" size="xs" onClick={onDismiss}>
            Create new anyway
          </Button>
        </Group>
      </Stack>
    </Alert>
  );
}

function MatchRow({
  match,
  onUseExisting,
}: {
  match: CustomerMatch;
  onUseExisting: (id: string) => void;
}) {
  const name = [match.firstName, match.lastName].filter(Boolean).join(" ");
  return (
    <Group justify="space-between" align="center" wrap="nowrap">
      <Stack gap={2}>
        <Group gap="xs">
          <Text fw={600}>{name}</Text>
          <Badge size="xs" variant="light" color={match.confidence === "exact" ? "blue" : "yellow"}>
            {match.confidence === "exact" ? "exact" : "maybe"}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {formatPhone(match.phone)}
          {match.email ? ` · ${match.email}` : ""}
        </Text>
      </Stack>
      <Button size="xs" onClick={() => onUseExisting(match.id)}>
        Use existing
      </Button>
    </Group>
  );
}
