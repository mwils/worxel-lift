import { useMemo, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Button,
  Card,
  Checkbox,
  Group,
  Stack,
  Text,
  Loader,
} from "@mantine/core";
import { IconSparkles, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import type { JobTemplate, StarterTemplate } from "./types";

const DISMISS_KEY = "liftSeenStarterPrompt";

export function StarterLibraryPrompt() {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(
    typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1"
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const templatesQ = useQuery({
    queryKey: ["jobTemplates"],
    queryFn: () => api.get<{ templates: JobTemplate[] }>("/job-templates"),
    enabled: !dismissed,
  });

  const startersQ = useQuery({
    queryKey: ["jobTemplates", "starter-library"],
    queryFn: () =>
      api.get<{ starters: StarterTemplate[] }>("/job-templates/starter-library"),
    enabled: !dismissed,
  });

  const importStarter = useMutation({
    mutationFn: (starterKeys: string[]) =>
      api.post("/job-templates/import-starter", { starterKeys }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobTemplates"] });
      notifications.show({ color: "green", message: "Starter jobs added." });
      dismiss();
    },
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  const visible = useMemo(() => {
    if (dismissed) return false;
    if (templatesQ.isPending || startersQ.isPending) return false;
    return (templatesQ.data?.templates.length ?? 0) === 0;
  }, [dismissed, templatesQ, startersQ]);

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  function selectAll() {
    const next = new Set<string>();
    for (const s of startersQ.data?.starters ?? []) {
      if (!s.imported) next.add(s.starterKey);
    }
    setSelected(next);
  }

  if (!visible) return null;

  return (
    <Card withBorder shadow="xs">
      <Group justify="space-between" mb="xs">
        <Group gap={6}>
          <IconSparkles size={18} />
          <Text fw={600}>Add a starter library?</Text>
        </Group>
        <ActionIcon variant="subtle" onClick={dismiss} aria-label="Dismiss">
          <IconX size={16} />
        </ActionIcon>
      </Group>
      <Text size="sm" c="dimmed" mb="sm">
        Twelve common jobs with placeholder pricing. Pick the ones you do and we'll add them.
        Edit hours and prices any time.
      </Text>

      {startersQ.isPending ? (
        <Loader size="sm" />
      ) : (
        <Stack gap="xs">
          {(startersQ.data?.starters ?? []).map((s) => (
            <Group key={s.starterKey} justify="space-between" wrap="nowrap">
              <Checkbox
                checked={selected.has(s.starterKey)}
                disabled={s.imported}
                onChange={() => toggle(s.starterKey)}
                label={
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {s.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {s.category} · {s.itemCount} items · ~{formatMoney(s.priceTotal)}
                      {s.imported ? " · already added" : ""}
                    </Text>
                  </Stack>
                }
              />
            </Group>
          ))}
        </Stack>
      )}

      <Group justify="space-between" mt="md">
        <Anchor size="sm" onClick={selectAll}>
          Select all
        </Anchor>
        <Group>
          <Button variant="subtle" onClick={dismiss}>
            No thanks
          </Button>
          <Button
            onClick={() => importStarter.mutate(Array.from(selected))}
            loading={importStarter.isPending}
            disabled={selected.size === 0}
          >
            Add selected ({selected.size})
          </Button>
          <Anchor component={Link} to="/templates" size="sm">
            Or start blank →
          </Anchor>
        </Group>
      </Group>
    </Card>
  );
}
