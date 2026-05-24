import { useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from "@mantine/core";
import { IconCheck, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import { LINE_ITEM_KINDS, type LineItemKind } from "@lift/shared/constants";
import { formatMoney } from "../../lib/format";

export interface LineItemRow {
  id: string;
  kind: LineItemKind;
  description: string;
  hours: number | null;
  rate: number | null; // cents/hr
  qty: number | null;
  unitPrice: number | null; // cents
  total: number; // cents
}

export interface LineItemDraft {
  kind: LineItemKind;
  description: string;
  hours?: number;
  rate?: number;
  qty?: number;
  unitPrice?: number;
  total: number;
}

export interface LineItemEditorProps {
  items: LineItemRow[];
  onCreate: (draft: LineItemDraft) => Promise<void> | void;
  onUpdate: (id: string, draft: LineItemDraft) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  busy?: boolean;
}

const KIND_OPTIONS = LINE_ITEM_KINDS.map((k) => ({
  value: k,
  label: k.charAt(0).toUpperCase() + k.slice(1),
}));

function computeTotal(draft: {
  kind: LineItemKind;
  hours?: number;
  rate?: number;
  qty?: number;
  unitPrice?: number;
}): number {
  if (draft.kind === "labor") {
    return Math.round((draft.hours ?? 0) * (draft.rate ?? 0));
  }
  if (draft.kind === "part") {
    return Math.round((draft.qty ?? 0) * (draft.unitPrice ?? 0));
  }
  // fee: total = unitPrice (a flat line)
  return Math.round(draft.unitPrice ?? 0);
}

export interface EditState {
  kind: LineItemKind;
  description: string;
  hours: number | undefined;
  rateDollars: number | undefined;
  qty: number | undefined;
  unitPriceDollars: number | undefined;
}

export function blankEdit(defaultRateDollars?: number): EditState {
  return {
    kind: "labor",
    description: "",
    hours: undefined,
    rateDollars: defaultRateDollars,
    qty: undefined,
    unitPriceDollars: undefined,
  };
}

export function rowToEdit(row: LineItemRow): EditState {
  return {
    kind: row.kind,
    description: row.description,
    hours: row.hours ?? undefined,
    rateDollars: row.rate != null ? row.rate / 100 : undefined,
    qty: row.qty ?? undefined,
    unitPriceDollars: row.unitPrice != null ? row.unitPrice / 100 : undefined,
  };
}

export function editToDraft(state: EditState): LineItemDraft {
  const draft = {
    kind: state.kind,
    description: state.description.trim(),
    hours: state.kind === "labor" ? state.hours : undefined,
    rate: state.kind === "labor" && state.rateDollars != null
      ? Math.round(state.rateDollars * 100)
      : undefined,
    qty: state.kind === "part" ? state.qty : undefined,
    unitPrice: state.kind !== "labor" && state.unitPriceDollars != null
      ? Math.round(state.unitPriceDollars * 100)
      : undefined,
    total: 0,
  };
  draft.total = computeTotal(draft);
  return draft;
}

export interface RowEditorProps {
  state: EditState;
  setState: (s: EditState) => void;
}

export function RowEditor({ state, setState }: RowEditorProps) {
  return (
    <Stack gap="xs">
      <Group grow>
        <Select
          label="Kind"
          data={KIND_OPTIONS}
          value={state.kind}
          onChange={(v) => setState({ ...state, kind: (v as LineItemKind) ?? "labor" })}
          allowDeselect={false}
        />
        <TextInput
          label="Description"
          value={state.description}
          onChange={(e) => setState({ ...state, description: e.currentTarget.value })}
        />
      </Group>
      {state.kind === "labor" ? (
        <Group grow>
          <NumberInput
            label="Hours"
            min={0}
            decimalScale={2}
            value={state.hours ?? ""}
            onChange={(v) => setState({ ...state, hours: typeof v === "number" ? v : undefined })}
          />
          <NumberInput
            label="Rate ($/hr)"
            min={0}
            decimalScale={2}
            value={state.rateDollars ?? ""}
            onChange={(v) =>
              setState({ ...state, rateDollars: typeof v === "number" ? v : undefined })
            }
          />
        </Group>
      ) : state.kind === "part" ? (
        <Group grow>
          <NumberInput
            label="Qty"
            min={0}
            decimalScale={2}
            value={state.qty ?? ""}
            onChange={(v) => setState({ ...state, qty: typeof v === "number" ? v : undefined })}
          />
          <NumberInput
            label="Unit price ($)"
            min={0}
            decimalScale={2}
            value={state.unitPriceDollars ?? ""}
            onChange={(v) =>
              setState({ ...state, unitPriceDollars: typeof v === "number" ? v : undefined })
            }
          />
        </Group>
      ) : (
        <NumberInput
          label="Amount ($)"
          min={0}
          decimalScale={2}
          value={state.unitPriceDollars ?? ""}
          onChange={(v) =>
            setState({ ...state, unitPriceDollars: typeof v === "number" ? v : undefined })
          }
        />
      )}
    </Stack>
  );
}

export function LineItemEditor({ items, onCreate, onUpdate, onDelete, busy }: LineItemEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [state, setState] = useState<EditState>(blankEdit());

  function startAdd() {
    setEditingId(null);
    setAdding(true);
    setState(blankEdit());
  }
  function startEdit(row: LineItemRow) {
    setAdding(false);
    setEditingId(row.id);
    setState(rowToEdit(row));
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
  }

  async function save() {
    const draft = editToDraft(state);
    if (!draft.description) return;
    if (adding) {
      await onCreate(draft);
    } else if (editingId) {
      await onUpdate(editingId, draft);
    }
    cancel();
  }

  return (
    <Stack>
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
          {items.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>{row.kind}</Table.Td>
              <Table.Td>{row.description}</Table.Td>
              <Table.Td>
                {row.kind === "labor"
                  ? `${row.hours ?? 0}h @ ${formatMoney(row.rate ?? 0)}/hr`
                  : row.kind === "part"
                    ? `${row.qty ?? 0} × ${formatMoney(row.unitPrice ?? 0)}`
                    : "—"}
              </Table.Td>
              <Table.Td style={{ textAlign: "right" }}>{formatMoney(row.total)}</Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  <ActionIcon variant="subtle" onClick={() => startEdit(row)} aria-label="Edit">
                    <IconPencil size={16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    onClick={() => onDelete(row.id)}
                    aria-label="Delete"
                    disabled={busy}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {(adding || editingId) && (
        <Stack p="sm" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <RowEditor state={state} setState={setState} />
          <Group justify="flex-end">
            <Button
              variant="subtle"
              leftSection={<IconX size={14} />}
              onClick={cancel}
              type="button"
            >
              Cancel
            </Button>
            <Button leftSection={<IconCheck size={14} />} onClick={save} loading={busy}>
              {adding ? "Add line item" : "Save changes"}
            </Button>
          </Group>
        </Stack>
      )}

      {!adding && !editingId && (
        <Group>
          <Button variant="default" onClick={startAdd}>
            + Add line item
          </Button>
        </Group>
      )}
    </Stack>
  );
}
