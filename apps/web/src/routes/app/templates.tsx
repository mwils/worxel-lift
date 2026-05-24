import { useState } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconArchive, IconPencil, IconPlus, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import { TemplateForm } from "../../features/jobTemplates/TemplateForm";
import type { JobTemplate } from "../../features/jobTemplates/types";

export function TemplatesRoute() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<JobTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const templatesQ = useQuery({
    queryKey: ["jobTemplates"],
    queryFn: () => api.get<{ templates: JobTemplate[] }>("/job-templates"),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.del(`/job-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobTemplates"] });
      notifications.show({ color: "green", message: "Template archived." });
    },
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  const filtered = (templatesQ.data?.templates ?? []).filter((t) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      t.name.toLowerCase().includes(needle) ||
      (t.category ?? "").toLowerCase().includes(needle)
    );
  });

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Stack gap={0}>
          <Title order={2}>Saved jobs</Title>
          <Text c="dimmed" size="sm">
            The work you do every week, saved for two-tap apply on an RO.
          </Text>
        </Stack>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
          New template
        </Button>
      </Group>

      <TextInput
        placeholder="Search templates"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
      />

      {templatesQ.isPending ? (
        <Loader />
      ) : filtered.length === 0 ? (
        <Text c="dimmed">
          {q ? "No matching templates." : "No saved jobs yet. Click ‘New template’ to start."}
        </Text>
      ) : (
        <Stack gap="xs">
          {filtered.map((t) => (
            <Card withBorder key={t.id}>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Group gap="xs">
                    <Text fw={600}>{t.name}</Text>
                    {t.source === "starter" && (
                      <Badge size="xs" variant="light">
                        starter
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {t.category ? `${t.category} · ` : ""}
                    {t.itemCount} item{t.itemCount === 1 ? "" : "s"} · ~{formatMoney(t.priceTotal)}
                    {t.useCount > 0 ? ` · used ${t.useCount}×` : ""}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <ActionIcon
                    variant="subtle"
                    onClick={() => setEditing(t)}
                    aria-label="Edit"
                  >
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => {
                      if (window.confirm(`Archive "${t.name}"?`)) archive.mutate(t.id);
                    }}
                    aria-label="Archive"
                  >
                    <IconArchive size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal
        opened={creating}
        onClose={() => setCreating(false)}
        title="New template"
        size="lg"
      >
        <TemplateForm
          template={null}
          onSaved={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <Modal
        opened={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit “${editing.name}”` : "Edit template"}
        size="lg"
      >
        {editing && (
          <TemplateForm
            template={editing}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </Stack>
  );
}
