import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatTaxRate, taxLineLabel } from "@lift/shared/constants";
import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Group,
  Image,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { api } from "../../lib/api";
import { formatMoney, formatPhone } from "../../lib/format";

type Severity = "green" | "yellow" | "red";

interface InspectionPhoto {
  url: string;
  takenAt: string | null;
  caption: string | null;
}

interface InspectionItem {
  id: string;
  title: string;
  severity: Severity;
  note: string | null;
  order: number;
  photos: InspectionPhoto[];
}

interface PublicInspection {
  shop: { name: string; phone: string | null } | null;
  vehicle: { year: number | null; make: string | null; model: string | null } | null;
  customer: { firstName: string } | null;
  items: InspectionItem[];
  estimate: {
    lineItems: Array<{ description: string; kind: string; total: number }>;
    taxTotal?: number;
    taxRateBps?: number;
    taxAppliesTo?: string;
    total: number;
    status: "draft" | "sent" | "approved" | "declined";
    publicToken: string | null;
  };
  sentAt: string | null;
  viewedAt: string | null;
}

const SEVERITY_COLOR: Record<Severity, string> = {
  green: "green",
  yellow: "yellow",
  red: "red",
};
const SEVERITY_LABEL: Record<Severity, string> = {
  green: "Good",
  yellow: "Watch",
  red: "Needs work",
};

export function PublicInspectionRoute() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [lightbox, setLightbox] = useState<InspectionPhoto | null>(null);

  const inspectionQ = useQuery({
    queryKey: ["public-inspection", token],
    queryFn: () => api.get<PublicInspection>(`/public/inspection/${token}`),
    enabled: !!token,
  });

  const estimateToken = inspectionQ.data?.estimate.publicToken ?? null;

  const approve = useMutation({
    mutationFn: () => api.post(`/public/estimate/${estimateToken}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-inspection", token] }),
  });
  const decline = useMutation({
    mutationFn: () => api.post(`/public/estimate/${estimateToken}/decline`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-inspection", token] }),
  });

  const counts = useMemo(() => {
    const acc: Record<Severity, number> = { red: 0, yellow: 0, green: 0 };
    for (const it of inspectionQ.data?.items ?? []) acc[it.severity]++;
    return acc;
  }, [inspectionQ.data?.items]);

  if (inspectionQ.isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (!inspectionQ.data) {
    return (
      <Container py="xl">
        <Text>Inspection not found.</Text>
      </Container>
    );
  }

  const data = inspectionQ.data;
  const veh = [data.vehicle?.year, data.vehicle?.make, data.vehicle?.model]
    .filter(Boolean)
    .join(" ");
  const hasEstimate = data.estimate.lineItems.length > 0 && data.estimate.total > 0;
  const approved = data.estimate.status === "approved";
  const declined = data.estimate.status === "declined";

  return (
    <Container size={520} py="lg">
      <Stack gap="lg">
        <Stack gap={2}>
          <Title order={3}>{data.shop?.name ?? "Your shop"}</Title>
          <Text c="dimmed" size="sm">
            Inspection for {data.customer?.firstName ?? "you"}
            {veh ? ` · ${veh}` : ""}
          </Text>
          {data.sentAt && (
            <Text c="dimmed" size="xs">
              Sent {new Date(data.sentAt).toLocaleString()}
              {hasEstimate ? ` · Total ${formatMoney(data.estimate.total)}` : ""}
            </Text>
          )}
        </Stack>

        <Group gap="xs">
          {(["red", "yellow", "green"] as Severity[]).map((sev) => (
            <Badge key={sev} variant="light" color={SEVERITY_COLOR[sev]} size="lg">
              {counts[sev]} {sev}
            </Badge>
          ))}
        </Group>

        <Stack gap="md">
          {data.items.map((item) => (
            <Card key={item.id} withBorder>
              <Stack gap="sm">
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <Box
                    w={12}
                    h={12}
                    mt={6}
                    style={{
                      borderRadius: 999,
                      flex: "0 0 auto",
                      background: `var(--mantine-color-${SEVERITY_COLOR[item.severity]}-6)`,
                    }}
                  />
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Text fw={600}>{item.title}</Text>
                    <Text size="xs" c="dimmed">
                      {SEVERITY_LABEL[item.severity]}
                    </Text>
                  </Stack>
                </Group>
                {item.note && <Text size="sm">{item.note}</Text>}
                {item.photos.length > 0 && (
                  <ScrollArea type="auto" scrollbarSize={6} offsetScrollbars>
                    <Group gap="xs" wrap="nowrap" style={{ scrollSnapType: "x mandatory" }}>
                      {item.photos.map((p, i) => (
                        <Box
                          key={i}
                          onClick={() => setLightbox(p)}
                          style={{
                            flex: "0 0 auto",
                            scrollSnapAlign: "start",
                            cursor: "pointer",
                          }}
                        >
                          <Image
                            src={p.url}
                            alt={p.caption ?? "Inspection photo"}
                            radius="sm"
                            fit="cover"
                            h={160}
                            w={220}
                          />
                        </Box>
                      ))}
                    </Group>
                  </ScrollArea>
                )}
              </Stack>
            </Card>
          ))}
        </Stack>

        {hasEstimate && (
          <Card withBorder>
            <Stack gap="xs">
              <Title order={5}>Estimate</Title>
              {data.estimate.lineItems.map((li, i) => (
                <Group key={i} justify="space-between">
                  <Text size="sm">{li.description}</Text>
                  <Text size="sm">{formatMoney(li.total)}</Text>
                </Group>
              ))}
              <Divider />
              {((data.estimate.taxTotal ?? 0) > 0 ||
                ((data.estimate.taxRateBps ?? 0) > 0 && data.estimate.taxAppliesTo !== "none")) && (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {taxLineLabel(data.estimate.taxAppliesTo)}
                    {(data.estimate.taxRateBps ?? 0) > 0
                      ? ` · ${formatTaxRate(data.estimate.taxRateBps ?? 0)}`
                      : ""}
                  </Text>
                  <Text size="sm">{formatMoney(data.estimate.taxTotal ?? 0)}</Text>
                </Group>
              )}
              <Group justify="space-between">
                <Text fw={600}>Total</Text>
                <Text fw={600}>{formatMoney(data.estimate.total)}</Text>
              </Group>
              {approved && <Text c="green">Approved — thanks!</Text>}
              {declined && <Text c="red">Declined.</Text>}
              {!approved && !declined && estimateToken && (
                <Group grow mt="xs">
                  <Button
                    color="green"
                    onClick={() => approve.mutate()}
                    loading={approve.isPending}
                  >
                    Approve estimate
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => decline.mutate()}
                    loading={decline.isPending}
                  >
                    Decline
                  </Button>
                </Group>
              )}
            </Stack>
          </Card>
        )}

        <Box>
          <Text size="sm" c="dimmed">
            Questions? Reply to the text we sent you.
          </Text>
          <Text size="xs" c="dimmed">
            {data.shop?.name}
            {data.shop?.phone ? ` · ${formatPhone(data.shop.phone)}` : ""}
          </Text>
        </Box>
      </Stack>

      <Modal
        opened={!!lightbox}
        onClose={() => setLightbox(null)}
        fullScreen
        withCloseButton
        padding={0}
        title={lightbox?.caption ?? undefined}
      >
        {lightbox && (
          <Center h="100%" w="100%" style={{ background: "#000" }}>
            <Image
              src={lightbox.url}
              alt={lightbox.caption ?? "Inspection photo"}
              fit="contain"
              h="100vh"
              w="100vw"
            />
          </Center>
        )}
      </Modal>
    </Container>
  );
}
