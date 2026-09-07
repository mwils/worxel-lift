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
  Badge,
  ActionIcon,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  READY_TEXT_MODES,
  READY_TEXT_MODE_LABELS,
  SERVICE_CATEGORIES,
  SERVICE_INTERVALS,
  SHOP_SLUG_REGEX,
  TAX_APPLIES_TO,
  TAX_APPLIES_TO_LABELS,
  US_STATE_CODES,
  US_STATE_NAMES,
  US_TIMEZONES,
  bpsToPct,
  isValidTimezone,
  pctToBps,
  resolveTaxSettings,
  slugifyShopName,
  type ReadyTextMode,
  type TaxAppliesTo,
} from "@lift/shared/constants";
import {
  useAuth,
  type BookingHour,
  type BookingSettings,
  type ShopAddress,
} from "../../lib/auth";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import {
  TimezoneChangeModal,
  type AppointmentMode,
  type AppointmentShift,
  type TimezoneChangeRequest,
} from "../../features/settings/TimezoneChangeModal";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const MARKETING_URL = import.meta.env.VITE_MARKETING_URL ?? "https://lift.worxel.com";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATE_OPTIONS = US_STATE_CODES.map((code) => ({
  value: code,
  label: `${code} — ${US_STATE_NAMES[code]}`,
}));
// Sentinel Select value that reveals the free-text IANA zone input.
const TZ_OTHER = "__other";
const TZ_OPTIONS = [...US_TIMEZONES, { value: TZ_OTHER, label: "Other — type a timezone" }];

/**
 * Slugify as the user types, but keep a trailing hyphen so "mikes-" can still
 * become "mikes-auto". The final trim happens in saveSlug via slugifyShopName.
 */
function liveSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "");
}

interface TeamMember {
  id: string;
  email: string;
  phone: string | null;
  role: "owner" | "tech";
  pending: boolean;
  lastLoginAt: string | null;
  isYou: boolean;
}

/** "(512) 555-0134" → "+15125550134"; returns null if it isn't a 10/11-digit US number. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

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
      name?: string;
      slug?: string;
      address?: ShopAddress;
      phone?: string | null;
      timezone?: string;
      appointmentMode?: AppointmentMode;
      settings?: {
        aiTone?: "plain" | "friendly";
        autoReplyEnabled?: boolean;
        defaultLaborRate?: number;
        serviceRemindersEnabled?: boolean;
        readyTextMode?: ReadyTextMode;
        appointmentRemindersEnabled?: boolean;
        taxRateBps?: number;
        taxAppliesTo?: TaxAppliesTo;
        booking?: BookingSettings;
      };
    }) => api.patch<{ appointments?: AppointmentShift | null }>("/shop", patch),
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
  // Sales tax: edited as a percent with 2 decimals, stored as basis points.
  // Snapshotted onto each RO at creation, so changing it here only affects
  // new ROs (the RO page offers "Apply current tax rate" for old ones).
  const savedTax = resolveTaxSettings(me?.shop?.settings);
  const [taxRatePct, setTaxRatePct] = useState<number | string>(bpsToPct(savedTax.taxRateBps));
  const [taxAppliesTo, setTaxAppliesTo] = useState<TaxAppliesTo>(savedTax.taxAppliesTo);
  const draftTaxBps = pctToBps(Number(taxRatePct || 0));
  const taxDirty = draftTaxBps !== savedTax.taxRateBps || taxAppliesTo !== savedTax.taxAppliesTo;

  // ── Shop profile (name, address, phone, timezone) ──────────────
  // Drafts are seeded from `me` and re-seeded whenever the server copy
  // changes (after a save, or on first load).
  const shop = me?.shop;
  const [profile, setProfile] = useState({
    name: shop?.name ?? "",
    line1: shop?.address?.line1 ?? "",
    line2: shop?.address?.line2 ?? "",
    city: shop?.address?.city ?? "",
    state: (shop?.address?.state ?? null) as string | null,
    zip: shop?.address?.zip ?? "",
    phone: shop?.phone ?? "",
    timezone: shop?.timezone ?? "America/Chicago",
  });
  const [tzOther, setTzOther] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  useEffect(() => {
    if (!shop) return;
    setProfile({
      name: shop.name ?? "",
      line1: shop.address?.line1 ?? "",
      line2: shop.address?.line2 ?? "",
      city: shop.address?.city ?? "",
      state: shop.address?.state ?? null,
      zip: shop.address?.zip ?? "",
      phone: shop.phone ?? "",
      timezone: shop.timezone ?? "America/Chicago",
    });
    setTzOther(!US_TIMEZONES.some((z) => z.value === (shop.timezone ?? "America/Chicago")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shop?.name,
    shop?.address?.line1,
    shop?.address?.line2,
    shop?.address?.city,
    shop?.address?.state,
    shop?.address?.zip,
    shop?.phone,
    shop?.timezone,
  ]);
  const tzIsCurated = US_TIMEZONES.some((z) => z.value === profile.timezone);

  // Timezone change guard (QA round-2 M1): a zone switch with visits on the
  // books first asks keep-clock vs keep-instant, then (keep_instant only)
  // offers to text the affected customers. See TimezoneChangeModal.
  const [tzRequest, setTzRequest] = useState<
    (TimezoneChangeRequest & { payload: Parameters<typeof patchShop.mutate>[0] }) | null
  >(null);
  const [tzShift, setTzShift] = useState<AppointmentShift | null>(null);
  const [tzChecking, setTzChecking] = useState(false);

  async function confirmTimezoneChange(mode: AppointmentMode) {
    if (!tzRequest) return;
    try {
      const res = await patchShop.mutateAsync({ ...tzRequest.payload, appointmentMode: mode });
      setTzRequest(null);
      if (res.appointments && res.appointments.mode === "keep_instant") {
        setTzShift(res.appointments);
      }
      // keep_clock: the board moves with the customers' texts; the RO cache is
      // stale until refetched.
      qc.invalidateQueries({ queryKey: ["ros"] });
      qc.invalidateQueries({ queryKey: ["ro"] });
    } catch {
      // patchShop.onError already showed the toast; keep the dialog open.
    }
  }

  async function saveProfile() {
    const name = profile.name.replace(/\s+/g, " ").trim();
    if (name.length < 2) {
      setProfileError("Shop name needs at least 2 characters.");
      return;
    }
    const phone = profile.phone.trim() ? normalizePhone(profile.phone) : null;
    if (profile.phone.trim() && !phone) {
      setProfileError("Phone should be a 10-digit US number.");
      return;
    }
    const timezone = profile.timezone.trim();
    if (!isValidTimezone(timezone)) {
      setProfileError("Timezone should be an IANA name like America/New_York.");
      return;
    }
    setProfileError(null);
    const payload = {
      name,
      address: {
        line1: profile.line1,
        line2: profile.line2,
        city: profile.city,
        state: profile.state ?? undefined,
        zip: profile.zip,
      },
      phone,
      timezone,
    };

    const currentTz = shop?.timezone ?? "America/Chicago";
    if (timezone !== currentTz) {
      // Count upcoming scheduled visits before committing the zone change.
      setTzChecking(true);
      try {
        const { ros } = await api.get<{ ros: Array<{ scheduledFor: string | null }> }>(
          "/repair-orders?status=scheduled&limit=200"
        );
        const now = Date.now();
        const count = ros.filter(
          (r) => r.scheduledFor && new Date(r.scheduledFor).getTime() > now
        ).length;
        if (count > 0) {
          setTzRequest({ count, fromTz: currentTz, toTz: timezone, payload });
          return;
        }
      } catch (err) {
        notifyError(err, { title: "Couldn't check upcoming appointments" });
        return;
      } finally {
        setTzChecking(false);
      }
    }
    patchShop.mutate(payload);
  }

  const openBillingPortal = useMutation({
    mutationFn: () => api.post<{ url: string }>("/billing/portal-session"),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (err) => notifyError(err, { title: "Couldn't open billing" }),
  });

  // ── Getting paid (Stripe Connect, lazy setup) ──────────────────
  const payments = me?.shop?.payments;
  const startPaymentSetup = useMutation({
    mutationFn: () => api.post<{ url: string }>("/payments/connect/start"),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (err) => notifyError(err, { title: "Couldn't start payment setup" }),
  });

  // Returning from Stripe-hosted onboarding (?connect=return|refresh): sync
  // the account state, refresh `me`, and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("connect")) return;
    window.history.replaceState(null, "", window.location.pathname);
    api
      .post("/payments/connect/refresh")
      .then(() => qc.invalidateQueries({ queryKey: ["me"] }))
      .catch(() => {
        /* next Settings visit re-syncs */
      });
  }, [qc]);

  // ── Team (techs sharing this shop's login) ─────────────────────
  const isOwner = me?.user.role === "owner";
  const team = useQuery({
    queryKey: ["team"],
    queryFn: () => api.get<{ members: TeamMember[] }>("/team"),
    enabled: !!me?.shop,
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const invite = useMutation({
    mutationFn: (body: { email: string; phone?: string }) =>
      api.post<{ ok: true; resent: boolean }>("/team/invites", body),
    onSuccess: (res) => {
      setInviteEmail("");
      setInvitePhone("");
      qc.invalidateQueries({ queryKey: ["team"] });
      notifications.show({
        color: "green",
        message: res.resent ? "Sign-in link re-sent." : "Invite sent — they'll get a sign-in link by email.",
      });
    },
    onError: (err) => notifyError(err, { title: "Couldn't add tech" }),
  });
  const removeMember = useMutation({
    mutationFn: (id: string) => api.del<void>(`/team/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team"] });
      notifications.show({ color: "green", message: "Removed from the shop." });
    },
    onError: (err) => notifyError(err, { title: "Couldn't remove" }),
  });
  function submitInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    const phone = normalizePhone(invitePhone);
    if (invitePhone.trim() && !phone) {
      notifications.show({ color: "red", message: "Phone should be a 10-digit US number." });
      return;
    }
    invite.mutate(phone ? { email, phone } : { email });
  }

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
    // "Agent Test Garage" → "agent-test-garage"; only a result that is still
    // unusable (too short/long, empty) gets the error.
    const v = slugifyShopName(slugDraft);
    setSlugDraft(v);
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

      <Divider label="Shop profile" />
      <Text size="sm" c="dimmed">
        The name goes on every text and estimate. Address and timezone drive your booking page
        and visit times.
      </Text>
      <TextInput
        label="Shop name"
        value={profile.name}
        onChange={(e) => setProfile({ ...profile, name: e.currentTarget.value })}
        required
      />
      <Group grow align="start">
        <TextInput
          label="Address"
          value={profile.line1}
          onChange={(e) => setProfile({ ...profile, line1: e.currentTarget.value })}
          placeholder="123 Main St"
        />
        <TextInput
          label="Suite / unit"
          value={profile.line2}
          onChange={(e) => setProfile({ ...profile, line2: e.currentTarget.value })}
        />
      </Group>
      <Group grow align="start">
        <TextInput
          label="City"
          value={profile.city}
          onChange={(e) => setProfile({ ...profile, city: e.currentTarget.value })}
        />
        <Select
          label="State"
          placeholder="Pick a state"
          data={STATE_OPTIONS}
          value={profile.state}
          onChange={(v) => setProfile({ ...profile, state: v })}
          searchable
          clearable
          nothingFoundMessage="No match"
        />
        <TextInput
          label="ZIP"
          value={profile.zip}
          onChange={(e) => setProfile({ ...profile, zip: e.currentTarget.value })}
          maxLength={10}
        />
      </Group>
      <Group grow align="start">
        <TextInput
          label="Shop phone"
          description="The number customers call. Texts still come from Lift's number."
          placeholder="(864) 555-0134"
          type="tel"
          value={profile.phone}
          onChange={(e) => setProfile({ ...profile, phone: e.currentTarget.value })}
        />
        <Select
          label="Timezone"
          description="Sets visit times and the booking calendar."
          data={TZ_OPTIONS}
          value={tzOther || !tzIsCurated ? TZ_OTHER : profile.timezone}
          onChange={(v) => {
            if (!v) return;
            if (v === TZ_OTHER) {
              setTzOther(true);
            } else {
              setTzOther(false);
              setProfile({ ...profile, timezone: v });
            }
          }}
        />
      </Group>
      {(tzOther || !tzIsCurated) && (
        <TextInput
          label="Timezone (IANA name)"
          placeholder="America/New_York"
          value={profile.timezone}
          onChange={(e) => setProfile({ ...profile, timezone: e.currentTarget.value })}
          w={280}
        />
      )}
      {profileError && (
        <Text size="sm" c="red">
          {profileError}
        </Text>
      )}
      <Group>
        <Button onClick={saveProfile} loading={patchShop.isPending || tzChecking}>
          Save shop profile
        </Button>
      </Group>
      <TimezoneChangeModal
        request={tzRequest}
        saving={patchShop.isPending}
        onCancel={() => setTzRequest(null)}
        onConfirm={confirmTimezoneChange}
        shift={tzShift}
        onShiftDone={() => setTzShift(null)}
      />

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

      <Divider label="Status texts" />
      <Select
        label="When a car hits Ready"
        data={READY_TEXT_MODES.map((m) => ({ value: m, label: READY_TEXT_MODE_LABELS[m] }))}
        value={me?.shop?.settings.readyTextMode ?? "prompt"}
        onChange={(v) =>
          v && patchShop.mutate({ settings: { readyTextMode: v as ReadyTextMode } })
        }
        description="“Ask me first” shows you the text and waits. “Send it automatically” texts the same thing on its own and shows you what went out."
      />
      <Switch
        label="Remind customers the day before their appointment"
        checked={me?.shop?.settings.appointmentRemindersEnabled ?? true}
        onChange={(e) =>
          patchShop.mutate({
            settings: { appointmentRemindersEnabled: e.currentTarget.checked },
          })
        }
        description="One text around 5pm the day before, with a link to cancel or move the time. Nothing goes out for a job you already closed."
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
              onChange={(e) => setSlugDraft(liveSlug(e.currentTarget.value))}
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

      <Divider label="Sales tax" />
      <Group align="end" wrap="wrap">
        <NumberInput
          label="Tax rate (%)"
          description="Shows as its own line on estimates, texts and receipts."
          min={0}
          max={30}
          decimalScale={2}
          suffix="%"
          value={taxRatePct}
          onChange={setTaxRatePct}
          w={200}
        />
        <Select
          label="Applies to"
          description="Most states tax parts, not labor."
          data={TAX_APPLIES_TO.map((v) => ({ value: v, label: TAX_APPLIES_TO_LABELS[v] }))}
          value={taxAppliesTo}
          onChange={(v) => v && setTaxAppliesTo(v as TaxAppliesTo)}
          allowDeselect={false}
          w={200}
        />
        <Button
          variant="default"
          onClick={() =>
            patchShop.mutate({ settings: { taxRateBps: draftTaxBps, taxAppliesTo } })
          }
          disabled={!taxDirty}
        >
          Save tax
        </Button>
      </Group>
      <Text size="xs" c="dimmed">
        Changing this only affects new repair orders. Open an RO and tap “Apply current tax
        rate” to update an existing one.
      </Text>

      <Divider label="Team" />
      <Text size="sm" c="dimmed">
        Techs sign in with their own email and see the same board, ROs, customers, and texts.
        {isOwner ? " Only you can manage payments, billing, and the team." : ""}
      </Text>
      {team.data && team.data.members.length > 0 && (
        <Table verticalSpacing="xs" withRowBorders={false}>
          <Table.Tbody>
            {team.data.members.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td>
                  <Text size="sm" fw={m.isYou ? 600 : 400} style={{ wordBreak: "break-all" }}>
                    {m.email}
                    {m.isYou ? " (you)" : ""}
                  </Text>
                  {m.phone && (
                    <Text size="xs" c="dimmed">
                      {m.phone}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Group gap="xs" justify="flex-end" wrap="nowrap">
                    {m.role === "owner" ? (
                      <Badge variant="light">Owner</Badge>
                    ) : m.pending ? (
                      <Badge variant="light" color="yellow">
                        Invited
                      </Badge>
                    ) : (
                      <Badge variant="light" color="gray">
                        Tech
                      </Badge>
                    )}
                    {isOwner && m.role === "tech" && (
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Remove ${m.email}`}
                        loading={removeMember.isPending && removeMember.variables === m.id}
                        onClick={() => {
                          if (window.confirm(`Remove ${m.email} from the shop? They'll lose access right away.`)) {
                            removeMember.mutate(m.id);
                          }
                        }}
                      >
                        ×
                      </ActionIcon>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {isOwner && (
        <Stack gap="xs">
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Add a tech"
              placeholder="tech@example.com"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && submitInvite()}
              style={{ flex: 1, minWidth: 220 }}
            />
            <TextInput
              label="Cell (optional)"
              description="Lets them sign in with a text code too"
              placeholder="(512) 555-0134"
              type="tel"
              value={invitePhone}
              onChange={(e) => setInvitePhone(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && submitInvite()}
              style={{ flex: 1, minWidth: 180 }}
            />
            <Button onClick={submitInvite} loading={invite.isPending} disabled={!inviteEmail.trim()}>
              Send invite
            </Button>
          </Group>
        </Stack>
      )}

      {isOwner && (
        <>
      <Divider label="Getting paid" />
      {payments?.chargesEnabled ? (
        <Alert color="green" variant="light">
          Payments active — customers' card payments go straight to your bank through Stripe.
          Manage payouts and refunds at dashboard.stripe.com.
        </Alert>
      ) : (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            {payments?.hasAccount
              ? "Payment setup was started but isn't finished — pick up where you left off."
              : "Connect a free Stripe account so customers can pay their bill from a text. Takes about 5 minutes; card money goes straight to your bank."}
          </Text>
          <Group>
            <Button
              onClick={() => startPaymentSetup.mutate()}
              loading={startPaymentSetup.isPending}
            >
              {payments?.hasAccount ? "Finish payment setup" : "Set up payments"}
            </Button>
          </Group>
        </Stack>
      )}

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
        </>
      )}
    </Stack>
  );
}
