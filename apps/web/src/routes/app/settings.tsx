import { useEffect, useMemo, useState } from "react";
import {
  Stack,
  Title,
  Text,
  Switch,
  Group,
  Select,
  Button,
  Divider,
  NumberInput,
  List,
  TextInput,
  CopyButton,
  Anchor,
  Table,
  Alert,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  SERVICE_CATEGORIES,
  SERVICE_INTERVALS,
  SHOP_SLUG_REGEX,
} from "@lift/shared/constants";
import { useAuth, type BookingHour, type BookingSettings } from "../../lib/auth";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const MARKETING_URL = import.meta.env.VITE_MARKETING_URL ?? "https://lift.worxel.com";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function defaultHoursFrom(business: BookingHour[] | undefined): BookingHour[] {
  // Copy business hours when first turning booking on. If business hours
  // are empty, default to Mon–Fri 8–5.
  if (business && business.length > 0) {
    return business.map((h) => ({
      day: h.day,
      open: h.open ?? "08:00",
      close: h.close ?? "17:00",
      closed: !!h.closed,
    }));
  }
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    day: d,
    open: "08:00",
    close: "17:00",
    closed: d === 0 || d === 6,
  }));
}

export function SettingsRoute() {
  const { me } = useAuth();
  const qc = useQueryClient();

  const patchShop = useMutation({
    mutationFn: (patch: {
      slug?: string;
      settings?: {
        aiTone?: "plain" | "friendly";
        autoReplyEnabled?: boolean;
        defaultLaborRate?: number;
        serviceRemindersEnabled?: boolean;
        booking?: BookingSettings;
      };
    }) => api.patch("/shop", patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      notifications.show({ color: "green", message: "Settings saved." });
    },
    onError: (err) => notifyError(err, { title: "Couldn't save settings" }),
  });

  const initialRate = me?.shop?.settings.defaultLaborRate ?? null;
  const [laborRateDollars, setLaborRateDollars] = useState<number | undefined>(
    initialRate != null ? initialRate / 100 : undefined
  );

  const openBillingPortal = useMutation({
    mutationFn: () => api.post<{ url: string }>("/billing/portal-session"),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (err) => notifyError(err, { title: "Couldn't open billing" }),
  });

  function exportData() {
    window.location.href = `${API_URL}/data/export`;
  }

  // ── Online booking state. Mirrors `settings.booking` from the server and
  // ── flushes via PATCH /shop on each change for the autosave UX.
  const booking = me?.shop?.settings.booking;
  const bookingEnabled = !!booking?.enabled;
  const [slugDraft, setSlugDraft] = useState(me?.shop?.slug ?? "");
  const [slugError, setSlugError] = useState<string | null>(null);
  useEffect(() => {
    setSlugDraft(me?.shop?.slug ?? "");
  }, [me?.shop?.slug]);

  const hours = useMemo<BookingHour[]>(() => {
    if (booking?.hours && booking.hours.length > 0) return booking.hours;
    return defaultHoursFrom(me?.shop?.settings.businessHours);
  }, [booking?.hours, me?.shop?.settings.businessHours]);

  function patchBooking(patch: Partial<BookingSettings>) {
    patchShop.mutate({ settings: { booking: patch } });
  }

  function toggleBooking(next: boolean) {
    // First enable: seed hours from businessHours so Mike doesn't stare at a
    // blank table.
    if (next && (!booking?.hours || booking.hours.length === 0)) {
      patchShop.mutate({
        settings: {
          booking: { enabled: true, hours: defaultHoursFrom(me?.shop?.settings.businessHours) },
        },
      });
    } else {
      patchBooking({ enabled: next });
    }
  }

  function updateHourRow(idx: number, patch: Partial<BookingHour>) {
    const next = hours.map((h, i) => (i === idx ? { ...h, ...patch } : h));
    patchBooking({ hours: next });
  }

  function saveSlug() {
    const v = slugDraft.trim().toLowerCase();
    if (!SHOP_SLUG_REGEX.test(v)) {
      setSlugError(
        "Lowercase letters, digits, and hyphens only. 2–42 chars, can't start or end with a hyphen."
      );
      return;
    }
    setSlugError(null);
    patchShop.mutate({ slug: v });
  }

  const bookingUrl = me?.shop?.slug ? `${MARKETING_URL}/book/${me.shop.slug}` : null;

  return (
    <Stack>
      <Title order={2}>Settings</Title>
      <Text c="dimmed">Shop: {me?.shop?.name}</Text>

      <Divider label="AI" />
      <Select
        label="AI tone for drafted customer messages"
        data={[
          { value: "plain", label: "Plain — direct, mechanic-to-customer" },
          { value: "friendly", label: "Friendly — warm, neighborly" },
        ]}
        value={me?.shop?.settings.aiTone ?? "plain"}
        onChange={(v) => v && patchShop.mutate({ settings: { aiTone: v as "plain" | "friendly" } })}
      />
      <Switch
        label="Auto-reply to status-check texts"
        checked={me?.shop?.settings.autoReplyEnabled ?? false}
        onChange={(e) =>
          patchShop.mutate({ settings: { autoReplyEnabled: e.currentTarget.checked } })
        }
        description="If a customer asks ‘is my car ready,’ Lift answers automatically with the current status."
      />

      <Divider label="Service reminders" />
      <Switch
        label="Send service-due reminders"
        checked={me?.shop?.settings.serviceRemindersEnabled ?? true}
        onChange={(e) =>
          patchShop.mutate({
            settings: { serviceRemindersEnabled: e.currentTarget.checked },
          })
        }
        description="When you close one of these jobs, we'll text the customer when they're due back. One nudge per car — never a blast."
      />
      <List size="sm" spacing={4} c="dimmed">
        {SERVICE_CATEGORIES.map((cat) => {
          const def = SERVICE_INTERVALS[cat];
          return (
            <List.Item key={cat}>
              {def.label} — every {def.days} days
            </List.Item>
          );
        })}
      </List>

      <Divider label="Online booking" />
      <Switch
        label="Let customers book themselves online"
        checked={bookingEnabled}
        onChange={(e) => toggleBooking(e.currentTarget.checked)}
        description="Your shop gets a public booking link. Customers pick a time off your calendar instead of calling."
      />

      {bookingEnabled && (
        <Stack gap="md">
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Your booking link
            </Text>
            {bookingUrl ? (
              <Group gap="xs">
                <Text size="sm" ff="monospace">
                  {bookingUrl}
                </Text>
                <CopyButton value={bookingUrl}>
                  {({ copied, copy }) => (
                    <Button size="xs" variant="default" onClick={copy}>
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  )}
                </CopyButton>
                <Anchor href={bookingUrl} target="_blank" size="sm">
                  Open
                </Anchor>
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                Pick a slug below to publish your link.
              </Text>
            )}
          </Stack>

          <Group align="end" gap="sm">
            <TextInput
              label="URL slug"
              description={
                me?.shop?.slug
                  ? "Renaming this breaks the old link for new bookings (old link redirects for 90 days)."
                  : undefined
              }
              value={slugDraft}
              onChange={(e) => setSlugDraft(e.currentTarget.value)}
              error={slugError}
              placeholder="mikes-auto"
              w={280}
            />
            <Button
              variant="default"
              onClick={saveSlug}
              disabled={!slugDraft || slugDraft === me?.shop?.slug}
              loading={patchShop.isPending}
            >
              Save slug
            </Button>
          </Group>

          <Group grow>
            <NumberInput
              label="Slot length (minutes)"
              min={15}
              max={240}
              step={15}
              value={booking?.slotMinutes ?? 60}
              onChange={(v) => typeof v === "number" && patchBooking({ slotMinutes: v })}
            />
            <NumberInput
              label="Lead time (hours)"
              description="How far ahead a customer must book."
              min={0}
              max={168}
              value={booking?.leadTimeHours ?? 2}
              onChange={(v) => typeof v === "number" && patchBooking({ leadTimeHours: v })}
            />
            <NumberInput
              label="Book up to (days ahead)"
              description="How far out customers can book."
              min={1}
              max={60}
              value={booking?.horizonDays ?? 14}
              onChange={(v) => typeof v === "number" && patchBooking({ horizonDays: v })}
            />
          </Group>

          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Bookable hours
            </Text>
            <Text size="xs" c="dimmed">
              Defaults to your business hours. Block off whole days with the toggle.
            </Text>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Day</Table.Th>
                  <Table.Th>Open</Table.Th>
                  <Table.Th>Close</Table.Th>
                  <Table.Th>Closed?</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                  const idx = hours.findIndex((h) => h.day === dow);
                  const row: BookingHour =
                    idx >= 0 && hours[idx]
                      ? hours[idx]
                      : { day: dow, open: "08:00", close: "17:00", closed: false };
                  const realIdx = idx >= 0 ? idx : hours.length;
                  return (
                    <Table.Tr key={dow}>
                      <Table.Td>{DAY_LABELS[dow]}</Table.Td>
                      <Table.Td>
                        <TimeInput
                          value={row.open ?? "08:00"}
                          disabled={!!row.closed}
                          onChange={(e) =>
                            updateHourRow(realIdx, {
                              day: dow,
                              open: e.currentTarget.value,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <TimeInput
                          value={row.close ?? "17:00"}
                          disabled={!!row.closed}
                          onChange={(e) =>
                            updateHourRow(realIdx, {
                              day: dow,
                              close: e.currentTarget.value,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <Switch
                          checked={!!row.closed}
                          onChange={(e) =>
                            updateHourRow(realIdx, {
                              day: dow,
                              closed: e.currentTarget.checked,
                            })
                          }
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Stack>

          {!me?.shop?.slug && (
            <Alert color="yellow" variant="light">
              Booking is on but you don't have a URL slug yet. Set one above to publish the link.
            </Alert>
          )}
        </Stack>
      )}

      <Divider label="Saved jobs" />
      <Group align="end">
        <NumberInput
          label="Default labor rate ($/hr)"
          description="Used as the starting rate when you add labor rows to a template."
          min={0}
          decimalScale={2}
          value={laborRateDollars ?? ""}
          onChange={(v) => setLaborRateDollars(typeof v === "number" ? v : undefined)}
          w={240}
        />
        <Button
          variant="default"
          onClick={() => {
            if (laborRateDollars && laborRateDollars > 0) {
              patchShop.mutate({
                settings: { defaultLaborRate: Math.round(laborRateDollars * 100) },
              });
            }
          }}
          disabled={!laborRateDollars || laborRateDollars <= 0}
        >
          Save rate
        </Button>
      </Group>

      <Divider label="Billing" />
      <Group>
        <Button
          variant="default"
          onClick={() => openBillingPortal.mutate()}
          loading={openBillingPortal.isPending}
        >
          Manage billing
        </Button>
      </Group>

      <Divider label="Data" />
      <Group>
        <Button variant="default" onClick={exportData}>
          Export everything as CSV
        </Button>
      </Group>
    </Stack>
  );
}
