import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  NumberInput,
  Radio,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { DateTimePicker } from "@mantine/dates";
import { IconSearch } from "@tabler/icons-react";
import { api } from "../../../lib/api";
import { notifyError } from "../../../lib/notify";
import { formatPhone, pickerDateToInstant, shopTimezone } from "../../../lib/format";
import { useAuth } from "../../../lib/auth";
import { CustomerForm } from "../../../features/customer/CustomerForm";
import { VehicleForm } from "../../../features/vehicle/VehicleForm";
import { CustomerMatchBanner } from "../../../features/customer/CustomerMatchBanner";
import {
  DuplicateCustomerModal,
  duplicatesFromError,
  type DuplicateCandidate,
} from "../../../features/customer/DuplicateCustomerModal";
import { VehicleMatchBanner } from "../../../features/vehicle/VehicleMatchBanner";
import { VoiceCaptureButton } from "../../../features/voice/VoiceCaptureButton";
import type { CustomerMatch, VehicleMatch } from "../../../lib/useVoiceTranscribe";
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
  /** Last known odometer — prefills "Mileage in" on the concern step. */
  mileage?: number | null;
}

interface CustomerWithVehicles {
  customer: CustomerOption;
  vehicles: VehicleOption[];
}

export function NewRoRoute() {
  const navigate = useNavigate();
  const { me } = useAuth();
  const tz = shopTimezone(me?.shop?.timezone);
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
  // Odometer at drop-off. Optional — prefilled from the car's last known
  // reading, and left blank on a brand-new vehicle.
  const [mileageIn, setMileageIn] = useState<string | number>("");
  const [mileageTouched, setMileageTouched] = useState(false);
  // Optional drop-off time, interpreted in the shop's timezone. When set,
  // the RO is created in "scheduled" status instead of "in".
  const [scheduledDraft, setScheduledDraft] = useState<Date | null>(null);

  // Voice-extracted match suggestions (cleared when banner is dismissed).
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);
  const [vehicleMatches, setVehicleMatches] = useState<VehicleMatch[]>([]);

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
  const {
    data: selectedCustomerData,
    isPending: selectedLoading,
    isFetching: selectedFetching,
  } = useQuery({
    queryKey: ["customer", selectedCustomerId],
    queryFn: () => api.get<CustomerWithVehicles>(`/customers/${selectedCustomerId}`),
    enabled: !!selectedCustomerId,
  });

  // Brand-new shop: nothing to search, so land on the "New customer" form
  // instead of an empty result list. Once only — the owner can still flip
  // back to "Existing" and search.
  const seededCustomerMode = useRef(false);
  useEffect(() => {
    if (seededCustomerMode.current || customerMode !== "existing" || customersLoading) return;
    if (customerQuery === "" && customerList && customerList.customers.length === 0) {
      seededCustomerMode.current = true;
      setCustomerMode("new");
    }
  }, [customerList, customersLoading, customerMode, customerQuery]);

  // Same for vehicles, re-seeded whenever a different customer is picked:
  // no vehicles on file → "New vehicle"; otherwise the pick list.
  const seededVehicleModeFor = useRef<string | null>(null);
  useEffect(() => {
    const cid = selectedCustomerData?.customer.id;
    if (!cid || selectedFetching || seededVehicleModeFor.current === cid) return;
    seededVehicleModeFor.current = cid;
    setVehicleMode(selectedCustomerData.vehicles.length === 0 ? "new" : "existing");
  }, [selectedCustomerData, selectedFetching]);

  // Auto-skip to step 1 if we came in with a customerId in the query.
  useEffect(() => {
    if (initialCustomerId && step === 0) {
      setSelectedCustomerId(initialCustomerId);
      setStep(1);
    }
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 409 from POST /customers: same name, different phone. Ask before making
  // a second record for the same person.
  const [dupes, setDupes] = useState<DuplicateCandidate[] | null>(null);
  const [pendingCustomer, setPendingCustomer] = useState<CreateCustomerInput | null>(null);

  const createCustomer = useMutation({
    mutationFn: (values: CreateCustomerInput & { force?: boolean }) =>
      api.post<{ customer: CustomerOption }>("/customers", values),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDupes(null);
      setPendingCustomer(null);
      setSelectedCustomerId(res.customer.id);
      setCustomerMode("existing");
      setStep(1);
    },
    onError: (err) => {
      const candidates = duplicatesFromError(err);
      if (candidates) {
        setDupes(candidates);
        return;
      }
      notifyError(err, { title: "Couldn't add customer" });
    },
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
        mileageIn: mileageInValue ?? undefined,
        scheduledFor: scheduledDraft
          ? pickerDateToInstant(scheduledDraft, tz).toISOString()
          : undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["ros"] });
      navigate(`/ro/${res.repairOrder.id}`);
    },
    onError: (err) => notifyError(err, { title: "Couldn't create RO" }),
  });

  const customerOptions = customerList?.customers ?? [];
  const vehicleOptions = selectedCustomerData?.vehicles ?? [];
  const selectedVehicle = vehicleOptions.find((v) => v.id === selectedVehicleId) ?? null;

  const mileageInValue = (() => {
    if (mileageIn === "" || mileageIn == null) return null;
    const n = Number(String(mileageIn).replace(/[^0-9]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : null;
  })();

  // Seed the field from the car's last reading once per vehicle, unless the
  // owner has already typed something.
  const seededMileageFor = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedVehicleId || seededMileageFor.current === selectedVehicleId) return;
    seededMileageFor.current = selectedVehicleId;
    if (mileageTouched) return;
    setMileageIn(selectedVehicle?.mileage ?? "");
  }, [selectedVehicleId, selectedVehicle, mileageTouched]);

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
              <Stack>
                {customerMatches.length > 0 && (
                  <CustomerMatchBanner
                    matches={customerMatches}
                    onUseExisting={(id) => {
                      setSelectedCustomerId(id);
                      setSelectedVehicleId(null);
                      setCustomerMatches([]);
                      setCustomerMode("existing");
                      setStep(1);
                    }}
                    onDismiss={() => setCustomerMatches([])}
                  />
                )}
                <CustomerForm
                  submitLabel="Create customer & continue"
                  loading={createCustomer.isPending}
                  onSubmit={async (values) => {
                    setPendingCustomer(values);
                    try {
                      await createCustomer.mutateAsync(values);
                    } catch {
                      // Handled in onError — a 409 opens the duplicate prompt.
                    }
                  }}
                  onMatchesFound={setCustomerMatches}
                />
                <DuplicateCustomerModal
                  opened={!!dupes}
                  candidates={dupes ?? []}
                  typedName={
                    pendingCustomer
                      ? [pendingCustomer.firstName, pendingCustomer.lastName]
                          .filter(Boolean)
                          .join(" ")
                      : ""
                  }
                  loading={createCustomer.isPending}
                  onClose={() => setDupes(null)}
                  onUseExisting={(cid) => {
                    setDupes(null);
                    setSelectedCustomerId(cid);
                    setSelectedVehicleId(null);
                    setCustomerMode("existing");
                    setStep(1);
                  }}
                  onCreateAnyway={() => {
                    if (pendingCustomer) {
                      createCustomer.mutate({ ...pendingCustomer, force: true });
                    }
                  }}
                />
              </Stack>
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
                <Stack>
                  {vehicleMatches.length > 0 && (
                    <VehicleMatchBanner
                      matches={vehicleMatches}
                      onUseExisting={(id) => {
                        setSelectedVehicleId(id);
                        setVehicleMatches([]);
                        setVehicleMode("existing");
                        setStep(2);
                      }}
                      onDismiss={() => setVehicleMatches([])}
                    />
                  )}
                  <VehicleForm
                    customerId={selectedCustomerId}
                    submitLabel="Add vehicle & continue"
                    loading={createVehicle.isPending}
                    onSubmit={async (values) => {
                      await createVehicle.mutateAsync(values);
                    }}
                    onMatchesFound={setVehicleMatches}
                  />
                </Stack>
              )
            )}
          </Stack>
        </Stepper.Step>

        <Stepper.Step label="Concern">
          <Stack mt="md">
            <VoiceCaptureButton
              kind="concern"
              idleLabel="Tap to dictate the customer's concern."
              onResult={(r) => {
                if (r.kind !== "concern") return;
                if (r.text) setConcern(r.text);
              }}
            />
            <Textarea
              label="Concern (what the customer reported)"
              placeholder="Clunking from front end on left turns…"
              minRows={4}
              value={concern}
              onChange={(e) => setConcern(e.currentTarget.value)}
            />
            <NumberInput
              label="Mileage in (optional)"
              description={
                selectedVehicle?.mileage != null
                  ? `Last we saw: ${selectedVehicle.mileage.toLocaleString()} mi`
                  : "Odometer at drop-off"
              }
              placeholder="48,120"
              min={0}
              max={9_999_999}
              thousandSeparator=","
              allowDecimal={false}
              allowNegative={false}
              value={mileageIn}
              onChange={(v) => {
                setMileageTouched(true);
                setMileageIn(v);
              }}
            />
            <DateTimePicker
              label="Scheduled drop-off (optional)"
              description="Leave empty if the car is already here"
              placeholder="Pick date and time"
              value={scheduledDraft}
              onChange={setScheduledDraft}
              valueFormat="ddd MMM D, h:mm A"
              minDate={new Date()}
              popoverProps={{ withinPortal: true }}
              clearable
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
