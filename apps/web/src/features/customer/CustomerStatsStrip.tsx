import { Card, Group, ScrollArea, Stack, Text } from "@mantine/core";
import { formatMoney, relativeTime } from "../../lib/format";

interface Props {
  vehicleCount: number;
  roCount: number;
  lifetimeSpendCents: number;
  lastVisitAt: string | Date | null;
}

export function CustomerStatsStrip({ vehicleCount, roCount, lifetimeSpendCents, lastVisitAt }: Props) {
  const chips: Array<{ label: string; value: string }> = [
    { label: "Lifetime spend", value: formatMoney(lifetimeSpendCents) },
    { label: "ROs", value: String(roCount) },
    { label: "Vehicles", value: String(vehicleCount) },
    { label: "Last visit", value: lastVisitAt ? relativeTime(lastVisitAt) : "—" },
  ];

  return (
    <ScrollArea type="never" offsetScrollbars={false}>
      <Group gap="sm" wrap="nowrap" style={{ minWidth: "max-content" }}>
        {chips.map((c) => (
          <Card
            key={c.label}
            withBorder
            padding="sm"
            radius="md"
            style={{ minWidth: 130, flexShrink: 0 }}
          >
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                {c.label}
              </Text>
              <Text fw={700} size="lg">
                {c.value}
              </Text>
            </Stack>
          </Card>
        ))}
      </Group>
    </ScrollArea>
  );
}
