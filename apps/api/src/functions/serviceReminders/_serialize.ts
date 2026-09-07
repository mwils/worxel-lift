import type { ServiceReminderDoc } from "@lift/shared";

type LeanReminder = Omit<ServiceReminderDoc, never> & {
  _id: unknown;
  customerId: unknown;
  vehicleId: unknown;
  sourceRepairOrderId: unknown;
  sentMessageId?: unknown;
  dismissedBy?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

/** Stable wire format for service-reminder rows. */
export function serializeServiceReminder(r: LeanReminder) {
  return {
    id: String(r._id),
    customerId: String(r.customerId),
    vehicleId: String(r.vehicleId),
    sourceRepairOrderId: String(r.sourceRepairOrderId),
    category: r.category,
    status: r.status,
    dueAt: r.dueAt instanceof Date ? r.dueAt.toISOString() : r.dueAt,
    servicedAt:
      r.servicedAt instanceof Date ? r.servicedAt.toISOString() : (r.servicedAt ?? null),
    mileageAtService: r.mileageAtService ?? null,
    sentAt: r.sentAt instanceof Date ? r.sentAt.toISOString() : (r.sentAt ?? null),
    sentMessageId: r.sentMessageId ? String(r.sentMessageId) : null,
    dismissedAt:
      r.dismissedAt instanceof Date ? r.dismissedAt.toISOString() : (r.dismissedAt ?? null),
    dismissedBy: r.dismissedBy ? String(r.dismissedBy) : null,
    attempt: r.attempt ?? 0,
    promptVersion: r.promptVersion ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
  };
}
