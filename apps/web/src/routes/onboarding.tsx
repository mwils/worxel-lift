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
} from "@mantine/core";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { IconInfoCircle } from "@tabler/icons-react";
import { api } from "../lib/api";
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

  const [setup, setSetup] = useState<StripeSetupResp | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function createShop() {
    try {
      await api.post("/onboard/shop", {
        name: shopName,
        address: { city, state },
      });
      setStep(1);
    } catch (err) {
      notifications.show({ color: "red", message: (err as Error).message });
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
      notifications.show({ color: "red", message: (err as Error).message });
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
      <Stack mb="lg">
        <Title order={1}>Welcome to Lift</Title>
        <Text c="dimmed">A few minutes and you're set up.</Text>
      </Stack>

      <Paper p="lg" withBorder>
        <Stepper active={step}>
          <Stepper.Step label="Shop">
            <Stack mt="md">
              <TextInput
                label="Shop name"
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
                Continue
              </Button>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="SMS number">
            <Stack mt="md">
              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                You'll get a dedicated shop phone number once our 10DLC campaign is approved.
                Until then SMS is mocked to your email so you can see exactly what customers would receive.
              </Alert>
              <Button onClick={() => setStep(2)}>Continue</Button>
            </Stack>
          </Stepper.Step>

          <Stepper.Step label="Trial + card">
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
                  Skip for now
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
