import type { LineItemKind, ServiceCategory } from "@lift/shared/constants";

export interface JobTemplateLineItem {
  id: string | null;
  kind: LineItemKind;
  description: string;
  hours: number | null;
  rate: number | null;
  qty: number | null;
  unitPrice: number | null;
  total: number;
}

export interface JobTemplate {
  id: string;
  name: string;
  category: string | null;
  /** Service reminder this job schedules when it lands on a picked-up RO. */
  reminderCategory: ServiceCategory | null;
  notes: string | null;
  lineItems: JobTemplateLineItem[];
  itemCount: number;
  priceTotal: number;
  source: "custom" | "starter";
  starterKey: string | null;
  archivedAt: string | null;
  lastUsedAt: string | null;
  useCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StarterTemplate {
  starterKey: string;
  name: string;
  category: string;
  reminderCategory: ServiceCategory | null;
  lineItems: Omit<JobTemplateLineItem, "id">[];
  itemCount: number;
  priceTotal: number;
  imported: boolean;
}
