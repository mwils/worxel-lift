import { useMemo, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import {
  Drawer,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
  Loader,
  Center,
  Button,
  Anchor,
} from "@mantine/core";
import { IconSearch, IconHistory } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import type { JobTemplate } from "./types";

export interface TemplatePickerProps {
  opened: boolean;
  onClose: () => void;
  onPick: (template: JobTemplate) => void | Promise<void>;
}

function matches(t: JobTemplate, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    t.name.toLowerCase().includes(needle) ||
    (t.category ?? "").toLowerCase().includes(needle)
  );
}

function TemplateRow({
  t,
  onPick,
  busy,
}: {
  t: JobTemplate;
  onPick: (t: JobTemplate) => void;
  busy: boolean;
}) {
  return (
    <UnstyledButton
      onClick={() => onPick(t)}
      disabled={busy}
      style={{
        display: "block",
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        opacity: busy ? 0.6 : 1,
      }}
      className="job-template-row"
    >
      <Group justify="space-between" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={600} truncate>
            {t.name}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {t.category ? `${t.category} · ` : ""}
            {t.itemCount} item{t.itemCount === 1 ? "" : "s"}
            {t.useCount > 0 ? ` · used ${t.useCount}×` : ""}
          </Text>
        </Stack>
        <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          ~{formatMoney(t.priceTotal)}
        </Text>
      </Group>
    </UnstyledButton>
  );
}

interface PickerBodyProps {
  onPick: (t: JobTemplate) => void;
  busy: boolean;
  onClose: () => void;
}

function PickerBody({ onPick, busy, onClose }: PickerBodyProps) {
  const [q, setQ] = useState("");

  const templatesQ = useQuery({
    queryKey: ["jobTemplates"],
    queryFn: () => api.get<{ templates: JobTemplate[] }>("/job-templates"),
  });

  const all = templatesQ.data?.templates ?? [];

  const { mostUsed, grouped } = useMemo(() => {
    const filtered = all.filter((t) => matches(t, q));
    const used = filtered.filter((t) => (t.useCount ?? 0) > 0);
    const mostUsed = [...used]
      .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0))
      .slice(0, 3);
    const mostUsedIds = new Set(mostUsed.map((t) => t.id));
    const rest = filtered.filter((t) => !mostUsedIds.has(t.id));
    const grouped = new Map<string, JobTemplate[]>();
    for (const t of rest) {
      const cat = t.category ?? "Uncategorized";
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(t);
    }
    return { mostUsed, grouped };
  }, [all, q]);

  return (
    <Stack gap="sm">
      <TextInput
        placeholder="Search templates"
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
        autoFocus
      />

      {templatesQ.isPending ? (
        <Center py="md">
          <Loader size="sm" />
        </Center>
      ) : all.length === 0 ? (
        <Stack gap="xs" align="center" py="md">
          <Text c="dimmed" size="sm">
            No saved jobs yet.
          </Text>
          <Anchor component={Link} to="/templates" onClick={onClose}>
            Create your first one →
          </Anchor>
        </Stack>
      ) : (
        <Stack gap="md">
          {mostUsed.length > 0 && (
            <Stack gap={4}>
              <Group gap={6}>
                <IconHistory size={14} />
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Most used
                </Text>
              </Group>
              {mostUsed.map((t) => (
                <TemplateRow key={t.id} t={t} onPick={onPick} busy={busy} />
              ))}
            </Stack>
          )}

          {Array.from(grouped.entries()).map(([cat, items]) => (
            <Stack key={cat} gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                {cat}
              </Text>
              {items.map((t) => (
                <TemplateRow key={t.id} t={t} onPick={onPick} busy={busy} />
              ))}
            </Stack>
          ))}
        </Stack>
      )}

      <Group justify="space-between" pt="xs">
        <Anchor component={Link} to="/templates" size="sm" onClick={onClose}>
          Manage templates
        </Anchor>
        <Button variant="subtle" onClick={onClose}>
          Close
        </Button>
      </Group>
    </Stack>
  );
}

export function TemplatePicker({ opened, onClose, onPick }: TemplatePickerProps) {
  const isMobile = useMediaQuery("(max-width: 48em)");
  const [busy, setBusy] = useState(false);

  async function handlePick(t: JobTemplate) {
    setBusy(true);
    try {
      await onPick(t);
    } finally {
      setBusy(false);
    }
  }

  if (isMobile) {
    return (
      <Drawer
        opened={opened}
        onClose={onClose}
        position="bottom"
        size="80%"
        title="Saved jobs"
        styles={{ body: { paddingBottom: 24 } }}
      >
        <PickerBody onPick={handlePick} busy={busy} onClose={onClose} />
      </Drawer>
    );
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Saved jobs" size="lg">
      <PickerBody onPick={handlePick} busy={busy} onClose={onClose} />
    </Modal>
  );
}

