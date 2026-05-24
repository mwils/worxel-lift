import { Link } from "react-router-dom";
import { ActionIcon, Badge, CopyButton, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy, IconPhone } from "@tabler/icons-react";
import { formatPhone } from "../../lib/format";

interface Vehicle {
  id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  mileage: number | null;
  plate: string | null;
  color: string | null;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
}

interface Props {
  vehicle: Vehicle;
  customer: Customer | null;
}

export function VehicleHeader({ vehicle: v, customer }: Props) {
  const headline = [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
  const ownerName = customer ? [customer.firstName, customer.lastName].filter(Boolean).join(" ") : null;

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={4}>
          <Title order={2}>{headline}</Title>
          {v.trim && (
            <Text c="dimmed" size="sm">
              {v.trim}
              {v.color ? ` · ${v.color}` : ""}
            </Text>
          )}
        </Stack>
        {v.plate && (
          <Badge variant="filled" size="lg">
            {v.plate}
          </Badge>
        )}
      </Group>

      {v.vin && (
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" c="dimmed" style={{ fontFamily: "ui-monospace, monospace" }}>
            VIN {v.vin}
          </Text>
          <CopyButton value={v.vin} timeout={1500}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? "Copied" : "Copy VIN"}>
                <ActionIcon variant="subtle" size="sm" onClick={copy} aria-label="Copy VIN">
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
      )}

      <Group gap="md">
        {v.mileage != null && (
          <Text size="sm" c="dimmed">
            {v.mileage.toLocaleString()} mi
          </Text>
        )}
        {customer && (
          <Group gap={6} wrap="nowrap">
            <Text size="sm">
              Owner: <Text component={Link as any} to={`/customers/${customer.id}`} inherit>{ownerName}</Text>
            </Text>
            <ActionIcon
              component="a"
              href={`tel:${customer.phone}`}
              variant="subtle"
              size="sm"
              aria-label="Call owner"
            >
              <IconPhone size={14} />
            </ActionIcon>
            <Text size="sm" c="dimmed">
              {formatPhone(customer.phone)}
            </Text>
          </Group>
        )}
      </Group>
    </Stack>
  );
}
