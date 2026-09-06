import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Container,
  Stack,
  Title,
  Text,
  Card,
  Group,
  Button,
  Divider,
  Loader,
  Center,
  Anchor,
} from "@mantine/core";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatPhone } from "../../lib/format";
import { notifyError } from "../../lib/notify";

interface PublicLineItem {
  kind: string;
  description: string;
  hours?: number | null;
  rate?: number | null; // cents/hr
  qty?: number | null;
  unitPrice?: number | null; // cents
  total: number;
}

interface PublicEstimate {
  ro: {
    number: number;
    status: string;
    concern?: string | null;
    lineItems?: PublicLineItem[];
    laborTotal?: number;
    partsTotal?: number;
    taxTotal?: number;
    total: number;
    estimate?: {
      sentAt?: string | null;
      viewedAt?: string | null;
      approvedAt?: string | null;
      declinedAt?: string | null;
      approvedTotal?: number | null;
      approvedTaxTotal?: number | null;
      changedSinceApproval?: boolean;
      changedAt?: string | null;
    } | null;
  };
  customer: { firstName: string; lastName?: string | null } | null;
  vehicle: { year?: number | null; make?: string | null; model?: string | null } | null;
  shop: {
    name: string;
    phone?: string | null; // front-desk line
    smsPhone?: string | null; // the number their texts come from
    timezone?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      zip?: string | null;
    } | null;
  } | null;
}

// "Sep 3 at 3:55 PM" on the shop's clock — the approval time has to read the
// same on the customer's phone as it does on the RO page in the bay.
function formatWhen(iso: string | null | undefined, tz?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const opts = { month: "short", day: "numeric" } as const;
  const timeOpts = { hour: "numeric", minute: "2-digit" } as const;
  try {
    const zone = tz || undefined;
    const day = d.toLocaleString("en-US", { ...opts, timeZone: zone });
    const time = d.toLocaleString("en-US", { ...timeOpts, timeZone: zone });
    return `${day} at ${time}`;
  } catch {
    return `${d.toLocaleString("en-US", opts)} at ${d.toLocaleString("en-US", timeOpts)}`;
  }
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

export function PublicEstimateRoute() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();

  const { data, isPending, error } = useQuery({
    queryKey: ["public-estimate", token],
    queryFn: () => api.get<PublicEstimate>(`/public/estimate/${token}`),
    enabled: !!token,
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/public/estimate/${token}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-estimate", token] }),
    onError: (err) => notifyError(err, { title: "Couldn't approve — try again" }),
  });
  const decline = useMutation({
    mutationFn: () => api.post(`/public/estimate/${token}/decline`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-estimate", token] }),
    onError: (err) => notifyError(err, { title: "Couldn't send that — try again" }),
  });

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (error || !data?.ro) {
    const code =
      error instanceof ApiError
        ? (error.details as { error?: { code?: string } } | null)?.error?.code
        : undefined;
    if (code === "estimate_not_sent") {
      return (
        <Unavailable
          title="This estimate isn't ready yet"
          body="The shop hasn't sent it over. You'll get a text with this link once it's ready to review."
        />
      );
    }
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
  const est = ro.estimate ?? {};
  const lineItems = ro.lineItems ?? [];
  const approved = !!est.approvedAt;
  const declined = !approved && !!est.declinedAt;
  const changedSinceApproval = approved && !!est.changedSinceApproval;
  // Once approved, the API substitutes the approved snapshot for ro.lineItems
  // and the totals, so everything rendered below is what the customer agreed
  // to — the live numbers never reach this page after approval.
  const shopTz = data.shop?.timezone ?? null;
  const approvedWhen = approved ? formatWhen(est.approvedAt, shopTz) : null;
  const taxTotal = ro.taxTotal ?? 0;
  const laborTotal = ro.laborTotal ?? 0;
  const partsTotal = ro.partsTotal ?? 0;
  const showBreakdown = taxTotal > 0 || (laborTotal > 0 && partsTotal > 0);

  const shop = data.shop;
  const addr = shop?.address;
  const addressLine1 = [addr?.line1, addr?.line2].filter(Boolean).join(", ");
  const addressLine2 = [addr?.city, [addr?.state, addr?.zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  const vehicleSummary = data.vehicle
    ? [data.vehicle.year, data.vehicle.make, data.vehicle.model].filter(Boolean).join(" ")
    : "";

  return (
    <Container size={520} py="lg">
      <Stack>
        <Stack gap={0}>
          {shop?.name && (
            <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
              {shop.name}
            </Text>
          )}
          <Title order={2}>Estimate</Title>
          {approved && (
            <Text size="sm" c="green" fw={600}>
              Approved{approvedWhen ? ` ${approvedWhen}` : ""}
            </Text>
          )}
        </Stack>
        <Text c="dimmed">
          For {data.customer?.firstName ?? "you"}
          {vehicleSummary ? ` · ${vehicleSummary}` : ""}
        </Text>
        {ro.concern && (
          <Text size="sm" c="dimmed">
            Concern: {ro.concern}
          </Text>
        )}

        <Card>
          <Stack gap="xs">
            {lineItems.length === 0 && (
              <Text c="dimmed" size="sm">
                No line items yet.
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
                {partsTotal > 0 && (
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

        {approved && (
          <Text c="green">Approved — thanks! This is the estimate you agreed to.</Text>
        )}
        {changedSinceApproval && (
          <Text c="orange">
            The shop has since updated this estimate — they'll send a new one to approve.
          </Text>
        )}
        {declined && <Text c="red">Declined.</Text>}
        {!approved && !declined && (
          <Group grow>
            <Button
              color="green"
              onClick={() => approve.mutate()}
              loading={approve.isPending}
              disabled={lineItems.length === 0}
            >
              Approve
            </Button>
            <Button variant="default" onClick={() => decline.mutate()} loading={decline.isPending}>
              Decline
            </Button>
          </Group>
        )}
        {!approved && !declined && (
          <Text size="xs" c="dimmed">
            Prices reflect what the shop found today. If anything changes before the work starts,
            they'll send an updated estimate for you to approve.
          </Text>
        )}

        {shop && (shop.phone || shop.smsPhone || addressLine1 || addressLine2) && (
          <>
            <Divider />
            <Stack gap={4}>
              {shop.phone ? (
                <Text fw={600}>
                  Questions? Call {shop.name} at{" "}
                  <Anchor href={`tel:${shop.phone}`} fw={600}>
                    {formatPhone(shop.phone)}
                  </Anchor>
                </Text>
              ) : shop.smsPhone ? (
                <Text fw={600}>
                  Questions? Text {shop.name} at{" "}
                  <Anchor href={`sms:${shop.smsPhone}`} fw={600}>
                    {formatPhone(shop.smsPhone)}
                  </Anchor>
                </Text>
              ) : (
                <Text size="sm" fw={600}>
                  {shop.name}
                </Text>
              )}
              {addressLine1 && (
                <Text size="sm" c="dimmed">
                  {addressLine1}
                </Text>
              )}
              {addressLine2 && (
                <Text size="sm" c="dimmed">
                  {addressLine2}
                </Text>
              )}
            </Stack>
          </>
        )}
      </Stack>
    </Container>
  );
}
