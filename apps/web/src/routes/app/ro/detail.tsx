import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Checkbox,
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
import { DateTimePicker } from "@mantine/dates";
import {
  IconCreditCard,
  IconSend,
  IconSparkles,
  IconClipboardList,
  IconChecklist,
  IconCalendarEvent,
} from "@tabler/icons-react";
import { RO_STATUSES, type RoStatus } from "@lift/shared/constants";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import {
  formatMoney,
  formatPhone,
  formatRoNumber,
  formatVisit,
  instantToPickerDate,
  pickerDateToInstant,
  shopTimezone,
} from "../../../lib/format";
import { notifyError } from "../../../lib/notify";
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
    scheduledFor: string | null;
    estimate: {
      sentAt?: string | null;
      viewedAt?: string | null;
      approvedAt?: string | null;
      declinedAt?: string | null;
      approvedTotal?: number | null;
      changedSinceApproval?: boolean;
    } | null;
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
  const { me } = useAuth();
  const tz = shopTimezone(me?.shop?.timezone);

  // ── Scheduled visit ──────────────────────────────────────────────────────
  // The picker edits shop-zone wall time; conversion to/from the stored
  // instant happens at the modal boundary (pickerDateToInstant and back).
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<Date | null>(null);
  const [moveToScheduled, setMoveToScheduled] = useState(false);

  const roQ = useQuery({
    queryKey: ["ro", id],
    queryFn: () => api.get<RoDetail>(`/repair-orders/${id}`),
    enabled: !!id,
  });
  const { data, isPending } = roQ;

  const patchRo = useMutation({
    mutationFn: (patch: Partial<{ status: RoStatus; scheduledFor: string | null }>) =>
      api.patch(`/repair-orders/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ro", id] });
      qc.invalidateQueries({ queryKey: ["ros"] });
    },
    onError: (err) => notifyError(err, { title: "Couldn't save changes" }),
  });

  const createLine = useMutation({
    mutationFn: (draft: LineItemDraft) =>
      api.post<LineItemMutationResp>(`/repair-orders/${id}/line-items`, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ro", id] }),
    onError: (err) => notifyError(err, { title: "Couldn't add line" }),
  });

  const patchLine = useMutation({
    mutationFn: ({ lineId, draft }: { lineId: string; draft: LineItemDraft }) =>
      api.patch<LineItemMutationResp>(`/repair-orders/${id}/line-items/${lineId}`, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ro", id] }),
    onError: (err) => notifyError(err, { title: "Couldn't update line" }),
  });

  const deleteLine = useMutation({
    mutationFn: (lineId: string) => api.del(`/repair-orders/${id}/line-items/${lineId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ro", id] }),
    onError: (err) => notifyError(err, { title: "Couldn't delete line" }),
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
    onError: (err) => notifyError(err, { title: "Couldn't apply saved job" }),
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
      notifyError(err, { title: "Couldn't draft estimate" });
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
      notifyError(err, { title: "Couldn't polish estimate" });
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
    onError: (err) => notifyError(err, { title: "Couldn't send estimate" }),
  });

  // ── Send inspection ──────────────────────────────────────────────────────
  const [sendInspectionOpen, setSendInspectionOpen] = useState(false);

  // ── Pay link ─────────────────────────────────────────────────────────────
  // Mirrors the Send Estimate flow: fetch a drafted SMS (containing the pay
  // URL) and let the owner review/edit before it actually sends.
  const [payOpen, setPayOpen] = useState(false);
  const [payDraft, setPayDraft] = useState("");
  const [payTemplate, setPayTemplate] = useState("");
  const [payAiPolished, setPayAiPolished] = useState(false);
  const [payDraftLoading, setPayDraftLoading] = useState(false);
  const [payPolishLoading, setPayPolishLoading] = useState(false);
  // Payments are set up lazily — until the shop's Stripe Connect account can
  // take charges, the pay-link button opens a setup prompt instead.
  const [paySetupOpen, setPaySetupOpen] = useState(false);
  const paymentsReady = me?.shop?.payments.chargesEnabled === true;
  const startPaymentSetup = useMutation({
    mutationFn: () => api.post<{ url: string }>("/payments/connect/start"),
    onSuccess: (res) => {
      window.location.href = res.url;
    },
    onError: (err) => notifyError(err, { title: "Couldn't start payment setup" }),
  });

  async function openSendPayLink() {
    if (!data?.repairOrder.customer) return;
    if (!paymentsReady) {
      setPaySetupOpen(true);
      return;
    }
    setPayDraftLoading(true);
    try {
      const res = await api.post<{ draft: string; source: "template" | "ai" }>(
        "/messages/draft",
        {
          customerId: data.repairOrder.customer.id,
          repairOrderId: id,
          kind: "pay_link",
          useAi: false,
        }
      );
      setPayTemplate(res.draft);
      setPayDraft(res.draft);
      setPayAiPolished(false);
      setPayOpen(true);
    } catch (err) {
      notifyError(err, { title: "Couldn't draft pay link" });
    } finally {
      setPayDraftLoading(false);
    }
  }

  async function togglePayPolish() {
    if (!data?.repairOrder.customer) return;
    if (payAiPolished) {
      setPayDraft(payTemplate);
      setPayAiPolished(false);
      return;
    }
    setPayPolishLoading(true);
    try {
      const res = await api.post<{ draft: string; source: "ai" }>("/messages/draft", {
        customerId: data.repairOrder.customer.id,
        repairOrderId: id,
        kind: "pay_link",
        useAi: true,
      });
      setPayDraft(res.draft);
      setPayAiPolished(true);
    } catch (err) {
      notifyError(err, { title: "Couldn't polish pay link" });
    } finally {
      setPayPolishLoading(false);
    }
  }

  const sendPayLink = useMutation({
    mutationFn: () =>
      api.post("/payments/create-link", {
        repairOrderId: id,
        draftOverride: payDraft,
        useAi: payAiPolished,
      }),
    onSuccess: () => {
      notifications.show({ color: "green", message: "Pay link sent." });
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ["ro", id] });
    },
    onError: (err) => notifyError(err, { title: "Couldn't text pay link" }),
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
      notifyError(err, { title: "Voice draft didn't work" });
    }
  }

  if (isPending) return <Loader />;
  if (roQ.isError) {
    const err = roQ.error;
    const isNotFound = err instanceof ApiError && err.status === 404;
    if (isNotFound) {
      return (
        <Stack gap="xs" align="flex-start">
          <Text c="dimmed">Can't find that RO.</Text>
          <Button component={Link} to="/app/board" variant="default" size="xs">
            Back to board
          </Button>
        </Stack>
      );
    }
    return (
      <Alert color="red" title="Couldn't open this RO">
        <Stack gap="xs">
          <Text size="sm">Network hiccup — try again in a second.</Text>
          <Group>
            <Button variant="default" size="xs" onClick={() => roQ.refetch()}>
              Retry
            </Button>
            <Button component={Link} to="/app/board" variant="default" size="xs">
              Back to board
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mt="md">
            {(err as Error).message}
          </Text>
        </Stack>
      </Alert>
    );
  }
  if (!data)
    return (
      <Stack gap="xs" align="flex-start">
        <Text c="dimmed">Can't find that RO.</Text>
        <Button component={Link} to="/app/board" variant="default" size="xs">
          Back to board
        </Button>
      </Stack>
    );
  const { repairOrder: ro } = data;
  const customerName = ro.customer
    ? [ro.customer.firstName, ro.customer.lastName].filter(Boolean).join(" ")
    : "Unknown customer";
  const vehicleSummary = ro.vehicle
    ? [ro.vehicle.year, ro.vehicle.make, ro.vehicle.model].filter(Boolean).join(" ")
    : "—";

  const photoSrc = (photoId: string): string | null => {
    const photo = ro.photos.find((p) => p.id === photoId);
    return photo?.url ?? null;
  };

  const inspectionItemCount = ro.inspection?.items.length ?? 0;

  // Estimate state for the header badge + the sent/viewed/approved trail. An
  // approval only counts against the numbers the customer actually saw — once
  // the lines drift from the snapshot, the API flips changedSinceApproval.
  const estimateChanged = !!ro.estimate?.approvedAt && !!ro.estimate?.changedSinceApproval;
  const estimateTimeline = ro.estimate?.sentAt
    ? [
        `sent ${formatVisit(ro.estimate.sentAt, tz)}`,
        ro.estimate.viewedAt ? `viewed ${formatVisit(ro.estimate.viewedAt, tz)}` : null,
        ro.estimate.approvedAt ? `approved ${formatVisit(ro.estimate.approvedAt, tz)}` : null,
        !ro.estimate.approvedAt && ro.estimate.declinedAt
          ? `declined ${formatVisit(ro.estimate.declinedAt, tz)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const openSchedule = () => {
    setScheduleDraft(ro.scheduledFor ? instantToPickerDate(ro.scheduledFor, tz) : null);
    // A fresh manual RO ("in") being given a date is almost always a future
    // drop-off — offer the column move. Any other status (diagnosing,
    // in_repair…) means the car is physically here; leave the status alone.
    setMoveToScheduled(ro.status === "in");
    setScheduleOpen(true);
  };

  const saveSchedule = () => {
    if (!scheduleDraft) return;
    patchRo.mutate(
      {
        scheduledFor: pickerDateToInstant(scheduleDraft, tz).toISOString(),
        ...(moveToScheduled && ro.status !== "scheduled" ? { status: "scheduled" as RoStatus } : {}),
      },
      { onSuccess: () => setScheduleOpen(false) }
    );
  };

  const clearSchedule = () => {
    patchRo.mutate({ scheduledFor: null }, { onSuccess: () => setScheduleOpen(false) });
  };

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
          {ro.scheduledFor ? (
            <Group gap={4} wrap="nowrap">
              <IconCalendarEvent size={14} />
              <Text size="sm" fw={500}>
                {formatVisit(ro.scheduledFor, tz)}
              </Text>
              <Button variant="subtle" size="compact-xs" onClick={openSchedule}>
                Change
              </Button>
            </Group>
          ) : (
            // A closed RO doesn't need a schedule prompt cluttering its header.
            !["picked_up", "voided", "cancelled_by_customer"].includes(ro.status) && (
              <Button
                variant="subtle"
                size="compact-xs"
                leftSection={<IconCalendarEvent size={14} />}
                onClick={openSchedule}
                style={{ alignSelf: "flex-start" }}
              >
                Schedule visit
              </Button>
            )
          )}
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
          {estimateChanged ? (
            <Badge variant="light" color="orange">
              Changed since approval · {formatMoney(ro.estimate?.approvedTotal ?? 0)} approved
            </Badge>
          ) : ro.estimate?.approvedAt ? (
            <Badge variant="light" color="green">
              Estimate approved
            </Badge>
          ) : ro.estimate?.declinedAt ? (
            <Badge variant="light" color="red">
              Estimate declined
            </Badge>
          ) : ro.estimate?.sentAt ? (
            <Badge variant="light" color="blue">
              Estimate sent{ro.estimate.viewedAt ? " · viewed" : ""}
            </Badge>
          ) : null}
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
            + Saved job
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

      {estimateChanged && (
        <Alert color="orange" variant="light" title="Changed since the customer approved">
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text size="sm">
              They approved {formatMoney(ro.estimate?.approvedTotal ?? 0)}; it's now{" "}
              {formatMoney(ro.total)}. Re-send so they can OK the new number.
            </Text>
            <Button
              size="xs"
              color="orange"
              onClick={openSendEstimate}
              loading={estimateLoading}
              disabled={ro.lineItems.length === 0 || !ro.customer}
            >
              Re-send for approval
            </Button>
          </Group>
        </Alert>
      )}
      <Group>
        <Button
          leftSection={<IconSend size={16} />}
          onClick={openSendEstimate}
          loading={estimateLoading}
          disabled={ro.lineItems.length === 0 || !ro.customer}
        >
          {ro.estimate?.sentAt ? "Re-send estimate" : "Send estimate"}
        </Button>
        <Button
          variant="default"
          leftSection={<IconCreditCard size={16} />}
          onClick={openSendPayLink}
          loading={payDraftLoading}
          disabled={ro.total === 0 || !ro.customer}
        >
          Text pay link
        </Button>
      </Group>
      {estimateTimeline && (
        <Text size="xs" c="dimmed" mt={-8}>
          Estimate {estimateTimeline}
        </Text>
      )}

      <Card withBorder>
        <Group justify="space-between" mb="xs" wrap="wrap">
          <Group gap="xs">
            <IconChecklist size={18} />
            <Title order={5}>Inspection</Title>
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
            for.
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
              Edit before sending. Customer gets this as a text.
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
                {aiPolished ? "Use my version" : "Polish with AI"}
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

      {/* Payments-not-set-up prompt (lazy Stripe Connect onboarding) */}
      <Modal
        opened={paySetupOpen}
        onClose={() => setPaySetupOpen(false)}
        title="Set up payments"
        centered
      >
        <Stack>
          <Alert color="blue" variant="light">
            Texting pay links needs a free Stripe account so the money lands in your bank.
            One-time setup, about 5 minutes — this RO will be right here when you're back.
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPaySetupOpen(false)}>
              Not now
            </Button>
            <Button
              onClick={() => startPaymentSetup.mutate()}
              loading={startPaymentSetup.isPending}
            >
              Set up payments
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title={ro.scheduledFor ? "Change scheduled visit" : "Schedule visit"}
        centered
      >
        <Stack>
          <DateTimePicker
            label="Drop-off date & time"
            description={`Shop time (${tz.replace(/_/g, " ")})`}
            placeholder="Pick date and time"
            value={scheduleDraft}
            onChange={setScheduleDraft}
            valueFormat="ddd MMM D, h:mm A"
            minDate={new Date()}
            popoverProps={{ withinPortal: true }}
            clearable={false}
          />
          {ro.status !== "scheduled" && (
            <Checkbox
              label="Move to the Scheduled column"
              checked={moveToScheduled}
              onChange={(e) => setMoveToScheduled(e.currentTarget.checked)}
            />
          )}
          <Group justify="space-between">
            {ro.scheduledFor ? (
              <Button variant="subtle" color="red" onClick={clearSchedule} loading={patchRo.isPending}>
                Clear date
              </Button>
            ) : (
              <span />
            )}
            <Group>
              <Button variant="default" onClick={() => setScheduleOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveSchedule} loading={patchRo.isPending} disabled={!scheduleDraft}>
                Save
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      {/* Pay link modal */}
      <Modal
        opened={payOpen}
        onClose={() => setPayOpen(false)}
        title="Review pay link"
        size="lg"
      >
        <Stack>
          <Group justify="space-between" wrap="wrap">
            <Text size="sm" c="dimmed">
              Edit before sending. Customer gets this as a text with a link to pay{" "}
              {formatMoney(ro.total)} via Stripe.
            </Text>
            <Group gap="xs">
              {payAiPolished && (
                <Badge variant="light" color="grape" size="sm">
                  AI polished
                </Badge>
              )}
              <Button
                size="xs"
                variant={payAiPolished ? "default" : "light"}
                color="grape"
                onClick={togglePayPolish}
                loading={payPolishLoading}
                leftSection={<IconSparkles size={14} />}
              >
                {payAiPolished ? "Use my version" : "Polish with AI"}
              </Button>
            </Group>
          </Group>
          <Textarea
            autosize
            minRows={6}
            value={payDraft}
            onChange={(e) => setPayDraft(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => sendPayLink.mutate()}
              loading={sendPayLink.isPending}
              disabled={!payDraft.trim()}
            >
              Send
            </Button>
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
        estimateApproved={!!ro.estimate?.approvedAt}
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
