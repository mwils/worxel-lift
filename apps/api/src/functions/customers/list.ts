import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { Customer } from "@lift/shared";
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

export const handler: APIGatewayProxyHandlerV2 = withAuth(async ({ event, user }) => {
  try {
    if (!user.shopId) return badRequest("No shop on session");
    const { q, page, pageSize } = parseQuery(event, ListQuery);

    const filter: Record<string, unknown> = { shopId: user.shopId };
    if (q && q.trim().length > 0) {
      const rx = new RegExp(escapeRegex(q.trim()), "i");
      filter.$or = [{ firstName: rx }, { lastName: rx }, { phone: rx }, { email: rx }];
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
