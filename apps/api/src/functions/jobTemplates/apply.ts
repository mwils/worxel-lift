import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ApplyJobTemplateDto, JobTemplate, RepairOrder } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { applyRoTotals, computeLineItemTotal, type LineItemLike } from "../repairOrders/_totals.js";

interface AppliedItem {
  kind: string;
  description: string;
  hours?: number;
  rate?: number;
  qty?: number;
  unitPrice?: number;
  total: number;
  reminderCategory?: string;
}

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const templateId = event.pathParameters?.id;
    if (!templateId) return badRequest("Missing template id");

    const dto = await parseBody(event, ApplyJobTemplateDto);

    const template = await JobTemplate.findOne({ _id: templateId, shopId: user.shopId });
    if (!template) return notFound("Template not found");
    if (template.archivedAt) return badRequest("Template is archived");

    const ro = await RepairOrder.findOne({ _id: dto.repairOrderId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    const startIndex = ro.lineItems.length;

    const overrides = dto.overrides ?? {};
    const applied: AppliedItem[] = template.lineItems.map((src, idx) => {
      const ovr = overrides[String(idx)] ?? {};
      const merged = {
        kind: ovr.kind ?? src.kind,
        description: ovr.description ?? src.description,
        hours: ovr.hours ?? src.hours ?? undefined,
        rate: ovr.rate ?? src.rate ?? undefined,
        qty: ovr.qty ?? src.qty ?? undefined,
        unitPrice: ovr.unitPrice ?? src.unitPrice ?? undefined,
      };
      const total = computeLineItemTotal(merged);
      const item: AppliedItem = {
        kind: merged.kind,
        description: merged.description,
        total,
      };
      if (merged.hours !== undefined) item.hours = merged.hours;
      if (merged.rate !== undefined) item.rate = merged.rate;
      if (merged.qty !== undefined) item.qty = merged.qty;
      if (merged.unitPrice !== undefined) item.unitPrice = merged.unitPrice;
      // Carry the template's reminder tag onto the RO line so pickup can
      // schedule the right reminder without keyword-matching the description.
      if (template.reminderCategory) item.reminderCategory = template.reminderCategory;
      return item;
    });

    for (const item of applied) {
      (ro.lineItems as any).push(item);
    }

    await applyRoTotals(ro, user.shopId);
    ro.lineItemsChangedAt = new Date();
    await ro.save();

    template.useCount = (template.useCount ?? 0) + 1;
    template.lastUsedAt = new Date();
    await template.save();

    const addedDocs = (ro.lineItems as unknown as LineItemLike[]).slice(startIndex);
    const addedLineItems = addedDocs.map((li) => ({
      id: li._id ? String(li._id) : null,
      kind: li.kind,
      description: li.description,
      hours: li.hours ?? null,
      rate: li.rate ?? null,
      qty: li.qty ?? null,
      unitPrice: li.unitPrice ?? null,
      total: li.total,
    }));

    return ok({
      addedLineItems,
      totals: {
        laborTotal: ro.laborTotal,
        partsTotal: ro.partsTotal,
        taxTotal: ro.taxTotal ?? 0,
        total: ro.total,
      },
      template: {
        id: String(template._id),
        name: template.name,
        useCount: template.useCount,
        lastUsedAt: template.lastUsedAt,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
