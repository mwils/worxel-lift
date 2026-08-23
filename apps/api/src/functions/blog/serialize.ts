import type { BlogPostDoc } from "@lift/shared";

/** Admin-facing DTO shape for a blog post (full body included — the queue is small). */
export function serializeBlogPost(p: BlogPostDoc & { updatedAt?: Date; createdAt?: Date }) {
  return {
    id: String(p._id),
    slug: p.slug,
    title: p.title,
    metaDescription: p.metaDescription,
    topicKey: p.topicKey,
    bucket: p.bucket,
    bodyMarkdown: p.bodyMarkdown,
    status: p.status,
    scheduledFor: p.scheduledFor ? new Date(p.scheduledFor).toISOString() : null,
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    model: p.model ?? null,
    promptVersion: p.promptVersion ?? null,
    editedAt: p.editedAt ? new Date(p.editedAt).toISOString() : null,
    editedBy: p.editedBy ?? null,
    rejectedAt: p.rejectedAt ? new Date(p.rejectedAt).toISOString() : null,
    rejectedBy: p.rejectedBy ?? null,
    rejectionReason: p.rejectionReason ?? null,
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
  };
}
