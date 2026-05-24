import { computeLineItemTotal } from "../repairOrders/_totals.js";

export interface JobTemplateLineItemLike {
  _id?: unknown;
  kind: string;
  description: string;
  hours?: number | null;
  rate?: number | null;
  qty?: number | null;
  unitPrice?: number | null;
}

export interface JobTemplateLike {
  _id: unknown;
  shopId?: unknown;
  name: string;
  category?: string | null;
  notes?: string | null;
  lineItems: JobTemplateLineItemLike[];
  source?: string;
  starterKey?: string | null;
  archivedAt?: Date | null;
  lastUsedAt?: Date | null;
  useCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function serializeTemplateLineItem(li: JobTemplateLineItemLike) {
  return {
    id: li._id ? String(li._id) : null,
    kind: li.kind,
    description: li.description,
    hours: li.hours ?? null,
    rate: li.rate ?? null,
    qty: li.qty ?? null,
    unitPrice: li.unitPrice ?? null,
    total: computeLineItemTotal({
      kind: li.kind,
      description: li.description,
      hours: li.hours ?? undefined,
      rate: li.rate ?? undefined,
      qty: li.qty ?? undefined,
      unitPrice: li.unitPrice ?? undefined,
    }),
  };
}

export function serializeJobTemplate(t: JobTemplateLike) {
  const items = t.lineItems.map(serializeTemplateLineItem);
  const priceTotal = items.reduce((acc, it) => acc + it.total, 0);
  return {
    id: String(t._id),
    name: t.name,
    category: t.category ?? null,
    notes: t.notes ?? null,
    lineItems: items,
    itemCount: items.length,
    priceTotal,
    source: t.source ?? "custom",
    starterKey: t.starterKey ?? null,
    archivedAt: t.archivedAt ?? null,
    lastUsedAt: t.lastUsedAt ?? null,
    useCount: t.useCount ?? 0,
    createdAt: t.createdAt ?? null,
    updatedAt: t.updatedAt ?? null,
  };
}
