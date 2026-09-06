import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  Modal,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconChevronDown,
  IconChevronRight,
  IconPencil,
  IconPhone,
  IconPlus,
} from "@tabler/icons-react";
import { api } from "../../../lib/api";
import { notifyError } from "../../../lib/notify";
import { formatMoney, formatPhone, formatRoNumber, relativeTime } from "../../../lib/format";
import { VehicleForm } from "../../../features/vehicle/VehicleForm";
import { VehicleCard } from "../../../features/vehicle/VehicleCard";
import { CustomerForm } from "../../../features/customer/CustomerForm";
import { CustomerStatsStrip } from "../../../features/customer/CustomerStatsStrip";
import { CustomerRemindersPanel } from "../../../features/reminders/CustomerRemindersPanel";
import type { z } from "zod";
import type { CreateVehicleDto } from "@lift/shared/dto";
import type { CreateCustomerInput } from "@lift/shared/dto";
import { RO_STATUS_LABELS } from "@lift/shared/constants";

interface CustomerHistory {
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
    notes: string | null;
    taxExempt?: boolean;
    smsOptInAt: string | null;
    smsOptOutAt: string | null;
    createdAt: string;
  };
  stats: {
    vehicleCount: number;
    roCount: number;
    lifetimeSpendCents: number;
    lifetimeBilledCents: number;
    firstVisitAt: string | null;
    lastVisitAt: string | null;
  };
  vehicles: Array<{
    id: string;
    vin: string | null;
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    engine: string | null;
    mileage: number | null;
    plate: string | null;
    color: string | null;
    notes: string | null;
    roCount: number;
    lastServicedAt: string | null;
    lastConcern: string | null;
    lifetimeSpendCents: number;
  }>;
  recentRepairOrders: Array<{
    id: string;
    number: number;
    status: string;
    concern: string | null;
    total: number;
    vehicleId: string;
    paymentStatus: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
  }>;
  recentMessages: Array<{
    id: string;
    direction: "in" | "out";
    kind?: "sms" | "system";
    body: string;
    sentAt: string;
    aiDrafted: boolean;
    inboundClassification: string | null;
    autoReplied: boolean;
    automated?: boolean;
    deliveryStatus?: "sent" | "delivered" | "failed" | null;
  }>;
}

type VehicleInput = z.infer<typeof CreateVehicleDto>;

export function CustomerDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [vehicleModal, vehicleModalCtl] = useDisclosure(false);
  const [editModal, editModalCtl] = useDisclosure(false);
  const [messagesOpen, messagesCtl] = useDisclosure(false);

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
      vehicleModalCtl.close();
    },
    onError: (err) => notifyError(err, { title: "Couldn't add vehicle" }),
  });

  const updateCustomer = useMutation({
    // CustomerForm strips cleared optionals to undefined, which PATCH would
    // ignore — null tells the API to actually clear the field.
    mutationFn: (values: CreateCustomerInput) =>
      api.patch(`/customers/${id}`, {
        ...values,
        lastName: values.lastName ?? null,
        email: values.email ?? null,
        notes: values.notes ?? null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-history", id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      notifications.show({ color: "green", message: "Customer updated" });
      editModalCtl.close();
    },
    onError: (err) => notifyError(err, { title: "Couldn't save changes" }),
  });

  if (isPending) return <Text c="dimmed">Loading…</Text>;
  if (!data)
    return (
      <Stack align="center">
        <Text>Can't find that customer.</Text>
        <Button component={Link} to="/app/customers" variant="light">
          Back to customers
        </Button>
      </Stack>
    );

  const { customer, stats, vehicles, recentRepairOrders, recentMessages } = data;
  const fullName = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  // Quick lookup from vehicleId → human label so the RO timeline can show
  // which car each visit was for. O(vehicles) build, O(1) reads — fine at
  // 1–3 bay shop scale.
  const vehicleLabels = new Map<string, string>();
  for (const v of vehicles) {
    vehicleLabels.set(
      v.id,
      [v.year, v.make, v.model].filter(Boolean).join(" ") || (v.plate ? `Plate ${v.plate}` : "Vehicle")
    );
  }

  return (
    <Stack gap="md">
      {/* Header card */}
      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Title order={2}>{fullName}</Title>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="md"
                aria-label="Edit customer"
                onClick={editModalCtl.open}
              >
                <IconPencil size={16} />
              </ActionIcon>
            </Group>
            <Group gap="xs" wrap="nowrap">
              <ActionIcon
                component="a"
                href={`tel:${customer.phone}`}
                variant="subtle"
                size="md"
                aria-label="Call customer"
              >
                <IconPhone size={16} />
              </ActionIcon>
              <Text
                component="a"
                href={`tel:${customer.phone}`}
                c="blue"
                size="sm"
                style={{ textDecoration: "none" }}
              >
                {formatPhone(customer.phone)}
              </Text>
              {customer.email && (
                <Text c="dimmed" size="sm" truncate>
                  · {customer.email}
                </Text>
              )}
            </Group>
            {customer.smsOptOutAt && (
              <Badge size="xs" color="red" variant="light">
                SMS opted out
              </Badge>
            )}
            {customer.taxExempt && (
              <Badge size="xs" color="gray" variant="light">
                Tax exempt
              </Badge>
            )}
          </Stack>
          <Button
            component={Link}
            to={`/ro/new?customerId=${customer.id}`}
            leftSection={<IconPlus size={16} />}
            style={{ minHeight: 44 }}
          >
            New RO
          </Button>
        </Group>

        {customer.notes && (
          <Box mt="sm">
            <Text size="xs" c="dimmed">
              Notes
            </Text>
            <Text size="sm">{customer.notes}</Text>
          </Box>
        )}
      </Card>

      {/* Stats strip */}
      <CustomerStatsStrip
        vehicleCount={stats.vehicleCount}
        roCount={stats.roCount}
        lifetimeSpendCents={stats.lifetimeSpendCents}
        lastVisitAt={stats.lastVisitAt}
      />

      {/* Vehicles */}
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Vehicles</Title>
          <Button
            variant="default"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={vehicleModalCtl.open}
          >
            Add vehicle
          </Button>
        </Group>
        {vehicles.length === 0 ? (
          <Text c="dimmed" size="sm">
            No vehicles on file.
          </Text>
        ) : (
          vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)
        )}
      </Stack>

      {/* Upcoming service reminders (collapsed when empty) */}
      <CustomerRemindersPanel customerId={customer.id} />

      {/* Recent activity timeline */}
      <Stack gap="xs">
        <Title order={4}>Recent activity</Title>
        {recentRepairOrders.length === 0 ? (
          <Text c="dimmed" size="sm">
            No repair orders yet.
          </Text>
        ) : (
          recentRepairOrders.map((r) => (
            <Card
              key={r.id}
              withBorder
              component={Link as any}
              to={`/ro/${r.id}`}
              style={{ textDecoration: "none", color: "inherit", minHeight: 44 }}
              padding="sm"
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Text fw={600}>{formatRoNumber(r.number)}</Text>
                  <Badge variant="light" size="sm">
                    {(RO_STATUS_LABELS as Record<string, string>)[r.status] ?? r.status}
                  </Badge>
                  {r.paymentStatus === "paid" && (
                    <Badge variant="light" color="green" size="sm">
                      paid
                    </Badge>
                  )}
                </Group>
                <Text fw={600}>{formatMoney(r.total)}</Text>
              </Group>
              <Text size="xs" c="dimmed" mt={4} lineClamp={1}>
                {vehicleLabels.get(r.vehicleId) ?? "Vehicle"}
                {r.concern ? ` · "${r.concern}"` : ""}
                {" · "}
                {relativeTime(r.updatedAt)}
              </Text>
            </Card>
          ))
        )}
      </Stack>

      {/* Recent messages (collapsed by default) */}
      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Recent messages</Title>
          {recentMessages.length > 0 && (
            <Button
              variant="subtle"
              size="xs"
              onClick={messagesCtl.toggle}
              leftSection={
                messagesOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />
              }
            >
              {messagesOpen ? "Hide" : `Show ${recentMessages.length}`}
            </Button>
          )}
        </Group>
        {recentMessages.length === 0 ? (
          <Text c="dimmed" size="sm">
            No messages yet.
          </Text>
        ) : (
          <Collapse in={messagesOpen}>
            <Stack gap="xs">
              {recentMessages.map((m) => (
                <Card key={m.id} withBorder padding="sm">
                  <Group justify="space-between">
                    <Badge variant="light" color={m.direction === "in" ? "blue" : "gray"} size="xs">
                      {m.kind === "system" ? "Note" : m.direction === "in" ? "Inbound" : "Outbound"}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {relativeTime(m.sentAt)}
                    </Text>
                  </Group>
                  <Text size="sm" mt={4}>
                    {m.body}
                  </Text>
                  {(m.aiDrafted ||
                    m.autoReplied ||
                    m.automated ||
                    (m.direction === "out" && m.deliveryStatus === "failed")) && (
                    <Group gap="xs" mt="xs">
                      {m.aiDrafted && (
                        <Badge size="xs" variant="light">
                          AI draft
                        </Badge>
                      )}
                      {m.autoReplied && (
                        <Badge size="xs" color="grape" variant="light">
                          Auto-replied
                        </Badge>
                      )}
                      {m.automated && !m.autoReplied && (
                        <Badge size="xs" color="gray" variant="light">
                          Automated
                        </Badge>
                      )}
                      {m.direction === "out" && m.deliveryStatus === "failed" && (
                        <Text size="xs" c="red.7" fw={500}>
                          Not delivered
                        </Text>
                      )}
                    </Group>
                  )}
                </Card>
              ))}
            </Stack>
          </Collapse>
        )}
      </Stack>

      <Modal
        opened={editModal}
        onClose={editModalCtl.close}
        title="Edit customer"
        size="lg"
        centered
      >
        <CustomerForm
          mode="edit"
          submitLabel="Save changes"
          initialValues={{
            firstName: customer.firstName,
            lastName: customer.lastName ?? "",
            phone: formatPhone(customer.phone),
            email: customer.email ?? undefined,
            notes: customer.notes ?? undefined,
            taxExempt: customer.taxExempt ?? false,
          }}
          loading={updateCustomer.isPending}
          onCancel={editModalCtl.close}
          onSubmit={async (values) => {
            await updateCustomer.mutateAsync(values);
          }}
        />
      </Modal>

      <Modal
        opened={vehicleModal}
        onClose={vehicleModalCtl.close}
        title="Add vehicle"
        size="lg"
        centered
      >
        <VehicleForm
          customerId={customer.id}
          submitLabel="Add vehicle"
          loading={addVehicle.isPending}
          onCancel={vehicleModalCtl.close}
          onSubmit={async (values) => {
            await addVehicle.mutateAsync(values);
          }}
        />
      </Modal>
    </Stack>
  );
}
