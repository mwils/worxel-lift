import { useState } from "react";
import { Button, Card, Group, Stack, Text, Textarea } from "@mantine/core";
import { IconPencil, IconPlus } from "@tabler/icons-react";

export interface NoteCardProps {
  label: string;
  value: string | null | undefined;
  /** Button text when there's nothing saved yet, e.g. "Add concern". */
  addLabel: string;
  placeholder?: string;
  saving?: boolean;
  /** Resolve to keep the card in view mode; reject to stay in the editor. */
  onSave: (value: string) => Promise<unknown> | unknown;
}

/**
 * A free-text RO field (concern, diagnosis) that is always on the page.
 * Empty → an "Add …" affordance; filled → text with an Edit button. Voice and
 * quick-create flows can leave these blank, so they must be fillable later.
 */
export function NoteCard({ label, value, addLabel, placeholder, saving, onSave }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const start = () => {
    setDraft(value ?? "");
    setEditing(true);
  };

  const save = async () => {
    try {
      await onSave(draft.trim());
    } catch {
      return; // caller already toasted the error; keep the editor open
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Card withBorder>
        <Stack gap="xs">
          <Textarea
            label={label}
            placeholder={placeholder}
            autosize
            minRows={2}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          {value ? (
            <Text style={{ whiteSpace: "pre-wrap" }}>{value}</Text>
          ) : (
            <Text size="sm" c="dimmed" fs="italic">
              Nothing yet.
            </Text>
          )}
        </Stack>
        <Button
          variant="subtle"
          size="compact-sm"
          leftSection={value ? <IconPencil size={14} /> : <IconPlus size={14} />}
          onClick={start}
        >
          {value ? "Edit" : addLabel}
        </Button>
      </Group>
    </Card>
  );
}
