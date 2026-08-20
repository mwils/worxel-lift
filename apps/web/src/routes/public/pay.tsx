import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconCircleCheck } from "@tabler/icons-react";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatRoNumber } from "../../lib/format";
import { PaymentSheet } from "../../features/payments/PaymentSheet";

interface PublicPay {
  clientSecret: string | null;
  stripeAccountId: string | null;
  publishableKey: string;
  paid: boolean;
  payable: boolean;
  ro: { number: number; total: number; status: string };
  customer: { firstName: string; lastName: string | null } | null;
  shop: { name: string } | null;
}

export function PublicPayRoute() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["public-pay", token],
    queryFn: () => api.get<PublicPay>(`/public/pay/${token}`),
    enabled: !!token,
  });

  // After a successful client-side confirm, poll the endpoint a few times so
  // the user sees the "paid" state quickly even though the Stripe webhook is
  // the source of truth.
  useEffect(() => {
    if (!confirmed) return;
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      const fresh = await refetch();
      if (fresh.data?.paid || attempts >= 5) clearInterval(interval);
    }, 1500);
    return () => clearInterval(interval);
  }, [confirmed, refetch]);

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!data) {
    // A 404 means the link genuinely doesn't resolve; anything else is a
    // server/Stripe hiccup — don't tell the customer their link is dead.
    const gone = error instanceof ApiError && error.status === 404;
    return (
      <Container py="xl" size={520}>
        <Text>
          {gone
            ? "This pay link has expired or already been paid. Reply to the shop's text if you have questions."
            : "Something went wrong loading this payment. Try again in a minute, or call the shop to pay."}
        </Text>
      </Container>
    );
  }

  const paid = data.paid || confirmed;

  if (!paid && !data.payable) {
    return (
      <Container py="xl" size={520}>
        <Stack gap="xs">
          <Title order={3}>{data.shop?.name ?? "This shop"}</Title>
          <Text>
            {data.shop?.name ?? "This shop"} doesn't take online payments yet — give them a
            call or pay at the counter. Reply to their text if you have questions.
          </Text>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size={520} py="lg">
      <Stack>
        <Title order={2}>{data.shop?.name ?? "Payment"}</Title>
        <Text c="dimmed">
          {data.customer
            ? `${data.customer.firstName}${data.customer.lastName ? " " + data.customer.lastName : ""} · `
            : ""}
          {formatRoNumber(data.ro.number)}
        </Text>

        <Card withBorder>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text>Amount due</Text>
              <Text fw={700}>{formatMoney(data.ro.total)}</Text>
            </Group>
            <Divider />
            {paid ? (
              <Group gap="xs" c="green">
                <IconCircleCheck size={20} />
                <Text fw={600}>Paid — thanks!</Text>
              </Group>
            ) : (
              <Text size="sm" c="dimmed">
                Enter your card to pay. You'll get a receipt by email.
              </Text>
            )}
          </Stack>
        </Card>

        {!paid && data.clientSecret && (
          <PaymentSheet
            opened
            onClose={() => {
              /* The pay page keeps the sheet open — closing is a no-op. */
            }}
            clientSecret={data.clientSecret}
            publishableKey={data.publishableKey}
            stripeAccount={data.stripeAccountId}
            mode="payment"
            onSuccess={async () => {
              setConfirmed(true);
              // Tell the server we confirmed; webhook is still source of truth.
              try {
                await api.post(`/public/pay/${token}`, {
                  paymentIntentId: extractPiId(data.clientSecret),
                });
              } catch {
                // best-effort
              }
              qc.invalidateQueries({ queryKey: ["public-pay", token] });
            }}
          />
        )}
      </Stack>
    </Container>
  );
}

// PaymentIntent client secrets look like `pi_xxx_secret_yyy`. The PI id is the
// portion before `_secret_`.
function extractPiId(clientSecret: string | null): string {
  if (!clientSecret) return "";
  const idx = clientSecret.indexOf("_secret_");
  return idx > 0 ? clientSecret.slice(0, idx) : clientSecret;
}
