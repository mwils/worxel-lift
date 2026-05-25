import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Radio,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconSearch } from "@tabler/icons-react";
import { api } from "../../../lib/api";
import { notifyError } from "../../../lib/notify";
import { formatPhone } from "../../../lib/format";
import { CustomerForm } from "../../../features/customer/CustomerForm";
import { VehicleForm } from "../../../features/vehicle/VehicleForm";
import type { CreateCustomerInput, CreateVehicleDto } from "@lift/shared/dto";
import type { z } from "zod";

type VehicleInput = z.infer<typeof CreateVehicleDto>;

interface CustomerOption {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
}

interface VehicleOption {
  id: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  plate: string | null;
}

interface CustomerWithVehicles {
  customer: CustomerOption;
  vehicles: VehicleOption[];
}

export function NewRoRoute() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialCustomerId = searchParams.get("customerId");

  const [step, setStep] = useState(0);

  // Customer state
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialCustomerId);

  // Vehicle state
  const [vehicleMode, setVehicleMode] = useState<"existing" | "new">("existing");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Concern
  const [concern, setConcern] = useState("");

  // Customer search
  const { data: customerList, isPending: customersLoading } = useQuery({
    queryKey: ["customers", customerQuery],
    queryFn: () =>
      api.get<{ customers: CustomerOption[] }>(
        `/customers${customerQuery ? `?q=${encodeURIComponent(customerQuery)}` : ""}`
      ),
    enabled: customerMode === "existing",
  });

  // Selected customer + their vehicles (used in step 2)
  const { data: selectedCustomerData, isPending: selectedLoading } = useQuery({
    queryKey: ["customer", selectedCustomerId],
    queryFn: () => api.get<CustomerWithVehicles>(`/customers/${selectedCustomerId}`),
    enabled: !!selectedCustomerId,
  });

  // Auto-skip to step 1 if we came in with a customerId in the query.
  useEffect(() => {
    if (initialCustomerId && step === 0) {
      setSelectedCustomerId(initialCustomerId);
      setStep(1);
    }
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCustomer = useMutation({
    mutationFn: (values: CreateCustomerInput) =>
      api.post<{ customer: CustomerOption }>("/customers", values),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setSelectedCustomerId(res.customer.id);
      setCustomerMode("existing");
      setStep(1);
    },
    onError: (err) => notifyError(err, { title: "Couldn't add customer" }),
  });

  const createVehicle = useMutation({
    mutationFn: (values: VehicleInput) =>
      api.post<{ vehicle: VehicleOption }>("/vehicles", values),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["customer", selectedCustomerId] });
      setSelectedVehicleId(res.vehicle.id);
      setVehicleMode("existing");
      setStep(2);
    },
    onError: (err) => notifyError(err, { title: "Couldn't add vehicle" }),
  });

  const createRo = useMutation({
    mutationFn: () =>
      api.post<{ repairOrder: { id: string } }>("/repair-orders", {
        customerId: selectedCustomerId,
        vehicleId: selectedVehicleId,
        concern: concern || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ros"] });
      navigate(`/ro/${res.repairOrder.id}`);
    },
    onError: (err) => notifyError(err, { title: "Couldn't create RO" }),
  });

  const customerOptions = customerList?.customers ?? [];
  const vehicleOptions = selectedCustomerData?.vehicles ?? [];

  const canContinueStep1 = !!selectedCustomerId;
  const canContinueStep2 = !!selectedVehicleId;

  const selectedCustomerSummary = useMemo(() => {
    const c = selectedCustomerData?.customer;
    if (!c) return null;
    return `${c.firstName} ${c.lastName ?? ""} · ${formatPhone(c.phone)}`;
  }, [selectedCustomerData]);

  return (
    <Stack>
      <Title order={2}>New RO</Title>

      <Stepper active={step} onStepClick={setStep}>
        <Stepper.Step label="Customer">
          <Stack mt="md">
            <Radio.Group
              value={customerMode}
              onChange={(v) => setCustomerMode(v as "existing" | "new")}
            >
              <Group>
                <Radio value="existing" label="Existing customer" />
                <Radio value="new" label="New customer" />
              </Group>
            </Radio.Group>

            {customerMode === "existing" ? (
              <Stack>
                <TextInput
                  leftSection={<IconSearch size={16} />}
                  placeholder="Search by name / phone"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.currentTarget.value)}
                />
                {customersLoading ? (
                  <Loader size="sm" />
                ) : (
                  <Stack gap="xs">
                    {customerOptions.length === 0 && (
                      <Text c="dimmed" size="sm">
                        No customers match — try a new customer.
                      </Text>
                    )}
                    {customerOptions.map((c) => (
                      <Card
                        key={c.id}
                        withBorder
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setSelectedVehicleId(null);
                        }}
                        style={{
                          cursor: "pointer",
                          borderColor:
                            c.id === selectedCustomerId
                              ? "var(--mantine-color-blue-5)"
                              : undefined,
                        }}
                      >
                        <Group justify="space-between">
                          <Text fw={600}>
                            {c.firstName} {c.lastName ?? ""}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {formatPhone(c.phone)}
                          </Text>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
                <Group justify="flex-end">
                  <Button onClick={() => setStep(1)} disabled={!canContinueStep1}>
                    Pick vehicle
                  </Button>
                </Group>
              </Stack>
            ) : (
              <CustomerForm
                submitLabel="Create customer & continue"
                loading={createCustomer.isPending}
                onSubmit={async (values) => {
                  await createCustomer.mutateAsync(values);
                }}
              />
            )}
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Vehicle">
          <Stack mt="md">
            {selectedCustomerSummary && (
              <Badge variant="light" size="lg">
                {selectedCustomerSummary}
              </Badge>
            )}

            <Radio.Group
              value={vehicleMode}
              onChange={(v) => setVehicleMode(v as "existing" | "new")}
            >
              <Group>
                <Radio
                  value="existing"
                  label="Existing vehicle"
                  disabled={vehicleOptions.length === 0}
                />
                <Radio value="new" label="New vehicle" />
              </Group>
            </Radio.Group>

            {vehicleMode === "existing" ? (
              <Stack>
                {selectedLoading ? (
                  <Loader size="sm" />
                ) : vehicleOptions.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    No vehicles on file — add one.
                  </Text>
                ) : (
                  vehicleOptions.map((v) => (
                    <Card
                      key={v.id}
                      withBorder
                      onClick={() => setSelectedVehicleId(v.id)}
                      style={{
                        cursor: "pointer",
                        borderColor:
                          v.id === selectedVehicleId ? "var(--mantine-color-blue-5)" : undefined,
                      }}
                    >
                      <Group justify="space-between">
                        <Text fw={600}>
                          {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle"}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {v.plate ?? v.vin ?? "—"}
                        </Text>
                      </Group>
                    </Card>
                  ))
                )}
                <Group justify="space-between">
                  <Button variant="subtle" onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(2)} disabled={!canContinueStep2}>
                    Add concern
                  </Button>
                </Group>
              </Stack>
            ) : (
              selectedCustomerId && (
                <VehicleForm
                  customerId={selectedCustomerId}
                  submitLabel="Add vehicle & continue"
                  loading={createVehicle.isPending}
                  onSubmit={async (values) => {
                    await createVehicle.mutateAsync(values);
                  }}
                />
              )
            )}
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Concern">
          <Stack mt="md">
            <Textarea
              label="Concern (what the customer reported)"
              placeholder="Clunking from front end on left turns…"
              minRows={4}
              value={concern}
              onChange={(e) => setConcern(e.currentTarget.value)}
            />
            <Group justify="space-between">
              <Button variant="subtle" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => createRo.mutate()}
                loading={createRo.isPending}
                disabled={!selectedCustomerId || !selectedVehicleId}
              >
                Create RO
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>
      </Stepper>
    </Stack>
  );
}
