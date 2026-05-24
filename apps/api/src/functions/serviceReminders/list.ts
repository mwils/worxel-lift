import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import mongoose from "mongoose";
import {
  Customer,
  SERVICE_REMINDER_STATUSES,
  ServiceReminder,
  Vehicle,
  objectId,
} from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";
import { serializeServiceReminder } from "./_serialize.js";

const ListQuery = z.object({
  status: z.enum(SERVICE_REMINDER_STATUSES).optional(),
  customerId: objectId.optional(),
  vehicleId: objectId.optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((s) => Math.min(parseInt(s, 10), 200))
    .optional(),
  // Cursor is the previous page's last `dueAt` ISO timestamp + `_id` to break
  // ties deterministically. Kept simple — opaque-cursor work is overkill here.
  cursor: z.string().optional(),
});

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const { status, customerId, vehicleId, limit, cursor } = parseQuery(event, ListQuery);

    const filter: Record<string, unknown> = { shopId: user.shopId };
    if (status) filter.status = status;
    if (customerId) filter.customerId = customerId;
    if (vehicleId) filter.vehicleId = vehicleId;

    const pageSize = limit ?? 50;

    if (cursor) {
      // Cursor format: "<iso>|<id>" — strictly-greater on (dueAt, _id).
      const [iso, id] = cursor.split("|");
      const dueAt = iso ? new Date(iso) : null;
      if (dueAt && !Number.isNaN(dueAt.getTime()) && id) {
        filter.$or = [
          { dueAt: { $gt: dueAt } },
          { dueAt, _id: { $gt: id } },
        ];
      }
    }

    const reminders = await ServiceReminder.find(filter)
      .sort({ dueAt: 1, _id: 1 })
      .limit(pageSize + 1)
      .lean();

    const page = reminders.slice(0, pageSize);
    const hasMore = reminders.length > pageSize;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? `${last.dueAt instanceof Date ? last.dueAt.toISOString() : last.dueAt}|${String(last._id)}`
        : null;

    // Embed enough customer/vehicle data for the list rows so the frontend
    // doesn't need to fan out. 1–3 bay shops have small N here.
    const customerIds = Array.from(new Set(page.map((r) => String(r.customerId))));
    const vehicleIds = Array.from(new Set(page.map((r) => String(r.vehicleId))));

    const toObjectId = (s: string) => new mongoose.Types.ObjectId(s);
    const [customers, vehicles] = await Promise.all([
      customerIds.length
        ? Customer.find({
            shopId: user.shopId,
            _id: { $in: customerIds.map(toObjectId) },
          })
            .select("firstName lastName phone smsOptOutAt")
            .lean()
        : Promise.resolve([]),
      vehicleIds.length
        ? Vehicle.find({
            shopId: user.shopId,
            _id: { $in: vehicleIds.map(toObjectId) },
          })
            .select("year make model plate")
            .lean()
        : Promise.resolve([]),
    ]);

    const customerById = new Map(
      customers.map((c) => [
        String(c._id),
        {
          id: String(c._id),
          firstName: c.firstName,
          lastName: c.lastName ?? null,
          phone: c.phone,
          smsOptOutAt:
            c.smsOptOutAt instanceof Date ? c.smsOptOutAt.toISOString() : (c.smsOptOutAt ?? null),
        },
      ])
    );
    const vehicleById = new Map(
      vehicles.map((v) => [
        String(v._id),
        {
          id: String(v._id),
          year: v.year ?? null,
          make: v.make ?? null,
          model: v.model ?? null,
          plate: v.plate ?? null,
        },
      ])
    );

    return ok({
      reminders: page.map((r) => ({
        ...serializeServiceReminder(r),
        customer: customerById.get(String(r.customerId)) ?? null,
        vehicle: vehicleById.get(String(r.vehicleId)) ?? null,
      })),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
