import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
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
import { IconCalendarEvent, IconClipboardList, IconReceipt } from "@tabler/icons-react";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatPhone, formatRoNumber } from "../../lib/format";

interface PublicVisit {
  number: number;
  date: string | null;
  stage: "done" | "ready" | "active";
  concern: string | null;
  summary: string[];
  lineItemCount: number;
  total: number;
  payment: { status: string; balanceCents: number };
  mileage: number | null;
  receiptPath: string | null;
  inspectionPath: string | null;
}

interface PublicVehicle {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  plate: string | null;
  mileage: number | null;
  visits: PublicVisit[];
}

interface PublicAccount {
  shop: {
    name: string;
    phone: string | null;
    timezone: string | null;
    address: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    } | null;
  };
  customer: { firstName: string };
  upcoming: {
    number: number;
    scheduledFor: string | null;
    when: string;
    concern: string | null;
    vehicle: { year: number | null; make: string | null; model: string | null } | null;
    manageUrl: string | null;
  } | null;
  vehicles: PublicVehicle[];
  otherVisits: PublicVisit[];
}

function formatDay(iso: string | null, tz: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    ...(tz ? { timeZone: tz } : {}),
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function vehicleLabel(v: { year: number | null; make: string | null; model: string | null; plate?: string | null }) {
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || (v.plate ? `Plate ${v.plate}` : "Vehicle");
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

function PaidBadge({ payment, stage }: { payment: PublicVisit["payment"]; stage: PublicVisit["stage"] }) {
  if (payment.status === "paid") {
    return (
      <Badge color="teal" variant="light" size="sm">
        Paid
      </Badge>
    );
  }
  if (payment.status === "partial") {
    return (
      <Badge color="orange" variant="light" size="sm">
        {formatMoney(payment.balanceCents)} due
      </Badge>
    );
  }
  if (payment.status === "refunded") {
    return (
      <Badge color="red" variant="light" size="sm">
        Refunded
      </Badge>
    );
  }
  if (stage === "ready") {
    return (
      <Badge color="blue" variant="light" size="sm">
        Ready for pickup
      </Badge>
    );
  }
  if (stage === "active") {
    return (
      <Badge color="gray" variant="light" size="sm">
        In the shop
      </Badge>
    );
  }
  return (
    <Badge color="gray" variant="light" size="sm">
      Unpaid
    </Badge>
  );
}

function VisitCard({ visit, tz }: { visit: PublicVisit; tz: string | null }) {
  const day = formatDay(visit.date, tz);
  const more = visit.lineItemCount - visit.summary.length;
  return (
    <Card withBorder padding="sm">
      <Stack gap={6}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fw={600}>{day ?? formatRoNumber(visit.number)}</Text>
            <Text size="xs" c="dimmed">
              {formatRoNumber(visit.number)}
              {visit.mileage != null ? ` · ${visit.mileage.toLocaleString()} mi` : ""}
            </Text>
          </Stack>
          <Stack gap={4} align="flex-end">
            <Text fw={600} style={{ whiteSpace: "nowrap" }}>
              {formatMoney(visit.total)}
            </Text>
            <PaidBadge payment={visit.payment} stage={visit.stage} />
          </Stack>
        </Group>

        {visit.summary.length > 0 ? (
          <Stack gap={0}>
            {visit.summary.map((line, i) => (
              <Text key={i} size="sm">
                {line}
              </Text>
            ))}
            {more > 0 && (
              <Text size="sm" c="dimmed">
                +{more} more on the receipt
              </Text>
            )}
          </Stack>
        ) : visit.concern ? (
          <Text size="sm" c="dimmed">
            "{visit.concern}"
          </Text>
        ) : null}

        {(visit.receiptPath || visit.inspectionPath) && (
          <Group gap="xs">
            {visit.receiptPath && (
              <Button
                component={Link}
                to={visit.receiptPath}
                variant="default"
                size="xs"
                leftSection={<IconReceipt size={14} />}
              >
                Receipt
              </Button>
            )}
            {visit.inspectionPath && (
              <Button
                component={Link}
                to={visit.inspectionPath}
                variant="default"
                size="xs"
                leftSection={<IconClipboardList size={14} />}
              >
                Inspection
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </Card>
  );
}

/**
 * Public, tokenized customer history — every visit, receipt, and inspection
 * with one shop, plus the next booking. Read-only; the customer replies to
 * the shop's text for anything else. Same look as the receipt page.
 */
export function PublicAccountRoute() {
  const { token } = useParams<{ token: string }>();

  // This page is reached only from a text; keep it out of search results.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const prevTitle = document.title;
    document.title = "Your service history";
    return () => {
      meta.remove();
      document.title = prevTitle;
    };
  }, []);

  const { data, isPending, error } = useQuery({
    queryKey: ["public-account", token],
    queryFn: () => api.get<PublicAccount>(`/public/account/${token}`),
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

  if (error || !data?.shop) {
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

  const { shop, customer, upcoming, vehicles, otherVisits } = data;
  const tz = shop.timezone;
  const addr = shop.address;
  const addressLine1 = [addr?.line1, addr?.line2].filter(Boolean).join(", ");
  const addressLine2 = [addr?.city, [addr?.state, addr?.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const visitCount = vehicles.reduce((n, v) => n + v.visits.length, 0) + otherVisits.length;

  return (
    <Container size={520} py="lg">
      <Stack>
        <Stack gap={0}>
          <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
            {shop.name}
          </Text>
          <Title order={2}>Your service history</Title>
          <Text size="sm" c="dimmed">
            Hi {customer.firstName} — every visit, what we did, and your receipts, all in one place.
          </Text>
        </Stack>

        {upcoming && (
          <Card withBorder style={{ borderColor: "var(--mantine-color-blue-4)" }}>
            <Stack gap={6}>
              <Group gap="xs" wrap="nowrap">
                <IconCalendarEvent size={18} />
                <Text fw={600}>Coming up</Text>
              </Group>
              <Text>{upcoming.when}</Text>
              {upcoming.vehicle && (
                <Text size="sm" c="dimmed">
                  {vehicleLabel(upcoming.vehicle)}
                  {upcoming.concern ? ` · "${upcoming.concern}"` : ""}
                </Text>
              )}
              {!upcoming.vehicle && upcoming.concern && (
                <Text size="sm" c="dimmed">
                  "{upcoming.concern}"
                </Text>
              )}
              {upcoming.manageUrl && (
                <Button
                  component="a"
                  href={upcoming.manageUrl}
                  variant="light"
                  size="sm"
                  style={{ alignSelf: "flex-start", minHeight: 44 }}
                >
                  Change or cancel
                </Button>
              )}
            </Stack>
          </Card>
        )}

        {visitCount === 0 && vehicles.length === 0 && (
          <Text c="dimmed" size="sm">
            Nothing on file yet. Once you've been in, your visits and receipts will show up here.
          </Text>
        )}

        {vehicles.map((v) => (
          <Stack key={v.id} gap="xs">
            <Stack gap={0}>
              <Title order={4}>{vehicleLabel(v)}</Title>
              {(v.plate || v.mileage != null) && (
                <Text size="xs" c="dimmed">
                  {[v.plate ? `Plate ${v.plate}` : null, v.mileage != null ? `${v.mileage.toLocaleString()} mi` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              )}
            </Stack>
            {v.visits.length === 0 ? (
              <Text size="sm" c="dimmed">
                No visits yet.
              </Text>
            ) : (
              v.visits.map((visit) => <VisitCard key={visit.number} visit={visit} tz={tz} />)
            )}
          </Stack>
        ))}

        {otherVisits.length > 0 && (
          <Stack gap="xs">
            <Title order={4}>Other visits</Title>
            {otherVisits.map((visit) => (
              <VisitCard key={visit.number} visit={visit} tz={tz} />
            ))}
          </Stack>
        )}

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
        <Text size="xs" c="dimmed">
          This link is yours — anyone who has it can see this page. If your phone changes hands, text the shop
          and they'll send you a new one.
        </Text>
      </Stack>
    </Container>
  );
}
