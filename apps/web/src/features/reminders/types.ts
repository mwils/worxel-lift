import type { ServiceCategory, ServiceReminderStatus } from "@lift/shared/constants";

export type { ServiceCategory, ServiceReminderStatus };

export interface ServiceReminderRow {
  id: string;
  customerId: string;
  vehicleId: string;
  sourceRepairOrderId: string;
  category: ServiceCategory;
  status: ServiceReminderStatus;
  dueAt: string;
  /** When / at what odometer the source RO did this service. Display only. */
  servicedAt: string | null;
  mileageAtService: number | null;
  sentAt: string | null;
  sentMessageId: string | null;
  dismissedAt: string | null;
  dismissedBy: string | null;
  attempt: number;
  promptVersion: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string;
    smsOptOutAt: string | null;
  } | null;
  vehicle: {
    id: string;
    year: number | null;
    make: string | null;
    model: string | null;
    plate: string | null;
  } | null;
}

export interface ServiceRemindersListResponse {
  reminders: ServiceReminderRow[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Per-status totals for the filter chips. First page only; null after that. */
  counts: Record<ServiceReminderStatus, number> | null;
}

/**
 * Due-date lenses for the reminders queue. Unlike the RO history page these
 * look FORWARD — a reminder's dueAt is usually in the future — so "overdue"
 * replaces "today" as the first thing Mike wants.
 */
export const DUE_RANGES = ["overdue", "this_week", "this_month", "custom"] as const;
export type DueRange = (typeof DUE_RANGES)[number];

export const DUE_RANGE_LABELS: Record<DueRange, string> = {
  overdue: "Overdue",
  this_week: "Due this week",
  this_month: "Due this month",
  custom: "Custom range",
};

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  oil_change: "Oil change",
  tire_rotation: "Tire rotation",
  brake_inspection: "Brake inspection",
  coolant_service: "Coolant service",
  transmission_service: "Transmission service",
  alignment: "Alignment check",
};
