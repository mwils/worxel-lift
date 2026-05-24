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
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  oil_change: "Oil change",
  tire_rotation: "Tire rotation",
  brake_inspection: "Brake inspection",
  coolant_service: "Coolant service",
  transmission_service: "Transmission service",
  alignment: "Alignment check",
};
