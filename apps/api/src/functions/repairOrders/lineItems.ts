import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { LineItemDto, RepairOrder, UpdateLineItemDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, created, notFound, ok } from "../../lib/response.js";

interface LineItemLike {
  _id: unknown;
  kind: string;
  description: string;
  hours?: number;
  rate?: number;
  qty?: number;
  unitPrice?: number;
  total: number;
}

/**
 * Recompute laborTotal / partsTotal / total from the RO's current line items.
 * "fee" items roll into partsTotal — they're flat-line, not labor — so the
 * board still shows the right grand total. Tax is unmanaged in v1.
 */
function recomputeTotals(items: LineItemLike[]): { laborTotal: number; partsTotal: number; total: number } {
  let laborTotal = 0;
  let partsTotal = 0;
  for (const item of items) {
    if (item.kind === "labor") laborTotal += item.total;
    else partsTotal += item.total;
  }
  return { laborTotal, partsTotal, total: laborTotal + partsTotal };
}

function serializeLineItem(li: LineItemLike) {
  return {
    id: String(li._id),
    kind: li.kind,
    description: li.description,
    hours: li.hours ?? null,
    rate: li.rate ?? null,
    qty: li.qty ?? null,
    unitPrice: li.unitPrice ?? null,
    total: li.total,
  };
}

export const createHandler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const roId = event.pathParameters?.id;
    if (!roId) return badRequest("Missing repair order id");

    const dto = await parseBody(event, LineItemDto);

    const ro = await RepairOrder.findOne({ _id: roId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    ro.lineItems.push(dto as any);
    const totals = recomputeTotals(ro.lineItems as unknown as LineItemLike[]);
    ro.laborTotal = totals.laborTotal;
    ro.partsTotal = totals.partsTotal;
    ro.total = totals.total;
    await ro.save();

    const created_ = ro.lineItems[ro.lineItems.length - 1] as unknown as LineItemLike;

    return created({
      lineItem: serializeLineItem(created_),
      totals: {
        laborTotal: ro.laborTotal,
        partsTotal: ro.partsTotal,
        taxTotal: ro.taxTotal ?? 0,
        total: ro.total,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});

export const patchHandler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const roId = event.pathParameters?.id;
    const lineId = event.pathParameters?.lineId;
    if (!roId || !lineId) return badRequest("Missing repair order or line item id");

    const dto = await parseBody(event, UpdateLineItemDto);

    const ro = await RepairOrder.findOne({ _id: roId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    const li = (ro.lineItems as any).id(lineId);
    if (!li) return notFound("Line item not found");

    if (dto.kind !== undefined) li.kind = dto.kind;
    if (dto.description !== undefined) li.description = dto.description;
    if (dto.hours !== undefined) li.hours = dto.hours;
    if (dto.rate !== undefined) li.rate = dto.rate;
    if (dto.qty !== undefined) li.qty = dto.qty;
    if (dto.unitPrice !== undefined) li.unitPrice = dto.unitPrice;
    if (dto.total !== undefined) li.total = dto.total;

    const totals = recomputeTotals(ro.lineItems as unknown as LineItemLike[]);
    ro.laborTotal = totals.laborTotal;
    ro.partsTotal = totals.partsTotal;
    ro.total = totals.total;
    await ro.save();

    return ok({
      lineItem: serializeLineItem(li as unknown as LineItemLike),
      totals: {
        laborTotal: ro.laborTotal,
        partsTotal: ro.partsTotal,
        taxTotal: ro.taxTotal ?? 0,
        total: ro.total,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});

export const deleteHandler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const roId = event.pathParameters?.id;
    const lineId = event.pathParameters?.lineId;
    if (!roId || !lineId) return badRequest("Missing repair order or line item id");

    const ro = await RepairOrder.findOne({ _id: roId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    const li = (ro.lineItems as any).id(lineId);
    if (!li) return notFound("Line item not found");
    li.deleteOne();

    const totals = recomputeTotals(ro.lineItems as unknown as LineItemLike[]);
    ro.laborTotal = totals.laborTotal;
    ro.partsTotal = totals.partsTotal;
    ro.total = totals.total;
    await ro.save();

    return ok({
      deletedId: lineId,
      totals: {
        laborTotal: ro.laborTotal,
        partsTotal: ro.partsTotal,
        taxTotal: ro.taxTotal ?? 0,
        total: ro.total,
      },
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
