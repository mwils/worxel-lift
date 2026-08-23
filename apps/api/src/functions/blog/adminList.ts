import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { BlogAdminListQueryDto, BlogPost } from "@lift/shared";
import { handleKnownErrors, parseQuery, withCompanyAuth } from "../../lib/middleware.js";
import { ok } from "../../lib/response.js";
import { serializeBlogPost } from "./serialize.js";

export const handler: APIGatewayProxyHandlerV2 = withCompanyAuth(async ({ event }) => {
  try {
    const q = parseQuery(event, BlogAdminListQueryDto);
    const now = new Date();

    let filter: Record<string, unknown>;
    let sort: Record<string, 1 | -1>;
    if (q.status === "queue") {
      filter = { status: "scheduled", scheduledFor: { $gt: now } };
      sort = { scheduledFor: 1 };
    } else if (q.status === "published") {
      // Matches the public renderer's visibility: flipped posts plus
      // scheduled posts whose time has passed (flip is a daily bookkeeping job).
      filter = {
        $or: [{ status: "published" }, { status: "scheduled", scheduledFor: { $lte: now } }],
      };
      sort = { scheduledFor: -1 };
    } else {
      filter = { status: "rejected" };
      sort = { rejectedAt: -1 };
    }

    const posts = await BlogPost.find(filter).sort(sort).limit(100).lean();
    return ok({ posts: posts.map(serializeBlogPost) });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
