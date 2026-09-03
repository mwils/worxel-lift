import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { LineItemDto, RepairOrder, UpdateLineItemDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, created, notFound, ok } from "../../lib/response.js";
import { applyRoTotals, type LineItemLike } from "./_totals.js";

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
    await applyRoTotals(ro, user.shopId);
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

    await applyRoTotals(ro, user.shopId);
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

    await applyRoTotals(ro, user.shopId);
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
