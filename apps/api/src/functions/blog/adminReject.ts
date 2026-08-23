import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { BlogPost, BlogPostRejectDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withCompanyAuth } from "../../lib/middleware.js";
import { badRequest, notFound, ok } from "../../lib/response.js";
import { serializeBlogPost } from "./serialize.js";

/**
 * Reject a queued post (or retract a published one — it 404s publicly within
 * the CloudFront cache TTL). The freed schedule slot is backfilled by the next
 * generation run with a draft on the next topic; the rejected topicKey stays
 * consumed.
 */
export const handler: APIGatewayProxyHandlerV2 = withCompanyAuth(async ({ event, user }) => {
  try {
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing post id");
    const dto = event.body ? await parseBody(event, BlogPostRejectDto) : {};

    const post = await BlogPost.findById(id);
    if (!post) return notFound("Post not found");
    if (post.status === "rejected") return badRequest("Post is already rejected.");

    post.status = "rejected";
    post.rejectedAt = new Date();
    post.rejectedBy = user.email;
    post.rejectionReason = dto.reason ?? undefined;
    await post.save();

    return ok({ post: serializeBlogPost(post.toObject()) });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
