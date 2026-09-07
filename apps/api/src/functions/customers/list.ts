import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { Customer, Vehicle, normalizePlate } from "@lift/shared";
import { handleKnownErrors, parseQuery, withAuth } from "../../lib/middleware.js";
import { badRequest, ok } from "../../lib/response.js";

const ListQuery = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PLATE_VIN_SCAN_CAP = 200;

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const { q, page, pageSize } = parseQuery(event, ListQuery);

    const filter: Record<string, unknown> = { shopId: user.shopId };
    const trimmed = q?.trim() ?? "";
    if (trimmed.length > 0) {
      const rx = new RegExp(escapeRegex(trimmed), "i");
      const plateNorm = normalizePlate(trimmed);

      // Find customer IDs whose vehicles match by plate (normalized) or VIN
      // (suffix). Union them into the $or filter so plate/VIN search returns
      // their owners.
      const [vinMatches, plateCandidates] = await Promise.all([
        plateNorm.length >= 3
          ? Vehicle.find(
              {
                shopId: user.shopId,
                vin: new RegExp(escapeRegex(plateNorm) + "$", "i"),
              },
              { customerId: 1 }
            )
              .limit(PLATE_VIN_SCAN_CAP)
              .lean()
          : Promise.resolve([]),
        plateNorm.length > 0
          ? Vehicle.find(
              {
                shopId: user.shopId,
                $or: [
                  { plateNormalized: new RegExp(escapeRegex(plateNorm)) },
                  // Pre-backfill rows without plateNormalized: normalize in JS below.
                  { plateNormalized: { $exists: false }, plate: { $exists: true, $ne: null } },
                ],
              },
              { customerId: 1, plate: 1, plateNormalized: 1 }
            )
              .limit(PLATE_VIN_SCAN_CAP)
              .lean()
          : Promise.resolve([]),
      ]);

      const plateCustomerIds = plateCandidates
        .filter((v) => (v.plateNormalized ?? normalizePlate(v.plate)).includes(plateNorm))
        .map((v) => v.customerId);
      const matchedCustomerIds = [
        ...vinMatches.map((v) => v.customerId),
        ...plateCustomerIds,
      ];

      filter.$or = [
        { firstName: rx },
        { lastName: rx },
        { phone: rx },
        { email: rx },
        // Merged-away duplicates: their old name and number still find the
        // survivor (see customers/merge.ts).
        { "aliases.firstName": rx },
        { "aliases.lastName": rx },
        { "aliases.phone": rx },
        { "phoneHistory.phone": rx },
        ...(matchedCustomerIds.length > 0 ? [{ _id: { $in: matchedCustomerIds } }] : []),
      ];
    }

    const [total, rows] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter)
        .sort({ lastName: 1, firstName: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return ok({
      customers: rows.map((c) => ({
        id: String(c._id),
        firstName: c.firstName,
        lastName: c.lastName ?? null,
        phone: c.phone,
        email: c.email ?? null,
        notes: c.notes ?? null,
        smsOptInAt: c.smsOptInAt ?? null,
        smsOptOutAt: c.smsOptOutAt ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      page,
      pageSize,
      total,
    });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
