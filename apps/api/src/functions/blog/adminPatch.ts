import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { BlogPost, BlogPostPatchDto } from "@lift/shared";
import { handleKnownErrors, parseBody, withCompanyAuth } from "../../lib/middleware.js";
import { badRequest, conflict, notFound, ok } from "../../lib/response.js";
import { serializeBlogPost } from "./serialize.js";

export const handler: APIGatewayProxyHandlerV2 = withCompanyAuth(async ({ event, user }) => {
  try {
    const id = event.pathParameters?.id;
    if (!id) return badRequest("Missing post id");

    const dto = await parseBody(event, BlogPostPatchDto);

    const post = await BlogPost.findById(id);
    if (!post) return notFound("Post not found");
    if (post.status === "rejected") {
      return badRequest("Post is rejected — rejected posts can't be edited.");
    }

    if (dto.slug && dto.slug !== post.slug) {
      const taken = await BlogPost.exists({ slug: dto.slug, _id: { $ne: post._id } });
      if (taken) return conflict(`Slug "${dto.slug}" is already used by another post.`);
      post.slug = dto.slug;
    }
    if (dto.title !== undefined) post.title = dto.title;
    if (dto.metaDescription !== undefined) post.metaDescription = dto.metaDescription;
    if (dto.bodyMarkdown !== undefined) post.bodyMarkdown = dto.bodyMarkdown;
    if (dto.scheduledFor !== undefined) {
      const when = new Date(dto.scheduledFor);
      if (post.status === "scheduled" && when.getTime() < Date.now() - 60_000) {
        return badRequest("Scheduled time is in the past — pick a future time.");
      }
      post.scheduledFor = when;
    }
    post.editedAt = new Date();
    post.editedBy = user.email;
    await post.save();

    return ok({ post: serializeBlogPost(post.toObject()) });
  } catch (err) {
    const known = handleKnownErrors(err);
    if (known) return known;
    throw err;
  }
});
