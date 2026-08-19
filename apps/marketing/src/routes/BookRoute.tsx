import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Alert,
  AppShell,
  Anchor,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconBolt, IconCalendarCheck, IconCheck } from "@tabler/icons-react";
import { api, ApiError } from "../api";
import type { BookingShop, CreateBookingResponse, Slot, SlotResponse } from "../api";

const PHONE_DIGITS_RE = /\D+/g;
function normalizeUSPhone(raw: string): string | null {
  // Accept the four most common formats Mike's customers will type:
  //   555-555-5555, (555) 555-5555, +1 555 555 5555, 5555555555
  // Normalize to E.164. Anything else falls through to a validation error.
  const digits = raw.replace(PHONE_DIGITS_RE, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

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

export function BookRoute() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<BookingShop | null>(null);
  const [shopErr, setShopErr] = useState<string | null>(null);
  const [shopLoading, setShopLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setShopLoading(true);
    api
      .get<BookingShop>(`/public/book/${slug}`)
      .then((data) => setShop(data))
      .catch((err: ApiError) => setShopErr(err.message))
      .finally(() => setShopLoading(false));
  }, [slug]);

  if (shopLoading) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (shopErr || !shop) {
    return (
      <Container py="xl">
        <Stack align="center">
          <Title order={2}>Shop not found</Title>
          <Text c="dimmed">{shopErr ?? "That booking link looks broken."}</Text>
        </Stack>
      </Container>
    );
  }
  if (!shop.enabled) {
    return (
      <Container py="xl">
        <Stack align="center" maw={520} mx="auto">
          <Title order={2}>{shop.shop.name}</Title>
          <Text c="dimmed" ta="center">
            Online booking isn't turned on here right now. Give the shop a call and they'll get
            you in.
          </Text>
        </Stack>
      </Container>
    );
  }

  return <BookForm slug={slug!} shop={shop} />;
}

interface BookFormProps {
  slug: string;
  shop: BookingShop;
}

function BookForm({ slug, shop }: BookFormProps) {
  const tz = shop.shop.timezone;
  const today = new Date();
  const maxDate = useMemo(() => {
    // horizonDays counts today as day 1 — the API validates the INCLUSIVE
    // from..to span, so today + horizonDays would be one day too many.
    // Calendar-day arithmetic, not ms math, so DST boundaries don't drift it.
    const d = new Date();
    d.setDate(d.getDate() + shop.booking.horizonDays - 1);
    return d;
  }, [shop.booking.horizonDays]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotData, setSlotData] = useState<SlotResponse | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<CreateBookingResponse | null>(null);

  // Day-level availability map for greying out closed days on the calendar.
  // Populated alongside slot fetches.
  const [dayHasSlots, setDayHasSlots] = useState<Record<string, boolean>>({});

  const form = useForm({
    initialValues: {
      name: "",
      phone: "",
      year: "" as number | "",
      make: "",
      model: "",
      concern: "",
    },
    validate: {
      name: (v) => (v.trim().length >= 1 ? null : "Your name"),
      phone: (v) => (normalizeUSPhone(v) ? null : "10-digit US phone, please"),
      year: (v) =>
        typeof v === "number" && v >= 1900 && v <= 2100 ? null : "Vehicle year",
      make: (v) => (v.trim().length >= 1 ? null : "Make"),
      model: (v) => (v.trim().length >= 1 ? null : "Model"),
      concern: (v) => (v.trim().length >= 3 ? null : "Tell us what's going on"),
    },
  });

  // Fetch a 14-day window around today on mount so the calendar can grey
  // closed days without an extra round-trip per click.
  useEffect(() => {
    const from = formatYmd(today);
    const to = formatYmd(maxDate);
    setSlotsLoading(true);
    setSlotsError(null);
    api
      .get<SlotResponse>(`/public/book/${slug}/slots?from=${from}&to=${to}`)
      .then((res) => {
        setSlotData(res);
        const map: Record<string, boolean> = {};
        for (const d of res.days) {
          map[d.date] = d.slots.some((s) => s.available);
        }
        setDayHasSlots(map);
      })
      .catch((err: ApiError) => setSlotsError(err.message))
      .finally(() => setSlotsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const slotsForSelectedDay: Slot[] = useMemo(() => {
    if (!selectedDate || !slotData) return [];
    const key = formatYmd(selectedDate);
    return slotData.days.find((d) => d.date === key)?.slots ?? [];
  }, [selectedDate, slotData]);

  async function submit(values: typeof form.values) {
    if (!selectedSlot) {
      setSubmitError("Pick a time first.");
      return;
    }
    const e164 = normalizeUSPhone(values.phone);
    if (!e164) {
      setSubmitError("That phone number doesn't look right.");
      return;
    }
    const trimmed = values.name.trim();
    const spaceAt = trimmed.indexOf(" ");
    const firstName = spaceAt === -1 ? trimmed : trimmed.slice(0, spaceAt);
    const lastName = spaceAt === -1 ? undefined : trimmed.slice(spaceAt + 1).trim();

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post<CreateBookingResponse>(`/public/book/${slug}`, {
        start: selectedSlot,
        customer: {
          firstName,
          lastName: lastName && lastName.length > 0 ? lastName : undefined,
          phone: e164,
        },
        vehicle: {
          year: typeof values.year === "number" ? values.year : Number(values.year),
          make: values.make.trim(),
          model: values.model.trim(),
        },
        concern: values.concern.trim(),
      });
      setConfirmation(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Couldn't book. Try again.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <BookingShell shopName={shop.shop.name}>
        <Card padding="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <ThemeIcon color="green" size={56} radius="xl">
              <IconCalendarCheck size={32} />
            </ThemeIcon>
            <Title order={2} ta="center">
              You're booked.
            </Title>
            <Text ta="center">{formatLongInTz(confirmation.scheduledFor, tz)}</Text>
            <Text c="dimmed" ta="center">
              Confirmation <strong>{confirmation.confirmationCode}</strong>
            </Text>
            <Divider w="100%" my="xs" />
            <Text ta="center">
              We just texted you to confirm. Reply to that text if you need to change it.
            </Text>
            <Anchor
              href={`/booking/${confirmation.manageToken}`}
              size="sm"
              c="dimmed"
            >
              Manage this booking
            </Anchor>
          </Stack>
        </Card>
      </BookingShell>
    );
  }

  return (
    <BookingShell shopName={shop.shop.name}>
      <Stack gap="xl">
        <Box>
          <Title order={1}>Book a time at {shop.shop.name}</Title>
          {shop.shop.address && (
            <Text c="dimmed" mt={4}>
              {[shop.shop.address.line1, shop.shop.address.city, shop.shop.address.state]
                .filter(Boolean)
                .join(", ")}
            </Text>
          )}
          <Text c="dimmed" mt={6}>
            Pick a day, pick a time, leave your name and what's going on. We'll text you to
            confirm.
          </Text>
        </Box>

        <Card padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={4}>1. Pick a day</Title>
            {slotsError && <Alert color="red">{slotsError}</Alert>}
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
                  const has = dayHasSlots[key];
                  if (has === false) {
                    return { disabled: true };
                  }
                  return {};
                }}
              />
            </Group>
          </Stack>
        </Card>

        {selectedDate && (
          <Card padding="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={4}>2. Pick a time</Title>
              {slotsLoading ? (
                <Center py="md">
                  <Loader size="sm" />
                </Center>
              ) : slotsError ? (
                <Text c="dimmed">Couldn't load times — refresh the page to try again.</Text>
              ) : slotsForSelectedDay.length === 0 ? (
                <Text c="dimmed">No times open that day. Try another.</Text>
              ) : (
                <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
                  {slotsForSelectedDay.map((slot) => {
                    const selected = slot.start === selectedSlot;
                    return (
                      <Button
                        key={slot.start}
                        variant={selected ? "filled" : "default"}
                        disabled={!slot.available}
                        onClick={() => setSelectedSlot(slot.start)}
                      >
                        {formatTimeInTz(slot.start, tz)}
                      </Button>
                    );
                  })}
                </SimpleGrid>
              )}
            </Stack>
          </Card>
        )}

        {selectedSlot && (
          <Card padding="lg" radius="md" withBorder>
            <form onSubmit={form.onSubmit(submit)}>
              <Stack gap="md">
                <Title order={4}>3. Your info</Title>
                <TextInput
                  label="Your name"
                  placeholder="Jess Garcia"
                  {...form.getInputProps("name")}
                />
                <TextInput
                  label="Phone"
                  placeholder="(555) 555-5555"
                  {...form.getInputProps("phone")}
                  onBlur={(e) => {
                    const e164 = normalizeUSPhone(e.currentTarget.value);
                    if (e164) form.setFieldValue("phone", e164);
                  }}
                />
                <Group grow>
                  <NumberInput
                    label="Year"
                    placeholder="2018"
                    min={1900}
                    max={2100}
                    {...form.getInputProps("year")}
                  />
                  <TextInput
                    label="Make"
                    placeholder="Toyota"
                    {...form.getInputProps("make")}
                  />
                  <TextInput
                    label="Model"
                    placeholder="Camry"
                    {...form.getInputProps("model")}
                  />
                </Group>
                <Textarea
                  label="What's going on?"
                  placeholder="Brakes squeaking, especially in the morning…"
                  minRows={3}
                  autosize
                  {...form.getInputProps("concern")}
                />
                {submitError && <Alert color="red">{submitError}</Alert>}
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">
                    {formatLongInTz(selectedSlot, tz)}
                  </Text>
                  <Button
                    type="submit"
                    size="md"
                    loading={submitting}
                    leftSection={<IconCheck size={16} />}
                  >
                    Book it
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        )}
      </Stack>
    </BookingShell>
  );
}

export function BookingShell({
  shopName,
  children,
}: {
  shopName: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell header={{ height: 56 }}>
      <AppShell.Header>
        <Container size="md" h="100%">
          <Group h="100%" justify="space-between">
            <Group gap={6}>
              <ThemeIcon variant="filled" size="sm" radius="sm">
                <IconBolt size={12} />
              </ThemeIcon>
              <Text fw={600}>{shopName}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              powered by Lift
            </Text>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="md" py="xl">
          {children}
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
