import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { IconCalendarCheck, IconX } from "@tabler/icons-react";
import { api, ApiError } from "../api";
import type { ManageBooking, Slot, SlotResponse } from "../api";
import { BookingShell } from "./BookRoute";

function formatYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTimeInTz(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLongInTz(iso: string, tz: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ManageBookingRoute() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ManageBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cancelOpen, { open: openCancel, close: closeCancel }] = useDisclosure(false);

  const refetch = () => {
    if (!token) return;
    setLoading(true);
    api
      .get<ManageBooking>(`/public/booking/${token}`)
      .then((d) => setData(d))
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (error || !data) {
    return (
      <Container py="xl">
        <Stack align="center">
          <Title order={2}>Not found</Title>
          <Text c="dimmed">{error ?? "That booking link looks broken."}</Text>
        </Stack>
      </Container>
    );
  }

  const tz = data.shop?.timezone ?? "America/Chicago";
  const shopName = data.shop?.name ?? "your shop";
  const slug = data.shop?.slug;

  return (
    <BookingShell shopName={shopName}>
      <Stack gap="xl">
        <Card padding="lg" radius="md" withBorder>
          <Stack gap="sm">
            <Title order={2}>Your booking</Title>
            <Text>
              {data.customer ? `${data.customer.firstName}, ` : ""}
              {data.vehicle
                ? `${data.vehicle.year ?? ""} ${data.vehicle.make ?? ""} ${data.vehicle.model ?? ""}`.trim()
                : ""}
            </Text>
            {data.booking.scheduledFor && (
              <Text size="lg" fw={600}>
                {formatLongInTz(data.booking.scheduledFor, tz)}
              </Text>
            )}
            <StatusLine status={data.booking.status} />
            {data.booking.concern && (
              <>
                <Divider my="xs" />
                <Text size="sm" c="dimmed">
                  "{data.booking.concern}"
                </Text>
              </>
            )}
          </Stack>
        </Card>

        {data.booking.cancellable && (
          <Card padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={4}>Need to change it?</Title>
              <Group>
                {data.booking.rescheduleable && slug && (
                  <Button onClick={() => setPickerOpen(true)}>Pick a new time</Button>
                )}
                <Button variant="default" color="red" onClick={openCancel}>
                  Cancel booking
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        {pickerOpen && slug && (
          <Card padding="lg" radius="md" withBorder>
            <ReschedulePicker
              token={token!}
              slug={slug}
              tz={tz}
              onDone={(scheduledFor) => {
                setPickerOpen(false);
                setData({
                  ...data,
                  booking: { ...data.booking, scheduledFor },
                });
              }}
              onCancel={() => setPickerOpen(false)}
            />
          </Card>
        )}
      </Stack>

      <Modal opened={cancelOpen} onClose={closeCancel} title="Cancel this booking?">
        <Stack>
          <Text>This will text you a cancellation confirmation. You can re-book any time.</Text>
          <Group justify="end">
            <Button variant="default" onClick={closeCancel}>
              Keep it
            </Button>
            <Button
              color="red"
              leftSection={<IconX size={14} />}
              onClick={async () => {
                try {
                  await api.post(`/public/booking/${token}/cancel`);
                  closeCancel();
                  refetch();
                } catch (err) {
                  setError((err as ApiError).message);
                  closeCancel();
                }
              }}
            >
              Cancel booking
            </Button>
          </Group>
        </Stack>
      </Modal>
    </BookingShell>
  );
}

function StatusLine({ status }: { status: string }) {
  if (status === "scheduled") {
    return (
      <Group gap={6}>
        <ThemeIcon color="green" size="sm" radius="xl">
          <IconCalendarCheck size={12} />
        </ThemeIcon>
        <Text size="sm" c="dimmed">
          Confirmed
        </Text>
      </Group>
    );
  }
  if (status === "cancelled_by_customer") {
    return (
      <Text size="sm" c="red">
        Cancelled
      </Text>
    );
  }
  return (
    <Text size="sm" c="dimmed">
      Status: {status}
    </Text>
  );
}

function ReschedulePicker({
  token,
  slug,
  tz,
  onDone,
  onCancel,
}: {
  token: string;
  slug: string;
  tz: string;
  onDone: (scheduledFor: string) => void;
  onCancel: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotData, setSlotData] = useState<SlotResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date();
  const maxDate = useMemo(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), []);

  useEffect(() => {
    const from = formatYmd(today);
    const to = formatYmd(maxDate);
    setSlotsLoading(true);
    api
      .get<SlotResponse>(`/public/book/${slug}/slots?from=${from}&to=${to}`)
      .then((res) => setSlotData(res))
      .catch((err: ApiError) => setError(err.message))
      .finally(() => setSlotsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const dayHasSlots = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const d of slotData?.days ?? []) {
      out[d.date] = d.slots.some((s) => s.available);
    }
    return out;
  }, [slotData]);

  const slotsForSelectedDay: Slot[] = useMemo(() => {
    if (!selectedDate || !slotData) return [];
    const key = formatYmd(selectedDate);
    return slotData.days.find((d) => d.date === key)?.slots ?? [];
  }, [selectedDate, slotData]);

  async function submit() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ scheduledFor: string }>(
        `/public/booking/${token}/reschedule`,
        { start: selectedSlot }
      );
      onDone(res.scheduledFor);
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack>
      <Title order={4}>Pick a new time</Title>
      {error && <Alert color="red">{error}</Alert>}
      {slotsLoading ? (
        <Center py="md">
          <Loader size="sm" />
        </Center>
      ) : (
        <Group justify="center">
          <DatePicker
            value={selectedDate}
            onChange={(d) => {
              setSelectedDate(d);
              setSelectedSlot(null);
            }}
            minDate={today}
            maxDate={maxDate}
            getDayProps={(date) => {
              const key = formatYmd(date);
              if (dayHasSlots[key] === false) return { disabled: true };
              return {};
            }}
          />
        </Group>
      )}
      {selectedDate && (
        <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
          {slotsForSelectedDay.length === 0 && (
            <Text c="dimmed" span style={{ gridColumn: "1 / -1" }}>
              No times open that day.
            </Text>
          )}
          {slotsForSelectedDay.map((slot) => (
            <Button
              key={slot.start}
              variant={slot.start === selectedSlot ? "filled" : "default"}
              disabled={!slot.available}
              onClick={() => setSelectedSlot(slot.start)}
            >
              {formatTimeInTz(slot.start, tz)}
            </Button>
          ))}
        </SimpleGrid>
      )}
      <Group justify="end" mt="sm">
        <Button variant="default" onClick={onCancel}>
          Never mind
        </Button>
        <Button onClick={submit} loading={submitting} disabled={!selectedSlot}>
          Move booking
        </Button>
      </Group>
    </Stack>
  );
}
