import type { LineItemKind } from "@lift/shared/constants";

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
  lineItems: Omit<JobTemplateLineItem, "id">[];
  itemCount: number;
  priceTotal: number;
  imported: boolean;
}
