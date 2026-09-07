import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { IconAlertTriangle, IconSearch } from "@tabler/icons-react";
import { api } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import { formatPhone } from "../../lib/format";

interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  email: string | null;
}

export interface MergeCustomerModalProps {
  opened: boolean;
  onClose: () => void;
  /** Survivor — the customer whose page we're on. Keeps its id and page. */
  survivor: { id: string; firstName: string; lastName: string | null };
  /** Preselect the duplicate booking flagged (skips the search step). */
  suggested?: CustomerRow | null;
  onMerged?: () => void;
}

/**
 * Merge the duplicate INTO the customer being viewed. Two steps on purpose:
 * pick the other record, then confirm in words what happens. There is no undo.
 */
export function MergeCustomerModal({
  opened,
  onClose,
  survivor,
  suggested,
  onMerged,
}: MergeCustomerModalProps) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<CustomerRow | null>(suggested ?? null);

  const search = useQuery({
    queryKey: ["customers", q],
    queryFn: () => api.get<{ customers: CustomerRow[] }>(`/customers?q=${encodeURIComponent(q)}`),
    enabled: opened && !picked && q.trim().length >= 2,
  });

  const merge = useMutation({
    mutationFn: (loserId: string) =>
      api.post(`/customers/${loserId}/merge`, { intoCustomerId: survivor.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-history", survivor.id] });
      qc.invalidateQueries({ queryKey: ["customer", survivor.id] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["conversation", survivor.id] });
      notifySuccess("Merged. Everything is on one customer now.");
      reset();
      onMerged?.();
      onClose();
    },
    onError: (err) => notifyError(err, { title: "Couldn't merge those customers" }),
  });

  function reset() {
    setQ("");
    setPicked(suggested ?? null);
  }

  const survivorName = [survivor.firstName, survivor.lastName].filter(Boolean).join(" ");
  const pickedName = picked ? [picked.firstName, picked.lastName].filter(Boolean).join(" ") : "";
  const results = (search.data?.customers ?? []).filter((c) => c.id !== survivor.id);

  return (
    <Modal
      opened={opened}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Merge duplicate customer"
      centered
    >
      {!picked ? (
        <Stack>
          <Text size="sm" c="dimmed">
            Find the duplicate record. Everything on it moves onto {survivorName}.
          </Text>
          <TextInput
            leftSection={<IconSearch size={16} />}
            placeholder="Search by name, phone, email…"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            autoFocus
          />
          {q.trim().length < 2 ? null : search.isPending ? (
            <Text size="sm" c="dimmed">
              Looking…
            </Text>
          ) : results.length === 0 ? (
            <Text size="sm" c="dimmed">
              No other customer matches “{q.trim()}”.
            </Text>
          ) : (
            results.map((c) => (
              <Card
                key={c.id}
                withBorder
                padding="sm"
                onClick={() => setPicked(c)}
                style={{ cursor: "pointer", minHeight: 44 }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600}>{[c.firstName, c.lastName].filter(Boolean).join(" ")}</Text>
                  <Text size="sm" c="dimmed">
                    {formatPhone(c.phone)}
                  </Text>
                </Group>
              </Card>
            ))
          )}
        </Stack>
      ) : (
        <Stack>
          <Alert color="red" icon={<IconAlertTriangle size={18} />} title="This can't be undone">
            <Stack gap={6}>
              <Text size="sm">
                {pickedName} ({formatPhone(picked.phone)}) will be merged into {survivorName}.
              </Text>
              <Text size="sm">
                Their vehicles, repair orders, texts, payments and service reminders move over.
                Their name and number are kept on {survivorName} so old links and texts still
                find them. The duplicate record goes away.
              </Text>
            </Stack>
          </Alert>
          <Group justify="space-between">
            <Button variant="subtle" onClick={() => setPicked(null)} disabled={merge.isPending}>
              Pick someone else
            </Button>
            <Group>
              <Button
                variant="subtle"
                onClick={() => {
                  reset();
                  onClose();
                }}
                disabled={merge.isPending}
              >
                Cancel
              </Button>
              <Button color="red" loading={merge.isPending} onClick={() => merge.mutate(picked.id)}>
                Merge into {survivor.firstName}
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
