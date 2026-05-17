import { useEffect, useMemo, useState } from "react";
import { Modal, Stack, Button, Text, Alert } from "@mantine/core";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

export interface PaymentSheetProps {
  opened: boolean;
  onClose: () => void;
  clientSecret: string;
  publishableKey: string;
  onSuccess: () => void;
  /**
   * "setup"   — collects a card for future off-session charges (uses SetupIntent / confirmSetup).
   *             Used in onboarding (subscription trial) and customer card-on-file flows.
   * "payment" — confirms a one-time payment (uses PaymentIntent / confirmPayment).
   *             Used on the public pay page.
   */
  mode: "setup" | "payment";
}

// Cache loadStripe promises per publishable key — Stripe explicitly recommends
// calling loadStripe outside React render. We can't do that here cleanly
// because the key arrives via props, so memoize by key.
const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripe(publishableKey: string): Promise<Stripe | null> {
  let p = stripeCache.get(publishableKey);
  if (!p) {
    p = loadStripe(publishableKey);
    stripeCache.set(publishableKey, p);
  }
  return p;
}

export function PaymentSheet(props: PaymentSheetProps) {
  const { opened, onClose, clientSecret, publishableKey, onSuccess, mode } = props;

  const stripePromise = useMemo(() => {
    if (!publishableKey || publishableKey === "MISSING") return null;
    return getStripe(publishableKey);
  }, [publishableKey]);

  if (!stripePromise || !clientSecret) {
    return (
      <Modal opened={opened} onClose={onClose} title="Payment unavailable" centered>
        <Alert color="red">
          Stripe is not configured. Set <code>STRIPE_PUBLISHABLE_KEY</code> and try again.
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title={mode === "setup" ? "Save card" : "Pay"} centered>
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <PaymentForm mode={mode} onSuccess={onSuccess} />
      </Elements>
    </Modal>
  );
}

function PaymentForm({ mode, onSuccess }: { mode: "setup" | "payment"; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Once a successful intent is reflected in the URL (`?redirect_status=succeeded`),
  // bubble up. Useful when Stripe redirects back from 3DS challenges.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const status = url.searchParams.get("redirect_status");
    if (status === "succeeded") onSuccess();
  }, [onSuccess]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const returnUrl = window.location.href;

    const result =
      mode === "setup"
        ? await stripe.confirmSetup({
            elements,
            confirmParams: { return_url: returnUrl },
            redirect: "if_required",
          })
        : await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
            redirect: "if_required",
          });

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Payment failed");
      return;
    }

    // Success when no redirect was needed (e.g. no 3DS).
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack>
        <PaymentElement onReady={() => setReady(true)} />
        {error && <Text c="red" size="sm">{error}</Text>}
        <Button type="submit" loading={submitting} disabled={!stripe || !elements || !ready}>
          {mode === "setup" ? "Save card" : "Pay now"}
        </Button>
      </Stack>
    </form>
  );
}
