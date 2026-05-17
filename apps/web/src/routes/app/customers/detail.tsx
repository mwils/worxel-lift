import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconPlus } from "@tabler/icons-react";
import { api } from "../../../lib/api";
import { formatMoney, formatPhone, formatRoNumber, relativeTime } from "../../../lib/format";
import { VehicleForm } from "../../../features/vehicle/VehicleForm";
import type { z } from "zod";
import type { CreateVehicleDto } from "@lift/shared/dto";

interface CustomerHistory {
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
    notes: string | null;
  };
  vehicles: Array<{
    id: string;
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    mileage: number | null;
    plate: string | null;
    color: string | null;
  }>;
  repairOrders: Array<{
    id: string;
    number: number;
    status: string;
    concern: string | null;
    total: number;
    createdAt: string;
    updatedAt: string;
  }>;
  messages: Array<{
    id: string;
    direction: "in" | "out";
    body: string;
    sentAt: string;
    aiDrafted: boolean;
    autoReplied: boolean;
  }>;
}

type VehicleInput = z.infer<typeof CreateVehicleDto>;

export function CustomerDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data, isPending } = useQuery({
    queryKey: ["customer-history", id],
    queryFn: () => api.get<CustomerHistory>(`/customers/${id}/history`),
    enabled: !!id,
  });

  const addVehicle = useMutation({
    mutationFn: (values: VehicleInput) => api.post("/vehicles", values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-history", id] });
      notifications.show({ color: "green", message: "Vehicle added" });
      close();
    },
    onError: (err) => {
      notifications.show({ color: "red", message: (err as Error).message });
    },
  });

  if (isPending) return <Text c="dimmed">Loading…</Text>;
  if (!data) return <Text c="dimmed">Customer not found.</Text>;

  const { customer, vehicles, repairOrders, messages } = data;
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  return (
    <Stack>
      <Group justify="space-between">
        <Stack gap={2}>
          <Title order={2}>{fullName}</Title>
          <Text c="dimmed" size="sm">
            {formatPhone(customer.phone)}
            {customer.email ? ` · ${customer.email}` : ""}
          </Text>
        </Stack>
        <Group>
          <Button
            component={Link}
            to={`/ro/new?customerId=${customer.id}`}
            leftSection={<IconPlus size={16} />}
          >
            New RO
          </Button>
        </Group>
      </Group>

      {customer.notes && (
        <Card withBorder>
          <Text size="sm" c="dimmed">
            Notes
          </Text>
          <Text>{customer.notes}</Text>
        </Card>
      )}

      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Vehicles</Title>
          <Button variant="default" size="xs" leftSection={<IconPlus size={14} />} onClick={open}>
            Add vehicle
          </Button>
        </Group>
        {vehicles.length === 0 ? (
          <Text c="dimmed" size="sm">
            No vehicles on file.
          </Text>
        ) : (
          vehicles.map((v) => (
            <Card key={v.id} withBorder>
              <Group justify="space-between">
                <Text fw={600}>
                  {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}
                </Text>
                {v.plate && <Badge variant="light">{v.plate}</Badge>}
              </Group>
              <Text size="sm" c="dimmed">
                {v.vin ? `VIN ${v.vin}` : "No VIN"}
                {v.trim ? ` · ${v.trim}` : ""}
                {v.mileage != null ? ` · ${v.mileage.toLocaleString()} mi` : ""}
                {v.color ? ` · ${v.color}` : ""}
              </Text>
            </Card>
          ))
        )}
      </Stack>

      <Stack gap="xs">
        <Title order={4}>Recent repair orders</Title>
        {repairOrders.length === 0 ? (
          <Text c="dimmed" size="sm">
            No repair orders yet.
          </Text>
        ) : (
          repairOrders.map((r) => (
            <Card
              key={r.id}
              withBorder
              component={Link as any}
              to={`/ro/${r.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Group justify="space-between">
                <Group>
                  <Text fw={600}>{formatRoNumber(r.number)}</Text>
                  <Badge variant="light">{r.status}</Badge>
                </Group>
                <Text fw={600}>{formatMoney(r.total)}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {r.concern ?? "—"} · {relativeTime(r.updatedAt)}
              </Text>
            </Card>
          ))
        )}
      </Stack>

      <Stack gap="xs">
        <Title order={4}>Recent messages</Title>
        {messages.length === 0 ? (
          <Text c="dimmed" size="sm">
            No messages yet.
          </Text>
        ) : (
          messages.slice(0, 10).map((m) => (
            <Card key={m.id} withBorder>
              <Group justify="space-between">
                <Badge variant="light" color={m.direction === "in" ? "blue" : "gray"}>
                  {m.direction === "in" ? "Inbound" : "Outbound"}
                </Badge>
                <Text size="xs" c="dimmed">
                  {relativeTime(m.sentAt)}
                </Text>
              </Group>
              <Text size="sm" mt={4}>
                {m.body}
              </Text>
              {(m.aiDrafted || m.autoReplied) && (
                <Group gap="xs" mt="xs">
                  {m.aiDrafted && <Badge size="xs">AI draft</Badge>}
                  {m.autoReplied && <Badge size="xs" color="grape">Auto-replied</Badge>}
                </Group>
              )}
            </Card>
          ))
        )}
      </Stack>

      <Modal opened={opened} onClose={close} title="Add vehicle" size="lg" centered>
        <VehicleForm
          customerId={customer.id}
          submitLabel="Add vehicle"
          loading={addVehicle.isPending}
          onCancel={close}
          onSubmit={async (values) => {
            await addVehicle.mutateAsync(values);
          }}
        />
      </Modal>
    </Stack>
  );
}
