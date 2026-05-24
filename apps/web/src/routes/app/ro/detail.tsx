import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CopyButton,
  Divider,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCopy,
  IconCreditCard,
  IconSend,
  IconSparkles,
  IconClipboardList,
  IconChecklist,
} from "@tabler/icons-react";
import { RO_STATUSES, type RoStatus } from "@lift/shared/constants";
import { api, ApiError } from "../../../lib/api";
import { formatMoney, formatPhone, formatRoNumber } from "../../../lib/format";
import {
  LineItemEditor,
  type LineItemDraft,
  type LineItemRow,
} from "../../../features/ro/LineItemEditor";
import { PhotoCapture, type CapturedPhoto } from "../../../features/ro/PhotoCapture";
import { PhotoGallery, type GalleryPhoto } from "../../../features/ro/PhotoGallery";
import { VoiceCapture, type VoiceDraft } from "../../../features/ro/VoiceCapture";
import { TemplatePicker } from "../../../features/jobTemplates/TemplatePicker";
import type { JobTemplate } from "../../../features/jobTemplates/types";
import { InspectionEditor } from "../../../features/inspection/InspectionEditor";
import { SendInspectionModal } from "../../../features/inspection/SendInspectionModal";
import type { InspectionState } from "../../../features/inspection/types";

interface RoDetail {
  repairOrder: {
    id: string;
    number: number;
    status: RoStatus;
    concern: string | null;
    diagnosis: string | null;
    lineItems: LineItemRow[];
    laborTotal: number;
    partsTotal: number;
    taxTotal: number;
    total: number;
    photos: GalleryPhoto[];
    publicToken: string | null;
    estimate: { sentAt?: string; approvedAt?: string; declinedAt?: string } | null;
    inspection: InspectionState;
    customer: {
      id: string;
      firstName: string;
      lastName: string | null;
      phone: string;
      email: string | null;
    } | null;
    vehicle: {
      id: string;
      year: number | null;
      make: string | null;
      model: string | null;
      trim: string | null;
      vin: string | null;
      plate: string | null;
    } | null;
  };
}

interface LineItemMutationResp {
  totals: { laborTotal: number; partsTotal: number; taxTotal: number; total: number };
}

const STATUS_OPTIONS = RO_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, " ") }));

export function RoDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const roQ = useQuery({
    queryKey: ["ro", id],
    queryFn: () => api.get<RoDetail>(`/repair-orders/${id}`),
    enabled: !!id,
  });
  const { data, isPending } = roQ;

  const patchRo = useMutation({
    mutationFn: (patch: Partial<{ status: RoStatus }>) =>
      api.patch(`/repair-orders/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ro", id] });
      qc.invalidateQueries({ queryKey: ["ros"] });
    },
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  const createLine = useMutation({
    mutationFn: (draft: LineItemDraft) =>
      api.post<LineItemMutationResp>(`/repair-orders/${id}/line-items`, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ro", id] }),
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  const patchLine = useMutation({
    mutationFn: ({ lineId, draft }: { lineId: string; draft: LineItemDraft }) =>
      api.patch<LineItemMutationResp>(`/repair-orders/${id}/line-items/${lineId}`, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ro", id] }),
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  const deleteLine = useMutation({
    mutationFn: (lineId: string) => api.del(`/repair-orders/${id}/line-items/${lineId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ro", id] }),
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  // ── Saved-job template apply ────────────────────────────────────────────
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const applyTemplate = useMutation({
    mutationFn: (templateId: string) =>
      api.post(`/job-templates/${templateId}/apply`, { repairOrderId: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ro", id] });
      qc.invalidateQueries({ queryKey: ["jobTemplates"] });
    },
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  async function pickTemplate(t: JobTemplate) {
    await applyTemplate.mutateAsync(t.id);
    setTemplatePickerOpen(false);
    notifications.show({ color: "green", message: `Added ${t.name}.` });
  }

  // ── Send estimate ────────────────────────────────────────────────────────
  // Default: fetch the deterministic template (no AI cost) and let the owner
  // review/edit. They can opt into a Bedrock-polished version via the
  // "✨ Polish with AI" button inside the modal.
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [estimateDraft, setEstimateDraft] = useState("");
  const [estimateTemplate, setEstimateTemplate] = useState("");
  const [aiPolished, setAiPolished] = useState(false);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [polishLoading, setPolishLoading] = useState(false);

  async function openSendEstimate() {
    if (!data?.repairOrder.customer) return;
    setEstimateLoading(true);
    try {
      const res = await api.post<{ draft: string; source: "template" | "ai" }>(
        "/messages/draft",
        {
          customerId: data.repairOrder.customer.id,
          repairOrderId: id,
          kind: "estimate",
          useAi: false,
        }
      );
      setEstimateTemplate(res.draft);
      setEstimateDraft(res.draft);
      setAiPolished(false);
      setEstimateOpen(true);
    } catch (err) {
      notifications.show({ color: "red", message: (err as Error).message });
    } finally {
      setEstimateLoading(false);
    }
  }

  async function togglePolish() {
    if (!data?.repairOrder.customer) return;
    if (aiPolished) {
      // Revert to deterministic template.
      setEstimateDraft(estimateTemplate);
      setAiPolished(false);
      return;
    }
    setPolishLoading(true);
    try {
      const res = await api.post<{ draft: string; source: "ai" }>("/messages/draft", {
        customerId: data.repairOrder.customer.id,
        repairOrderId: id,
        kind: "estimate",
        useAi: true,
      });
      setEstimateDraft(res.draft);
      setAiPolished(true);
    } catch (err) {
      notifications.show({ color: "red", message: (err as Error).message });
    } finally {
      setPolishLoading(false);
    }
  }

  const sendEstimate = useMutation({
    mutationFn: () =>
      api.post(`/repair-orders/${id}/send-estimate`, {
        draftOverride: estimateDraft,
        useAi: aiPolished,
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: "Estimate sent." });
      setEstimateOpen(false);
      qc.invalidateQueries({ queryKey: ["ro", id] });
    },
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  // ── Send inspection ──────────────────────────────────────────────────────
  const [sendInspectionOpen, setSendInspectionOpen] = useState(false);

  // ── Pay link ─────────────────────────────────────────────────────────────
  const [payOpen, setPayOpen] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);

  const createPayLink = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>("/payments/create-link", { repairOrderId: id }),
    onSuccess: (res) => {
      setPayUrl(res.url);
      setPayOpen(true);
    },
    onError: (err) => notifications.show({ color: "red", message: (err as Error).message }),
  });

  // ── Voice-to-RO accept-all → posts each line item via existing endpoint ──
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);

  async function acceptVoiceDraft(draft: VoiceDraft) {
    try {
      for (const li of draft.lineItems) {
        const total = li.total ?? 0;
        await api.post(`/repair-orders/${id}/line-items`, {
          kind: li.kind,
          description: li.description,
          hours: li.hours,
          rate: li.rate,
          qty: li.qty,
          unitPrice: li.unitPrice,
          total,
        });
      }
      if (draft.concern || draft.diagnosis) {
        await api.patch(`/repair-orders/${id}`, {
          concern: draft.concern || undefined,
          diagnosis: draft.diagnosis || undefined,
        });
      }
      setVoiceDraft(null);
      qc.invalidateQueries({ queryKey: ["ro", id] });
      notifications.show({ color: "green", message: "Added voice draft to RO." });
    } catch (err) {
      notifications.show({ color: "red", message: (err as Error).message });
    }
  }

  if (isPending) return <Loader />;
  if (roQ.isError) {
    const err = roQ.error;
    const isNotFound = err instanceof ApiError && err.status === 404;
    if (isNotFound) {
      return <Text c="dimmed">Repair order not found.</Text>;
    }
    return (
      <Alert color="red" title="Couldn't load this repair order">
        <Stack gap="xs">
          <Text size="sm">{(err as Error).message}</Text>
          <Group>
            <Button variant="default" size="xs" onClick={() => roQ.refetch()}>
              Retry
            </Button>
          </Group>
        </Stack>
      </Alert>
    );
  }
  if (!data) return <Text c="dimmed">Repair order not found.</Text>;
  const { repairOrder: ro } = data;
  const customerName = ro.customer
    ? [ro.customer.firstName, ro.customer.lastName].filter(Boolean).join(" ")
    : "Unknown customer";
  const vehicleSummary = ro.vehicle
    ? [ro.vehicle.year, ro.vehicle.make, ro.vehicle.model].filter(Boolean).join(" ")
    : "—";

  const photoSrc = (photoId: string): string | null => {
    const photo = ro.photos.find((p) => p.id === photoId);
    if (!photo) return null;
    const host = (import.meta.env as any).VITE_PHOTOS_CDN ?? "TODO-photos-cdn";
    return `https://${host}/${photo.s3Key}`;
  };

  const inspectionItemCount = ro.inspection?.items.length ?? 0;

  return (
    <Stack>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={2}>
          <Title order={2}>{formatRoNumber(ro.number)}</Title>
          <Text c="dimmed" size="sm">
            {customerName}
            {ro.customer?.phone ? ` · ${formatPhone(ro.customer.phone)}` : ""}
          </Text>
          <Text size="sm">
            {vehicleSummary}
            {ro.vehicle?.vin ? ` · VIN ${ro.vehicle.vin}` : ""}
          </Text>
        </Stack>
        <Stack gap={4} align="flex-end">
          <Select
            label="Status"
            data={STATUS_OPTIONS}
            value={ro.status}
            onChange={(v) => v && patchRo.mutate({ status: v as RoStatus })}
            allowDeselect={false}
            w={200}
          />
          {ro.estimate?.sentAt && (
            <Badge variant="light" color={ro.estimate.approvedAt ? "green" : "blue"}>
              Estimate {ro.estimate.approvedAt ? "approved" : "sent"}
            </Badge>
          )}
        </Stack>
      </Group>

      {ro.concern && (
        <Card withBorder>
          <Text size="sm" c="dimmed">
            Concern
          </Text>
          <Text>{ro.concern}</Text>
        </Card>
      )}

      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Line items</Title>
          <VoiceCapture repairOrderId={id!} onDraft={setVoiceDraft} />
        </Group>

        <LineItemEditor
          items={ro.lineItems}
          busy={createLine.isPending || patchLine.isPending || deleteLine.isPending}
          onCreate={async (draft) => {
            await createLine.mutateAsync(draft);
          }}
          onUpdate={async (lineId, draft) => {
            await patchLine.mutateAsync({ lineId, draft });
          }}
          onDelete={async (lineId) => {
            await deleteLine.mutateAsync(lineId);
          }}
        />

        <Group>
          <Button
            variant="default"
            leftSection={<IconClipboardList size={16} />}
            onClick={() => setTemplatePickerOpen(true)}
          >
            + Template
          </Button>
        </Group>

        <Divider my="sm" />
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Labor
          </Text>
          <Text>{formatMoney(ro.laborTotal)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Parts / fees
          </Text>
          <Text>{formatMoney(ro.partsTotal)}</Text>
        </Group>
        <Group justify="space-between">
          <Text fw={700}>Total</Text>
          <Text fw={700}>{formatMoney(ro.total)}</Text>
        </Group>
      </Stack>

      <Group>
        <Button
          leftSection={<IconSend size={16} />}
          onClick={openSendEstimate}
          loading={estimateLoading}
          disabled={ro.lineItems.length === 0 || !ro.customer}
        >
          Send estimate
        </Button>
        <Button
          variant="default"
          leftSection={<IconCreditCard size={16} />}
          onClick={() => createPayLink.mutate()}
          loading={createPayLink.isPending}
          disabled={ro.total === 0}
        >
          Generate pay link
        </Button>
      </Group>

      <Card withBorder>
        <Group justify="space-between" mb="xs" wrap="wrap">
          <Group gap="xs">
            <IconChecklist size={18} />
            <Title order={5}>Inspection (DVI)</Title>
            {ro.inspection?.status === "sent" && (
              <Badge variant="light" color="blue">
                Sent{ro.inspection.viewedAt ? " · viewed" : ""}
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            <Button
              variant="default"
              size="xs"
              leftSection={<IconSend size={14} />}
              onClick={() => setSendInspectionOpen(true)}
              disabled={inspectionItemCount === 0 || !ro.customer}
            >
              Send inspection
            </Button>
          </Group>
        </Group>
        {inspectionItemCount === 0 ? (
          <Text size="sm" c="dimmed">
            Group your photos into inspection items so the customer sees what they're paying
            for. Add inspection item using the button below.
          </Text>
        ) : null}
        <InspectionEditor
          repairOrderId={id!}
          inspection={
            ro.inspection ?? { status: "draft", items: [], sentAt: null, viewedAt: null }
          }
          photoSrc={photoSrc}
          onPhotoAttached={(p) => {
            qc.setQueryData<RoDetail | undefined>(["ro", id], (prev) => {
              if (!prev) return prev;
              if (prev.repairOrder.photos.some((existing) => existing.id === p.id)) {
                return prev;
              }
              return {
                ...prev,
                repairOrder: {
                  ...prev.repairOrder,
                  photos: [...prev.repairOrder.photos, p as GalleryPhoto],
                },
              };
            });
          }}
        />
      </Card>

      <Card withBorder>
        <Group justify="space-between" mb="xs">
          <Text size="sm" c="dimmed">
            Photos
          </Text>
          <PhotoCapture
            repairOrderId={id!}
            onUploaded={(p: CapturedPhoto) => {
              qc.setQueryData<RoDetail | undefined>(["ro", id], (prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  repairOrder: {
                    ...prev.repairOrder,
                    photos: [...prev.repairOrder.photos, p as GalleryPhoto],
                  },
                };
              });
            }}
          />
        </Group>
        <PhotoGallery photos={ro.photos} />
      </Card>

      {/* Send estimate modal */}
      <Modal
        opened={estimateOpen}
        onClose={() => setEstimateOpen(false)}
        title="Review estimate"
        size="lg"
      >
        <Stack>
          <Group justify="space-between" wrap="wrap">
            <Text size="sm" c="dimmed">
              Edit before sending. Customer receives this as SMS (mocked → email until the
              10DLC campaign clears).
            </Text>
            <Group gap="xs">
              {aiPolished && (
                <Badge variant="light" color="grape" size="sm">
                  AI polished
                </Badge>
              )}
              <Button
                size="xs"
                variant={aiPolished ? "default" : "light"}
                color="grape"
                onClick={togglePolish}
                loading={polishLoading}
                leftSection={<IconSparkles size={14} />}
              >
                {aiPolished ? "Revert to template" : "Polish with AI"}
              </Button>
            </Group>
          </Group>
          <Textarea
            autosize
            minRows={6}
            value={estimateDraft}
            onChange={(e) => setEstimateDraft(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEstimateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendEstimate.mutate()}
              loading={sendEstimate.isPending}
              disabled={!estimateDraft.trim()}
            >
              Send
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Pay link modal */}
      <Modal opened={payOpen} onClose={() => setPayOpen(false)} title="Pay link">
        <Stack>
          <Text size="sm" c="dimmed">
            Send this URL to the customer. They'll be able to pay {formatMoney(ro.total)} via Stripe.
          </Text>
          <Card withBorder p="xs">
            <Text size="sm" style={{ wordBreak: "break-all" }}>
              {payUrl}
            </Text>
          </Card>
          <Group justify="flex-end">
            {payUrl && (
              <CopyButton value={payUrl}>
                {({ copied, copy }) => (
                  <Button
                    leftSection={<IconCopy size={16} />}
                    variant="default"
                    onClick={copy}
                    color={copied ? "green" : undefined}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                )}
              </CopyButton>
            )}
            <Button onClick={() => setPayOpen(false)}>Done</Button>
          </Group>
        </Stack>
      </Modal>

      <SendInspectionModal
        opened={sendInspectionOpen}
        onClose={() => setSendInspectionOpen(false)}
        repairOrderId={id!}
        customerFirstName={ro.customer?.firstName ?? "there"}
        vehicleSummary={vehicleSummary}
        itemCount={inspectionItemCount}
        totalCents={ro.total}
        hasLineItems={ro.lineItems.length > 0}
        onSent={() => qc.invalidateQueries({ queryKey: ["ro", id] })}
      />

      <TemplatePicker
        opened={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onPick={pickTemplate}
      />

      {/* Voice draft review modal */}
      <Modal
        opened={!!voiceDraft}
        onClose={() => setVoiceDraft(null)}
        title="Voice draft"
        size="lg"
      >
        {voiceDraft && (
          <Stack>
            {voiceDraft.concern && (
              <div>
                <Text size="sm" c="dimmed">
                  Concern
                </Text>
                <Text>{voiceDraft.concern}</Text>
              </div>
            )}
            {voiceDraft.diagnosis && (
              <div>
                <Text size="sm" c="dimmed">
                  Diagnosis
                </Text>
                <Text>{voiceDraft.diagnosis}</Text>
              </div>
            )}
            <div>
              <Text size="sm" c="dimmed" mb="xs">
                Line items
              </Text>
              <Stack gap="xs">
                {voiceDraft.lineItems.map((li, i) => (
                  <Group key={i} justify="space-between">
                    <Text>
                      <Badge size="sm" variant="light" mr="xs">
                        {li.kind}
                      </Badge>
                      {li.description}
                    </Text>
                    <Text>{li.total != null ? formatMoney(li.total) : "—"}</Text>
                  </Group>
                ))}
              </Stack>
            </div>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setVoiceDraft(null)}>
                Discard
              </Button>
              <Button onClick={() => acceptVoiceDraft(voiceDraft)}>Accept all</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
