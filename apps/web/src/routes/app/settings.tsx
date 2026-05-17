import { Stack, Title, Text, Switch, Group, Select, Button, Divider } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function SettingsRoute() {
  const { me } = useAuth();
  const qc = useQueryClient();

  const patchShop = useMutation({
    mutationFn: (patch: { settings?: { aiTone?: "plain" | "friendly"; autoReplyEnabled?: boolean } }) =>
      api.patch("/shop", patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      notifications.show({ color: "green", message: "Saved." });
    },
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  const openBillingPortal = useMutation({
    mutationFn: () => api.post<{ url: string }>("/billing/portal-session"),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  function exportData() {
    // Browser handles the download via the auth cookie. Hitting the endpoint
    // directly so we get streaming + the Content-Disposition filename.
    window.location.href = `${API_URL}/data/export`;
  }

  return (
    <Stack>
      <Title order={2}>Settings</Title>
      <Text c="dimmed">Shop: {me?.shop?.name}</Text>

      <Divider label="AI" />
      <Select
        label="AI tone for drafted customer messages"
        data={[
          { value: "plain", label: "Plain — direct, mechanic-to-customer" },
          { value: "friendly", label: "Friendly — warm, neighborly" },
        ]}
        value={me?.shop?.settings.aiTone ?? "plain"}
        onChange={(v) => v && patchShop.mutate({ settings: { aiTone: v as "plain" | "friendly" } })}
      />
      <Switch
        label="Auto-reply to status-check texts"
        checked={me?.shop?.settings.autoReplyEnabled ?? false}
        onChange={(e) =>
          patchShop.mutate({ settings: { autoReplyEnabled: e.currentTarget.checked } })
        }
        description="If a customer asks ‘is my car ready,’ Lift answers automatically with the current status."
      />

      <Divider label="Billing" />
      <Group>
        <Button
          variant="default"
          onClick={() => openBillingPortal.mutate()}
          loading={openBillingPortal.isPending}
        >
          Open Stripe billing portal
        </Button>
      </Group>

      <Divider label="Data" />
      <Group>
        <Button variant="default" onClick={exportData}>
          Export all data (CSV zip)
        </Button>
      </Group>
    </Stack>
  );
}
