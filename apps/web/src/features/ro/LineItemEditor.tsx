import { useEffect, useRef, useState } from "react";
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
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
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

export type EditErrors = Partial<
  Record<"description" | "hours" | "rateDollars" | "qty" | "unitPriceDollars", string>
>;

/**
 * Mirrors the server's LineItemDto rules so the owner sees the problem inline
 * instead of a 400 toast: quantities (hours, qty) must be > 0, prices >= 0.
 */
export function validateEdit(state: EditState): EditErrors {
  const errors: EditErrors = {};
  if (!state.description.trim()) errors.description = "Describe the work or part.";
  const priceError = (v: number | undefined, noun: string) =>
    v == null ? `Enter ${noun.toLowerCase()}.` : v < 0 ? `${noun} can't be negative.` : undefined;
  if (state.kind === "labor") {
    if (state.hours == null) errors.hours = "Enter hours.";
    else if (!(state.hours > 0)) errors.hours = "Hours must be more than 0.";
    errors.rateDollars = priceError(state.rateDollars, "Rate");
  } else if (state.kind === "part") {
    if (state.qty == null) errors.qty = "Enter a quantity.";
    else if (!(state.qty > 0)) errors.qty = "Qty must be more than 0.";
    errors.unitPriceDollars = priceError(state.unitPriceDollars, "Unit price");
  } else {
    errors.unitPriceDollars = priceError(state.unitPriceDollars, "Amount");
  }
  for (const k of Object.keys(errors) as Array<keyof EditErrors>) {
    if (errors[k] === undefined) delete errors[k];
  }
  return errors;
}

export interface RowEditorProps {
  state: EditState;
  setState: (s: EditState) => void;
  errors?: EditErrors;
}

export function RowEditor({ state, setState, errors }: RowEditorProps) {
  return (
    <Stack gap="xs">
      <Group grow align="flex-start">
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
          error={errors?.description}
        />
      </Group>
      {state.kind === "labor" ? (
        <Group grow align="flex-start">
          <NumberInput
            label="Hours"
            min={0}
            decimalScale={2}
            value={state.hours ?? ""}
            onChange={(v) => setState({ ...state, hours: typeof v === "number" ? v : undefined })}
            error={errors?.hours}
          />
          <NumberInput
            label="Rate ($/hr)"
            min={0}
            decimalScale={2}
            value={state.rateDollars ?? ""}
            onChange={(v) =>
              setState({ ...state, rateDollars: typeof v === "number" ? v : undefined })
            }
            error={errors?.rateDollars}
          />
        </Group>
      ) : state.kind === "part" ? (
        <Group grow align="flex-start">
          <NumberInput
            label="Qty"
            min={0}
            decimalScale={2}
            value={state.qty ?? ""}
            onChange={(v) => setState({ ...state, qty: typeof v === "number" ? v : undefined })}
            error={errors?.qty}
          />
          <NumberInput
            label="Unit price ($)"
            min={0}
            decimalScale={2}
            value={state.unitPriceDollars ?? ""}
            onChange={(v) =>
              setState({ ...state, unitPriceDollars: typeof v === "number" ? v : undefined })
            }
            error={errors?.unitPriceDollars}
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
          error={errors?.unitPriceDollars}
        />
      )}
    </Stack>
  );
}

const UNDO_MS = 5000;
const deleteToastId = (id: string) => `line-item-delete-${id}`;

export function LineItemEditor({ items, onCreate, onUpdate, onDelete, busy }: LineItemEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [state, setState] = useState<EditState>(blankEdit());
  // Errors only appear after the first save attempt, then track edits live.
  const [showErrors, setShowErrors] = useState(false);
  const errors = showErrors ? validateEdit(state) : {};
  // Phone thumbs: edit/delete sit side by side, so give them room and 44px targets.
  const compact = useMediaQuery("(max-width: 48em)");

  // ── Delete with undo ────────────────────────────────────────────────────
  // The row disappears immediately, but the DELETE only fires when the undo
  // toast closes (auto after UNDO_MS, dismissed, or this editor unmounts).
  // `pending` = ids whose delete hasn't been committed or undone yet.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const pending = useRef(new Set<string>());
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;

  const unhide = (id: string) =>
    setHiddenIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const commitDelete = (id: string) => {
    if (!pending.current.has(id)) return; // already committed or undone
    pending.current.delete(id);
    Promise.resolve(onDeleteRef.current(id)).catch(() => unhide(id));
  };

  const undoDelete = (id: string) => {
    pending.current.delete(id);
    unhide(id);
    notifications.hide(deleteToastId(id));
  };

  function requestDelete(row: LineItemRow) {
    if (editingId === row.id) cancel();
    pending.current.add(row.id);
    setHiddenIds((prev) => new Set(prev).add(row.id));
    notifications.show({
      id: deleteToastId(row.id),
      autoClose: UNDO_MS,
      color: "gray",
      onClose: () => commitDelete(row.id),
      message: (
        <Group justify="space-between" wrap="nowrap" gap="sm">
          <Text size="sm" lineClamp={1} style={{ minWidth: 0 }}>
            Removed “{row.description}”
          </Text>
          <Button size="compact-sm" variant="light" onClick={() => undoDelete(row.id)}>
            Undo
          </Button>
        </Group>
      ),
    });
  }

  // Leaving the page = accept every pending delete right now.
  useEffect(
    () => () => {
      for (const id of Array.from(pending.current)) {
        commitDelete(id);
        notifications.hide(deleteToastId(id));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Once the server copy drops a row, stop tracking it as hidden.
  useEffect(() => {
    setHiddenIds((prev) => {
      const live = new Set(items.map((r) => r.id));
      const next = new Set(Array.from(prev).filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const visibleItems = items.filter((r) => !hiddenIds.has(r.id));

  function startAdd() {
    setEditingId(null);
    setAdding(true);
    setState(blankEdit());
    setShowErrors(false);
  }
  function startEdit(row: LineItemRow) {
    setAdding(false);
    setEditingId(row.id);
    setState(rowToEdit(row));
    setShowErrors(false);
  }
  function cancel() {
    setAdding(false);
    setEditingId(null);
    setShowErrors(false);
  }

  async function save() {
    if (Object.keys(validateEdit(state)).length > 0) {
      setShowErrors(true);
      return;
    }
    const draft = editToDraft(state);
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
          {visibleItems.length === 0 && !adding && (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed" size="sm">
                  No line items yet.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
          {visibleItems.map((row) => (
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
                <Group gap={compact ? "md" : "xs"} justify="flex-end" wrap="nowrap">
                  <ActionIcon
                    variant="subtle"
                    size={compact ? "xl" : "md"}
                    onClick={() => startEdit(row)}
                    aria-label="Edit"
                  >
                    <IconPencil size={compact ? 18 : 16} />
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    size={compact ? "xl" : "md"}
                    color="red"
                    onClick={() => requestDelete(row)}
                    aria-label="Delete"
                    disabled={busy}
                  >
                    <IconTrash size={compact ? 18 : 16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {(adding || editingId) && (
        <Stack p="sm" style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 8 }}>
          <RowEditor state={state} setState={setState} errors={errors} />
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
