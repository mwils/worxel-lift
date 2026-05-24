import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import mongoose from "mongoose";
import {
  InspectionItemDto,
  RepairOrder,
  UpdateInspectionItemDto,
} from "@lift/shared";
import { handleKnownErrors, parseBody, withAuth } from "../../lib/middleware.js";
import { badRequest, created, notFound, ok } from "../../lib/response.js";

interface InspectionItemLike {
  _id: unknown;
  title: string;
  severity: "green" | "yellow" | "red";
  note?: string;
  photoIds?: unknown[];
  order?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

function serializeItem(item: InspectionItemLike) {
  return {
    id: String(item._id),
    title: item.title,
    severity: item.severity,
    note: item.note ?? null,
    photoIds: (item.photoIds ?? []).map((id) => String(id)),
    order: item.order ?? 0,
    createdAt: item.createdAt ?? null,
    updatedAt: item.updatedAt ?? null,
  };
}

export const createHandler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const roId = event.pathParameters?.id;
    if (!roId) return badRequest("Missing repair order id");

    const dto = await parseBody(event, InspectionItemDto);

    const ro = await RepairOrder.findOne({ _id: roId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    if (!ro.inspection) {
      (ro as any).inspection = { status: "draft", items: [] };
    }

    const inspection = (ro as any).inspection;
    const nextOrder =
      dto.order ??
      (inspection.items.length
        ? Math.max(...inspection.items.map((i: any) => i.order ?? 0)) + 1
        : 0);

    inspection.items.push({
      title: dto.title,
      severity: dto.severity,
      note: dto.note,
      photoIds: (dto.photoIds ?? []).map((id) => new mongoose.Types.ObjectId(id)),
      order: nextOrder,
    });
    await ro.save();

    const createdItem = inspection.items[inspection.items.length - 1] as InspectionItemLike;
    return created({ item: serializeItem(createdItem) });
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
    const itemId = event.pathParameters?.itemId;
    if (!roId || !itemId) return badRequest("Missing repair order or item id");

    const dto = await parseBody(event, UpdateInspectionItemDto);

    const ro = await RepairOrder.findOne({ _id: roId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    const inspection = (ro as any).inspection;
    if (!inspection) return notFound("Inspection item not found");

    const item = inspection.items.id(itemId);
    if (!item) return notFound("Inspection item not found");

    if (dto.title !== undefined) item.title = dto.title;
    if (dto.severity !== undefined) item.severity = dto.severity;
    if (dto.note !== undefined) item.note = dto.note;
    if (dto.photoIds !== undefined) {
      item.photoIds = dto.photoIds.map((id) => new mongoose.Types.ObjectId(id));
    }
    if (dto.order !== undefined) item.order = dto.order;

    await ro.save();
    return ok({ item: serializeItem(item as unknown as InspectionItemLike) });
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
    const itemId = event.pathParameters?.itemId;
    if (!roId || !itemId) return badRequest("Missing repair order or item id");

    const ro = await RepairOrder.findOne({ _id: roId, shopId: user.shopId });
    if (!ro) return notFound("Repair order not found");

    const inspection = (ro as any).inspection;
    if (!inspection) return notFound("Inspection item not found");

    const item = inspection.items.id(itemId);
    if (!item) return notFound("Inspection item not found");
    item.deleteOne();
    await ro.save();

    return ok({ deletedId: itemId });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
