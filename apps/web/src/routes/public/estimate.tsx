import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Container, Stack, Title, Text, Card, Group, Button, Divider, Loader, Center } from "@mantine/core";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";

interface PublicEstimate {
  ro: {
    number: number;
    status: string;
    concern?: string;
    lineItems: Array<{ description: string; total: number; kind: string }>;
    total: number;
    estimate: { sentAt?: string; approvedAt?: string; declinedAt?: string };
  };
  customer: { firstName: string; lastName?: string } | null;
  vehicle: { year?: number; make?: string; model?: string } | null;
  shop: { name: string } | null;
}

export function PublicEstimateRoute() {
  const { token } = useParams<{ token: string }>();
  const qc = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ["public-estimate", token],
    queryFn: () => api.get<PublicEstimate>(`/public/estimate/${token}`),
    enabled: !!token,
  });

  const approve = useMutation({
    mutationFn: () => api.post(`/public/estimate/${token}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-estimate", token] }),
  });
  const decline = useMutation({
    mutationFn: () => api.post(`/public/estimate/${token}/decline`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["public-estimate", token] }),
  });

  if (isPending) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }
  if (!data) return <Container py="xl"><Text>Estimate not found.</Text></Container>;

  const approved = !!data.ro.estimate.approvedAt;
  const declined = !!data.ro.estimate.declinedAt;

  return (
    <Container size={520} py="lg">
      <Stack>
        <Stack gap={0}>
          {data.shop?.name && (
            <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
              {data.shop.name}
            </Text>
          )}
          <Title order={2}>Estimate</Title>
        </Stack>
        <Text c="dimmed">
          For {data.customer?.firstName} · {data.vehicle?.year} {data.vehicle?.make} {data.vehicle?.model}
        </Text>

        <Card>
          <Stack gap="xs">
            {data.ro.lineItems.map((li, i) => (
              <Group key={i} justify="space-between">
                <Text>{li.description}</Text>
                <Text>{formatMoney(li.total)}</Text>
              </Group>
            ))}
            <Divider />
            <Group justify="space-between">
              <Text fw={600}>Total</Text>
              <Text fw={600}>{formatMoney(data.ro.total)}</Text>
            </Group>
          </Stack>
        </Card>

        {approved && <Text c="green">Approved — thanks!</Text>}
        {declined && <Text c="red">Declined.</Text>}
        {!approved && !declined && (
          <Group grow>
            <Button color="green" onClick={() => approve.mutate()} loading={approve.isPending}>
              Approve
            </Button>
            <Button variant="default" onClick={() => decline.mutate()} loading={decline.isPending}>
              Decline
            </Button>
          </Group>
        )}
      </Stack>
    </Container>
  );
}
