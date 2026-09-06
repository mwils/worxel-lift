import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Anchor,
  Badge,
  Button,
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
import { IconPrinter } from "@tabler/icons-react";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@lift/shared/constants";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatPhone, formatRoNumber } from "../../lib/format";

interface PublicLineItem {
  kind: string;
  description: string;
  hours?: number | null;
  rate?: number | null; // cents/hr
  qty?: number | null;
  unitPrice?: number | null; // cents
  total: number;
}

interface PublicReceipt {
  ro: {
    number: number;
    status: string;
    concern?: string | null;
    lineItems?: PublicLineItem[];
    laborTotal?: number;
    partsTotal?: number;
    taxTotal?: number;
    total: number;
    completedAt?: string | null;
    createdAt?: string | null;
  };
  payment: { status: string; collectedCents: number; balanceCents: number };
  payments: Array<{
    id: string | null;
    amountCents: number;
    status: string;
    method: PaymentMethod | null;
    last4: string | null;
    paidAt: string | null;
  }>;
  customer: { firstName: string; lastName?: string | null } | null;
  vehicle: {
    year?: number | null;
    make?: string | null;
    model?: string | null;
    plate?: string | null;
    vin?: string | null;
    mileage?: number | null;
  } | null;
  shop: {
    name: string;
    phone?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
    } | null;
  } | null;
}

function formatWhen(iso: string | null | undefined, withTime = true): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

function lineDetail(li: PublicLineItem): string | null {
  if (li.kind === "labor" && li.hours != null && li.rate != null && li.rate > 0) {
    const hrs = Number(li.hours);
    return `${hrs % 1 === 0 ? hrs.toFixed(0) : hrs.toFixed(1)} hr${hrs === 1 ? "" : "s"} @ ${formatMoney(
      li.rate
    )}/hr`;
  }
  if (li.kind === "part" && li.qty != null && li.unitPrice != null && li.qty > 1) {
    return `${li.qty} × ${formatMoney(li.unitPrice)}`;
  }
  return null;
}

function Unavailable({ title, body }: { title: string; body: string }) {
  return (
    <Container size={520} py="xl">
      <Stack gap="xs">
        <Title order={3}>{title}</Title>
        <Text c="dimmed">{body}</Text>
      </Stack>
    </Container>
  );
}

// Print: hide the button, drop card chrome, keep it to one column of ink.
const PRINT_CSS = `
@media print {
  .receipt-no-print { display: none !important; }
  .receipt-card { border: none !important; box-shadow: none !important; padding: 0 !important; }
  body { background: #fff !important; }
}
`;

/**
 * Public, tokenized receipt — what the customer keeps. Same layout as the
 * public estimate page, plus a payments block and print CSS.
 */
export function PublicReceiptRoute() {
  const { token } = useParams<{ token: string }>();

  const { data, isPending, error } = useQuery({
    queryKey: ["public-receipt", token],
    queryFn: () => api.get<PublicReceipt>(`/public/receipt/${token}`),
    enabled: !!token,
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (error || !data?.ro) {
    if (error instanceof ApiError && error.status >= 500) {
      return (
        <Unavailable
          title="Something went wrong on our end"
          body="Give it a minute and reopen the link from your text."
        />
      );
    }
    return (
      <Unavailable
        title="This link has expired or isn't valid"
        body="Check the link in your text, or reach out to the shop for a fresh one."
      />
    );
  }

  const ro = data.ro;
  const lineItems = ro.lineItems ?? [];
  const taxTotal = ro.taxTotal ?? 0;
  const laborTotal = ro.laborTotal ?? 0;
  const partsTotal = ro.partsTotal ?? 0;
  const showBreakdown = taxTotal > 0 || (laborTotal > 0 && partsTotal > 0);
  const payments = data.payments ?? [];
  const balance = data.payment?.balanceCents ?? 0;
  const collected = data.payment?.collectedCents ?? 0;
  const status = data.payment?.status ?? "unpaid";

  const shop = data.shop;
  const addr = shop?.address;
  const addressLine1 = [addr?.line1, addr?.line2].filter(Boolean).join(", ");
  const addressLine2 = [addr?.city, [addr?.state, addr?.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const vehicleSummary = data.vehicle
    ? [data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(" ")
    : "";
  const vehicleDetail = data.vehicle
    ? [
        data.vehicle.plate ? `Plate ${data.vehicle.plate}` : null,
        data.vehicle.vin ? `VIN ${data.vehicle.vin}` : null,
        data.vehicle.mileage != null ? `${data.vehicle.mileage.toLocaleString()} mi` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const receiptDate = formatWhen(ro.completedAt ?? payments[payments.length - 1]?.paidAt ?? ro.createdAt, false);
  const customerName = data.customer
    ? [data.customer.firstName, data.customer.lastName].filter(Boolean).join(" ")
    : null;

  const statusBadge =
    status === "paid" ? (
      <Badge color="teal" variant="light">
        Paid in full
      </Badge>
    ) : status === "partial" ? (
      <Badge color="orange" variant="light">
        {formatMoney(balance)} due
      </Badge>
    ) : status === "refunded" ? (
      <Badge color="red" variant="light">
        Refunded
      </Badge>
    ) : (
      <Badge color="gray" variant="light">
        Unpaid
      </Badge>
    );

  return (
    <Container size={520} py="lg">
      <style>{PRINT_CSS}</style>
      <Stack>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={0}>
            {shop?.name && (
              <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
                {shop.name}
              </Text>
            )}
            <Title order={2}>Receipt</Title>
            <Text size="sm" c="dimmed">
              {formatRoNumber(ro.number)}
              {receiptDate ? ` · ${receiptDate}` : ""}
            </Text>
          </Stack>
          <Stack gap={6} align="flex-end">
            {statusBadge}
            <Button
              className="receipt-no-print"
              variant="default"
              size="xs"
              leftSection={<IconPrinter size={14} />}
              onClick={() => window.print()}
            >
              Print / save PDF
            </Button>
          </Stack>
        </Group>

        <Stack gap={0}>
          {customerName && <Text>{customerName}</Text>}
          {vehicleSummary && <Text>{vehicleSummary}</Text>}
          {vehicleDetail && (
            <Text size="sm" c="dimmed">
              {vehicleDetail}
            </Text>
          )}
          {ro.concern && (
            <Text size="sm" c="dimmed">
              Concern: {ro.concern}
            </Text>
          )}
        </Stack>

        <Card className="receipt-card" withBorder>
          <Stack gap="xs">
            {lineItems.length === 0 && (
              <Text c="dimmed" size="sm">
                No line items.
              </Text>
            )}
            {lineItems.map((li, i) => {
              const detail = lineDetail(li);
              return (
                <Group key={i} justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={0}>
                    <Text>{li.description}</Text>
                    {detail && (
                      <Text size="xs" c="dimmed">
                        {detail}
                      </Text>
                    )}
                  </Stack>
                  <Text style={{ whiteSpace: "nowrap" }}>{formatMoney(li.total)}</Text>
                </Group>
              );
            })}
            <Divider />
            {showBreakdown && (
              <>
                {laborTotal > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Labor
                    </Text>
                    <Text size="sm">{formatMoney(laborTotal)}</Text>
                  </Group>
                )}
                {partsTotal !== 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Parts &amp; fees
                    </Text>
                    <Text size="sm">{formatMoney(partsTotal)}</Text>
                  </Group>
                )}
                {taxTotal > 0 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Tax
                    </Text>
                    <Text size="sm">{formatMoney(taxTotal)}</Text>
                  </Group>
                )}
              </>
            )}
            <Group justify="space-between">
              <Text fw={600}>Total</Text>
              <Text fw={600}>{formatMoney(ro.total)}</Text>
            </Group>
          </Stack>
        </Card>

        <Card className="receipt-card" withBorder>
          <Stack gap="xs">
            <Text fw={600}>Payments</Text>
            {payments.length === 0 && (
              <Text size="sm" c="dimmed">
                No payments recorded yet.
              </Text>
            )}
            {payments.map((p, i) => (
              <Group key={p.id ?? i} justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={0}>
                  <Text size="sm">
                    {p.method ? PAYMENT_METHOD_LABELS[p.method] : "Payment"}
                    {p.last4 ? ` ···${p.last4}` : ""}
                    {p.status === "refunded" ? " — refunded" : ""}
                  </Text>
                  {formatWhen(p.paidAt) && (
                    <Text size="xs" c="dimmed">
                      {formatWhen(p.paidAt)}
                    </Text>
                  )}
                </Stack>
                <Text size="sm" td={p.status === "refunded" ? "line-through" : undefined}>
                  {formatMoney(p.amountCents)}
                </Text>
              </Group>
            ))}
            <Divider />
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Paid
              </Text>
              <Text size="sm">{formatMoney(collected)}</Text>
            </Group>
            <Group justify="space-between">
              <Text fw={600}>{balance > 0 ? "Balance due" : "Balance"}</Text>
              <Text fw={600}>{formatMoney(balance)}</Text>
            </Group>
          </Stack>
        </Card>

        {shop && (shop.phone || addressLine1 || addressLine2) && (
          <>
            <Divider />
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                {shop.name}
              </Text>
              {addressLine1 && <Text size="sm">{addressLine1}</Text>}
              {addressLine2 && <Text size="sm">{addressLine2}</Text>}
              {shop.phone && (
                <Text size="sm">
                  Questions? Call or text{" "}
                  <Anchor href={`tel:${shop.phone}`}>{formatPhone(shop.phone)}</Anchor>
                </Text>
              )}
            </Stack>
          </>
        )}
        <Text size="xs" c="dimmed">
          Keep this for your records. {formatRoNumber(ro.number)} is your invoice reference.
        </Text>
      </Stack>
    </Container>
  );
}
