import { useMemo, useState } from "react";
import {
  ActionIcon,
  Alert,
  Autocomplete,
  Button,
  Card,
  Group,
  NumberInput,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import {
  RowEditor,
  blankEdit,
  editToDraft,
  rowToEdit,
  type EditState,
  type LineItemRow,
} from "../ro/LineItemEditor";
import { formatMoney } from "../../lib/format";
import { api } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { useAuth } from "../../lib/auth";
import type { JobTemplate, JobTemplateLineItem } from "./types";

export interface TemplateFormProps {
  template: JobTemplate | null;
  onSaved: (t: JobTemplate) => void;
  onCancel: () => void;
}

interface DraftItem {
  // Stable client-side id so we can edit/delete in-place before save.
  key: string;
  kind: LineItemRow["kind"];
  description: string;
  hours: number | null;
  rate: number | null;
  qty: number | null;
  unitPrice: number | null;
  total: number;
}

function itemFromEdit(state: EditState): Omit<DraftItem, "key"> {
  const draft = editToDraft(state);
  return {
    kind: draft.kind,
    description: draft.description,
    hours: draft.hours ?? null,
    rate: draft.rate ?? null,
    qty: draft.qty ?? null,
    unitPrice: draft.unitPrice ?? null,
    total: draft.total,
  };
}

function itemFromTemplate(li: JobTemplateLineItem, idx: number): DraftItem {
  return {
    key: li.id ?? `seed-${idx}`,
    kind: li.kind,
    description: li.description,
    hours: li.hours,
    rate: li.rate,
    qty: li.qty,
    unitPrice: li.unitPrice,
    total: li.total,
  };
}

function itemToRow(it: DraftItem): LineItemRow {
  return {
    id: it.key,
    kind: it.kind,
    description: it.description,
    hours: it.hours,
    rate: it.rate,
    qty: it.qty,
    unitPrice: it.unitPrice,
    total: it.total,
  };
}

export function TemplateForm({ template, onSaved, onCancel }: TemplateFormProps) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "");
  const [notes, setNotes] = useState(template?.notes ?? "");
  const [items, setItems] = useState<DraftItem[]>(
    (template?.lineItems ?? []).map(itemFromTemplate)
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editState, setEditState] = useState<EditState>(blankEdit());

  const defaultRate = me?.shop?.settings?.defaultLaborRate ?? null;
  const promptForRate = defaultRate == null;

  const [showRatePrompt, setShowRatePrompt] = useState(promptForRate);
  const [rateInputDollars, setRateInputDollars] = useState<number | undefined>(
    defaultRate != null ? defaultRate / 100 : undefined
  );

  const categoriesQ = useQuery({
    queryKey: ["jobTemplates", "categories"],
    queryFn: () => api.get<{ templates: JobTemplate[] }>("/job-templates"),
    // Reuse the list endpoint; categories are derived client-side.
  });
  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    for (const t of categoriesQ.data?.templates ?? []) {
      if (t.category) cats.add(t.category);
    }
    return Array.from(cats).sort();
  }, [categoriesQ.data]);

  const saveRate = useMutation({
    mutationFn: (rateCents: number) =>
      api.patch("/shop", { settings: { defaultLaborRate: rateCents } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      setShowRatePrompt(false);
      notifications.show({ color: "green", message: "Default labor rate saved." });
    },
    onError: (err) => notifyError(err, { title: "Couldn't save labor rate" }),
  });

  function startAdd() {
    setEditingKey(null);
    setAdding(true);
    setEditState(
      blankEdit(defaultRate != null ? defaultRate / 100 : rateInputDollars ?? undefined)
    );
  }
  function startEdit(it: DraftItem) {
    setAdding(false);
    setEditingKey(it.key);
    setEditState(rowToEdit(itemToRow(it)));
  }
  function cancelRow() {
    setAdding(false);
    setEditingKey(null);
  }
  function saveRow() {
    const next = itemFromEdit(editState);
    if (!next.description) return;
    if (adding) {
      setItems([...items, { key: crypto.randomUUID(), ...next }]);
    } else if (editingKey) {
      setItems(items.map((it) => (it.key === editingKey ? { ...it, ...next } : it)));
    }
    cancelRow();
  }
  function deleteRow(key: string) {
    setItems(items.filter((it) => it.key !== key));
  }

  const upsert = useMutation({
    mutationFn: async (payload: {
      name: string;
      category: string | null;
      notes: string | null;
      lineItems: Omit<DraftItem, "key" | "total">[];
    }) => {
      if (template) {
        return api.patch<{ template: JobTemplate }>(`/job-templates/${template.id}`, payload);
      }
      return api.post<{ template: JobTemplate }>("/job-templates", payload);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["jobTemplates"] });
      notifications.show({ color: "green", message: template ? "Saved job updated." : "Saved job created." });
      onSaved(res.template);
    },
    onError: (err) => notifyError(err, { title: "Couldn't save" }),
  });

  function submit() {
    if (!name.trim()) {
      notifications.show({ color: "red", message: "Name is required." });
      return;
    }
    if (items.length === 0) {
      notifications.show({ color: "red", message: "Add at least one line item." });
      return;
    }
    upsert.mutate({
      name: name.trim(),
      category: category.trim() || null,
      notes: notes.trim() || null,
      lineItems: items.map(({ key: _k, total: _t, ...rest }) => ({
        kind: rest.kind,
        description: rest.description,
        hours: rest.hours ?? undefined,
        rate: rest.rate ?? undefined,
        qty: rest.qty ?? undefined,
        unitPrice: rest.unitPrice ?? undefined,
      })) as any,
    });
  }

  const total = items.reduce((acc, it) => acc + it.total, 0);

  return (
    <Stack>
      {showRatePrompt && (
        <Alert color="blue" title="Set your default labor rate">
          <Stack gap="xs">
            <Text size="sm">
              We'll use this as the starting rate when you add labor rows to templates.
              You can change it any time in Settings.
            </Text>
            <Group align="end">
              <NumberInput
                label="Rate ($/hr)"
                min={0}
                decimalScale={2}
                value={rateInputDollars ?? ""}
                onChange={(v) =>
                  setRateInputDollars(typeof v === "number" ? v : undefined)
                }
                w={160}
              />
              <Button
                onClick={() => {
                  if (rateInputDollars && rateInputDollars > 0) {
                    saveRate.mutate(Math.round(rateInputDollars * 100));
                  }
                }}
                loading={saveRate.isPending}
                disabled={!rateInputDollars || rateInputDollars <= 0}
              >
                Save rate
              </Button>
              <Button variant="subtle" onClick={() => setShowRatePrompt(false)}>
                Skip
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      <TextInput
        label="Name"
        required
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        placeholder="e.g. Front brake pads"
      />
      <Autocomplete
        label="Category"
        data={categoryOptions}
        value={category}
        onChange={setCategory}
        placeholder="Brakes, Maintenance, HVAC…"
      />
      <Textarea
        label="Notes (optional, internal)"
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
        autosize
        minRows={2}
      />

      <Card withBorder>
        <Stack>
          <Group justify="space-between">
            <Text fw={600}>Line items</Text>
            <Text size="sm" c="dimmed">
              Total: {formatMoney(total)}
            </Text>
          </Group>

          <Table withRowBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kind</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Detail</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Total</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.length === 0 && !adding && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text c="dimmed" size="sm">
                      No line items yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
              {items.map((it) => (
                <Table.Tr key={it.key}>
                  <Table.Td>{it.kind}</Table.Td>
                  <Table.Td>{it.description}</Table.Td>
                  <Table.Td>
                    {it.kind === "labor"
                      ? `${it.hours ?? 0}h @ ${formatMoney(it.rate ?? 0)}/hr`
                      : it.kind === "part"
                        ? `${it.qty ?? 0} × ${formatMoney(it.unitPrice ?? 0)}`
                        : "—"}
                  </Table.Td>
                  <Table.Td style={{ textAlign: "right" }}>{formatMoney(it.total)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end">
                      <ActionIcon variant="subtle" onClick={() => startEdit(it)} aria-label="Edit">
                        <IconPencil size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => deleteRow(it.key)}
                        aria-label="Delete"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          {(adding || editingKey) && (
            <Stack
              p="sm"
              style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}
            >
              <RowEditor state={editState} setState={setEditState} />
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  leftSection={<IconX size={14} />}
                  onClick={cancelRow}
                  type="button"
                >
                  Cancel
                </Button>
                <Button leftSection={<IconCheck size={14} />} onClick={saveRow}>
                  {adding ? "Add line item" : "Save changes"}
                </Button>
              </Group>
            </Stack>
          )}

          {!adding && !editingKey && (
            <Group>
              <Button
                variant="default"
                leftSection={<IconPlus size={14} />}
                onClick={startAdd}
              >
                Add line item
              </Button>
            </Group>
          )}
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={submit} loading={upsert.isPending}>
          {template ? "Save template" : "Create template"}
        </Button>
      </Group>
    </Stack>
  );
}
