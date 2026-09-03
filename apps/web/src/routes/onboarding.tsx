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
  Group,
  Alert,
  Anchor,
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { IconInfoCircle } from "@tabler/icons-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { notifyError } from "../lib/notify";
import { PaymentSheet } from "../features/payments/PaymentSheet";

interface StripeSetupResp {
  clientSecret: string | null;
  publishableKey: string;
}

export function OnboardingRoute() {
  const [step, setStep] = useState(0);
  const [shopName, setShopName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { me } = useAuth();

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

  async function createShop() {
    try {
      let pid: string | null = null;
      try {
        pid = localStorage.getItem("lift_pid");
      } catch { /* private mode — ignore */ }
      await api.post("/onboard/shop", {
        name: shopName,
        address: { city, state },
        ...(pid ? { pid } : {}),
      });
      if (pid) {
        try {
          localStorage.removeItem("lift_pid");
        } catch { /* ignore */ }
      }
      setStep(1);
    } catch (err) {
      notifyError(err, { title: "Couldn't create shop" });
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

  return (
    <Container size={600} py="xl">
      <Stack mb="lg" gap="xs">
        <Title order={1}>Let's get your shop on Lift</Title>
        <Text c="dimmed">Three quick screens, then you're sending estimates.</Text>
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
          <Stepper.Step label="Your shop" aria-label="Step 1 of 3: Your shop">
            <Stack mt="md">
              <TextInput
                label="Shop name"
                id="onboarding-shop-name"
                name="shopName"
                value={shopName}
                onChange={(e) => setShopName(e.currentTarget.value)}
                placeholder="Mike's Auto"
              />
              <Group grow>
                <TextInput label="City" value={city} onChange={(e) => setCity(e.currentTarget.value)} />
                <TextInput
                  label="State"
                  value={state}
                  onChange={(e) => setState(e.currentTarget.value)}
                  maxLength={2}
                />
              </Group>
              <Button onClick={createShop} disabled={!shopName}>
                Next: shop number
              </Button>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Shop number" aria-label="Step 2 of 3: Shop number">
            <Stack mt="md">
              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                Your customers get texts from your shop's Lift number — estimates, status
                updates, and pay links. They can text back and it lands in your Messages inbox.
              </Alert>
              <Button onClick={() => setStep(2)}>Next: card</Button>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Start trial" aria-label="Step 3 of 3: Start trial">
            <Stack mt="md">
              <Text>
                14-day free trial. Add a card on file — we'll only charge after the trial unless
                you cancel.
              </Text>
              <Group>
                <Button onClick={startTrialSetup} loading={busy}>
                  Add card & start trial
                </Button>
                <Button variant="subtle" onClick={finish}>
                  Skip — add card later
                </Button>
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
