import { Alert, Badge, Button, Group, Stack, Text } from "@mantine/core";
import { IconCarSuv } from "@tabler/icons-react";
import type { VehicleMatch } from "../../lib/useVoiceTranscribe";

export interface VehicleMatchBannerProps {
  matches: VehicleMatch[];
  onUseExisting: (id: string) => void;
  onDismiss: () => void;
}

/**
 * Shown above VehicleForm when voice-extraction found one or more existing
 * vehicles in the shop that resemble the dictated draft. VIN/plate matches
 * are "exact"; customer + ymm matches are "maybe."
 */
export function VehicleMatchBanner({
  matches,
  onUseExisting,
  onDismiss,
}: VehicleMatchBannerProps) {
  const [top, ...rest] = matches;
  if (!top) return null;

  return (
    <Alert
      color={top.confidence === "exact" ? "blue" : "yellow"}
      icon={<IconCarSuv size={18} />}
      title={
        top.confidence === "exact"
          ? "Looks like this vehicle is already on file"
          : "Possible existing vehicle"
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
  match: VehicleMatch;
  onUseExisting: (id: string) => void;
}) {
  const summary =
    [match.year, match.make, match.model].filter(Boolean).join(" ") || "Vehicle";
  const ident = match.plate ?? match.vin ?? "—";
  return (
    <Group justify="space-between" align="center" wrap="nowrap">
      <Stack gap={2}>
        <Group gap="xs">
          <Text fw={600}>{summary}</Text>
          <Badge size="xs" variant="light" color={match.confidence === "exact" ? "blue" : "yellow"}>
            {match.confidence === "exact" ? "exact" : "maybe"}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {ident} · {match.customerName}
        </Text>
      </Stack>
      <Button size="xs" onClick={() => onUseExisting(match.id)}>
        Use existing
      </Button>
    </Group>
  );
}
