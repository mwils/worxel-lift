import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { formatMoney, relativeTime } from "../../lib/format";

interface Vehicle {
  id: string;
  archivedAt?: string | Date | null;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  plate: string | null;
  color: string | null;
  roCount: number;
  lastServicedAt: string | Date | null;
  lastConcern: string | null;
  lifetimeSpendCents: number;
}

/**
 * `action` is an optional control (e.g. Archive) rendered in the card's top
 * right. The whole card is a link, so the caller must stop propagation on
 * anything clickable it passes in.
 */
export function VehicleCard({ vehicle: v, action }: { vehicle: Vehicle; action?: ReactNode }) {
  const headline = [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
  return (
    <Card
      withBorder
      component={Link as any}
      to={`/vehicles/${v.id}`}
      style={{ textDecoration: "none", color: "inherit", minHeight: 44 }}
      padding="sm"
    >
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} lineClamp={1}>
            {headline}
          </Text>
          <Group gap="xs" wrap="nowrap">
            {v.archivedAt && (
              <Badge variant="light" color="gray">
                Archived
              </Badge>
            )}
            {v.plate && <Badge variant="light">{v.plate}</Badge>}
            {action}
          </Group>
        </Group>
        <Text size="sm" c="dimmed" lineClamp={1}>
          {v.vin ? `VIN ${v.vin}` : "No VIN"}
          {v.trim ? ` · ${v.trim}` : ""}
          {v.mileage != null ? ` · ${v.mileage.toLocaleString()} mi` : ""}
        </Text>
        <Group gap="md">
          <Text size="xs" c="dimmed">
            {v.roCount} {v.roCount === 1 ? "RO" : "ROs"} · {formatMoney(v.lifetimeSpendCents)} spent
          </Text>
          {v.lastServicedAt && (
            <Text size="xs" c="dimmed">
              Last: {relativeTime(v.lastServicedAt)}
            </Text>
          )}
        </Group>
        {v.lastConcern && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            "{v.lastConcern}"
          </Text>
        )}
      </Stack>
    </Card>
  );
}
