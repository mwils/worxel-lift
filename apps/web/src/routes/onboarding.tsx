import { useState } from "react";
import {
  Stepper,
  Container,
  Paper,
  Stack,
  Title,
  Text,
  Button,
  TextInput,
  Select,
  NumberInput,
  Group,
  Alert,
  Anchor,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { IconInfoCircle } from "@tabler/icons-react";
import {
  US_STATE_CODES,
  US_STATE_NAMES,
  resolveShopTimezone,
} from "@lift/shared/constants";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatPhone } from "../lib/format";
import { notifyError } from "../lib/notify";
import { PaymentSheet } from "../features/payments/PaymentSheet";

interface StripeSetupResp {
  clientSecret: string | null;
  publishableKey: string;
}

const STATE_OPTIONS = US_STATE_CODES.map((code) => ({
  value: code,
  label: `${code} — ${US_STATE_NAMES[code]}`,
}));

// Matches the starter templates' $135/hr so the first labor row and the
// imported jobs agree.
const DEFAULT_LABOR_RATE_DOLLARS = 135;

function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export function OnboardingRoute() {
  const [step, setStep] = useState(0);
  const { me } = useAuth();
  const [shopName, setShopName] = useState(me?.shop?.name ?? "");
  const [city, setCity] = useState(me?.shop?.address?.city ?? "");
  const [state, setState] = useState<string | null>(me?.shop?.address?.state ?? null);
  const [laborRateDollars, setLaborRateDollars] = useState<number | undefined>(
    me?.shop?.settings.defaultLaborRate != null
      ? me.shop.settings.defaultLaborRate / 100
      : DEFAULT_LABOR_RATE_DOLLARS
  );
  // Once the shop exists, Back + Next re-saves via PATCH instead of POSTing a
  // second shop (the POST is idempotent but ignores changed fields).
  const [shopCreated, setShopCreated] = useState(!!me?.shop);
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Email is the only sign-in credential, and instant signup skips the
  // round-trip that used to catch typos — so surface it here while a
  // do-over is still cheap.
  async function startOver() {
    try {
      await api.post("/auth/logout");
    } catch {
      // best-effort — still bounce to login
    }
    window.location.href = "/login";
  }

  const [setup, setSetup] = useState<StripeSetupResp | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameOk = shopName.trim().length >= 2;
  const rateCents =
    laborRateDollars != null && laborRateDollars > 0
      ? Math.round(laborRateDollars * 100)
      : undefined;

  async function saveShop() {
    setSaving(true);
    try {
      const address = { city, state: state ?? undefined };
      const tz = browserTimezone();
      if (shopCreated) {
        await api.patch("/shop", {
          name: shopName,
          address,
          timezone: resolveShopTimezone(state, tz),
          ...(rateCents ? { settings: { defaultLaborRate: rateCents } } : {}),
        });
      } else {
        let pid: string | null = null;
        try {
          pid = localStorage.getItem("lift_pid");
        } catch { /* private mode — ignore */ }
        await api.post("/onboard/shop", {
          name: shopName,
          address,
          // Browser zone as a hint — the server derives the shop zone from
          // the state and uses this for split states / no state.
          ...(tz ? { timezone: tz } : {}),
          ...(rateCents ? { defaultLaborRate: rateCents } : {}),
          ...(pid ? { pid } : {}),
        });
        if (pid) {
          try {
            localStorage.removeItem("lift_pid");
          } catch { /* ignore */ }
        }
        setShopCreated(true);
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      setStep(1);
    } catch (err) {
      notifyError(err, { title: shopCreated ? "Couldn't save shop" : "Couldn't create shop" });
    } finally {
      setSaving(false);
    }
  }

  async function startTrialSetup() {
    setBusy(true);
    try {
      const res = await api.post<StripeSetupResp>("/onboard/stripe-setup-intent");
      setSetup(res);
      if (res.clientSecret && res.publishableKey && res.publishableKey !== "MISSING") {
        setPaymentOpen(true);
      } else {
        // Stripe not configured — skip card collection but still mark onboarded.
        await finish();
      }
    } catch (err) {
      notifyError(err, { title: "Couldn't finish setup" });
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    await qc.invalidateQueries({ queryKey: ["me"] });
    navigate("/", { replace: true });
  }

  // Shops on the shared Lift number have nothing to show here yet; the step
  // that used to promise a shop number was dropped. Dedicated numbers, when
  // assigned, surface in this note.
  const textingNumber = me?.shop?.sms?.phoneNumber ?? null;

  return (
    <Container size={600} py="xl">
      <Stack mb="lg" gap="xs">
        <Title order={1}>Let's get your shop on Lift</Title>
        <Text c="dimmed">Two quick screens, then you're sending estimates.</Text>
        {me && (
          <Text c="dimmed" size="sm">
            You're signed up as <b>{me.user.email}</b> — sign-in links go there.{" "}
            <Anchor size="sm" onClick={startOver}>
              Wrong email?
            </Anchor>
          </Text>
        )}
      </Stack>

      <Paper p="lg" withBorder>
        <Stepper active={step}>
          <Stepper.Step label="Your shop">
            <Stack mt="md">
              <TextInput
                label="Shop name"
                description="Customers see this on every text and estimate."
                value={shopName}
                onChange={(e) => setShopName(e.currentTarget.value)}
                placeholder="Mike's Auto"
                required
              />
              <Group grow align="start">
                <TextInput label="City" value={city} onChange={(e) => setCity(e.currentTarget.value)} />
                <Select
                  label="State"
                  placeholder="Pick a state"
                  data={STATE_OPTIONS}
                  value={state}
                  onChange={setState}
                  searchable
                  nothingFoundMessage="No match"
                />
              </Group>
              <NumberInput
                label="Labor rate ($/hr)"
                description="Starting rate for labor rows. Change it any time in Settings."
                min={0}
                decimalScale={2}
                value={laborRateDollars ?? ""}
                onChange={(v) => setLaborRateDollars(typeof v === "number" ? v : undefined)}
                w={240}
              />
              <Button onClick={saveShop} disabled={!nameOk} loading={saving}>
                Next: start trial
              </Button>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Start trial">
            <Stack mt="md">
              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                Your customers get texts about their car — estimates, status updates, and pay
                links — sent by Lift for {shopName.trim() || "your shop"}
                {textingNumber ? ` from ${formatPhone(textingNumber)}` : ""}. They can text back
                and it lands in your Messages inbox.
              </Alert>
              <Text>
                14-day free trial — no card needed to start. Add one now or later from Settings;
                either way we won't charge until the trial ends.
              </Text>
              <Group justify="space-between">
                <Button variant="subtle" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Group>
                  <Button variant="light" onClick={finish}>
                    Skip for now — start trial
                  </Button>
                  <Button variant="light" onClick={startTrialSetup} loading={busy}>
                    Add card & start trial
                  </Button>
                </Group>
              </Group>
            </Stack>
          </Stepper.Step>
        </Stepper>
      </Paper>

      {setup?.clientSecret && (
        <PaymentSheet
          opened={paymentOpen}
          onClose={() => setPaymentOpen(false)}
          clientSecret={setup.clientSecret}
          publishableKey={setup.publishableKey}
          mode="setup"
          onSuccess={async () => {
            setPaymentOpen(false);
            notifications.show({ color: "green", message: "Trial started — card on file." });
            await finish();
          }}
        />
      )}
    </Container>
  );
}
