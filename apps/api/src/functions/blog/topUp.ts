import { DateTime } from "luxon";
import {
  AiInteraction,
  BLOG_BUCKET_ROTATION,
  BLOG_CADENCE_DAYS,
  BLOG_PUBLISH_HOUR_LOCAL,
  BLOG_QUEUE_TARGET,
  BLOG_TIMEZONE,
  BLOG_TOPICS,
  BlogPost,
  type BlogTopic,
} from "@lift/shared";
import { BLOG_POST_PROMPT_VERSION, buildBlogPostPrompt } from "@lift/shared/prompts";
import { invokeModel, modelBlog } from "../../lib/bedrock.js";

/** Long-form Bedrock calls are slow — cap per run; the daily cron catches up. */
const PER_RUN_LIMIT = 3;

export interface TopUpResult {
  flippedPublished: number;
  queueBefore: number;
  generated: number;
  failed: number;
  skipped?: string;
}

/**
 * Keep the forward queue at BLOG_QUEUE_TARGET scheduled posts, each slotted
 * every BLOG_CADENCE_DAYS at 7:00 AM Central. Called by the daily cron and by
 * the admin's manual "generate" action (`force` bypasses the enable flag).
 *
 * Publishing is NOT done here — the renderer shows any scheduled post whose
 * time has passed. The scheduled→published flip below is bookkeeping so the
 * admin queue view stays truthful.
 */
export async function topUpBlogQueue(
  opts: { force?: boolean; limit?: number } = {}
): Promise<TopUpResult> {
  const now = new Date();

  const flip = await BlogPost.updateMany(
    { status: "scheduled", scheduledFor: { $lte: now } },
    [{ $set: { status: "published", publishedAt: "$scheduledFor" } }]
  );

  const queueBefore = await BlogPost.countDocuments({
    status: "scheduled",
    scheduledFor: { $gt: now },
  });

  const result: TopUpResult = {
    flippedPublished: flip.modifiedCount ?? 0,
    queueBefore,
    generated: 0,
    failed: 0,
  };

  if (!opts.force && process.env.BLOG_GENERATION_ENABLED !== "1") {
    result.skipped = "generation_disabled";
    return result;
  }

  const needed = Math.min(BLOG_QUEUE_TARGET - queueBefore, opts.limit ?? PER_RUN_LIMIT);
  if (needed <= 0) return result;

  // ── topic + slot state ────────────────────────────────────────
  const existing = await BlogPost.find({})
    .select("topicKey bucket status scheduledFor title")
    .lean();

  const usedTopicKeys = new Set(existing.map((p) => p.topicKey));
  const claimedDates = new Set(
    existing.filter((p) => p.status !== "rejected").map((p) => dateKey(p.scheduledFor))
  );
  // Recent titles for the prompt's "don't retread" list.
  const recentTitles = existing
    .filter((p) => p.status !== "rejected")
    .sort((a, b) => +new Date(b.scheduledFor) - +new Date(a.scheduledFor))
    .slice(0, 10)
    .map((p) => p.title);

  // Bucket rotation position advances with every non-rejected post ever made.
  let rotationIndex = existing.filter((p) => p.status !== "rejected").length;

  // Slot chain anchor: earliest non-rejected scheduledFor keeps the cadence
  // aligned; a rejected post's freed date is simply the earliest unclaimed
  // link in the chain, so its replacement backfills it.
  const nonRejected = existing.filter((p) => p.status !== "rejected");
  const anchor =
    nonRejected.length > 0
      ? DateTime.fromJSDate(
          new Date(Math.min(...nonRejected.map((p) => +new Date(p.scheduledFor))))
        ).setZone(BLOG_TIMEZONE)
      : DateTime.now().setZone(BLOG_TIMEZONE).plus({ days: 1 });

  const tomorrow = DateTime.now().setZone(BLOG_TIMEZONE).plus({ days: 1 }).startOf("day");

  for (let i = 0; i < needed; i++) {
    const topic = pickNextTopic(usedTopicKeys, rotationIndex);
    if (!topic) {
      console.warn("[blogTopUp] topic bank exhausted — add topics to blogTopics.ts");
      break;
    }
    const slot = nextSlot(anchor, tomorrow, claimedDates);

    try {
      const draft = await generateDraft(topic, recentTitles);
      const slug = await uniqueSlug(draft.title);
      await BlogPost.create({
        slug,
        title: draft.title,
        metaDescription: draft.metaDescription,
        topicKey: topic.key,
        bucket: topic.bucket,
        bodyMarkdown: draft.bodyMarkdown,
        status: "scheduled",
        scheduledFor: slot.toJSDate(),
        model: draft.model,
        promptVersion: BLOG_POST_PROMPT_VERSION,
        generation: {
          inputTokens: draft.inputTokens,
          outputTokens: draft.outputTokens,
          durationMs: draft.durationMs,
          attempt: 1,
        },
      });
      usedTopicKeys.add(topic.key);
      claimedDates.add(dateKey(slot.toJSDate()));
      recentTitles.unshift(draft.title);
      rotationIndex++;
      result.generated++;
    } catch (err) {
      // Topic stays unused and the slot unclaimed — retried next run.
      result.failed++;
      console.error("[blogTopUp] draft failed", {
        topicKey: topic.key,
        error: (err as Error).message,
      });
    }
  }

  console.log("[blogTopUp] done", result);
  return result;
}

// ── topic rotation ────────────────────────────────────────────────
function pickNextTopic(usedKeys: Set<string>, rotationIndex: number): BlogTopic | null {
  // Try the rotation bucket for this position, then walk forward through the
  // rotation until some bucket still has an unused topic.
  for (let step = 0; step < BLOG_BUCKET_ROTATION.length; step++) {
    const bucket = BLOG_BUCKET_ROTATION[(rotationIndex + step) % BLOG_BUCKET_ROTATION.length];
    const topic = BLOG_TOPICS.find((t) => t.bucket === bucket && !usedKeys.has(t.key));
    if (topic) return topic;
  }
  // Rotation buckets dry — take anything left (covers a lopsided bank).
  return BLOG_TOPICS.find((t) => !usedKeys.has(t.key)) ?? null;
}

// ── slot chain ────────────────────────────────────────────────────
function dateKey(d: Date): string {
  return DateTime.fromJSDate(new Date(d)).setZone(BLOG_TIMEZONE).toISODate() ?? "";
}

/**
 * Next unclaimed every-other-day slot at 7:00 AM Central, never before
 * tomorrow. Walking the chain from the anchor keeps cadence aligned even when
 * a rejection frees a mid-chain date.
 */
function nextSlot(anchor: DateTime, tomorrow: DateTime, claimed: Set<string>): DateTime {
  for (let k = 0; k < 1000; k++) {
    const day = anchor.startOf("day").plus({ days: k * BLOG_CADENCE_DAYS });
    if (day < tomorrow) continue;
    const key = day.toISODate() ?? "";
    if (claimed.has(key)) continue;
    return day.set({ hour: BLOG_PUBLISH_HOUR_LOCAL, minute: 0, second: 0, millisecond: 0 });
  }
  throw new Error("no free blog slot found within 1000 steps");
}

// ── draft generation ──────────────────────────────────────────────
interface Draft {
  title: string;
  metaDescription: string;
  bodyMarkdown: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  durationMs: number;
}

async function generateDraft(topic: BlogTopic, recentTitles: string[]): Promise<Draft> {
  const model = modelBlog();
  const start = Date.now();

  // Free iteration path — no Bedrock spend while wiring up the pipeline.
  if (process.env.BLOG_MOCK_GENERATION === "1") {
    return {
      title: topic.title,
      metaDescription: `[MOCK DRAFT] ${topic.angle.slice(0, 130)}`,
      bodyMarkdown: `> **Mock draft** — generated with BLOG_MOCK_GENERATION=1, no model call.\n\n## The problem\n\n${topic.angle}\n\n## What to do about it\n\nReplace this with a real draft before publishing.`,
      model: "mock",
      durationMs: Date.now() - start,
    };
  }

  const prompt = buildBlogPostPrompt({
    title: topic.title,
    bucket: topic.bucket,
    angle: topic.angle,
    existingTitles: recentTitles,
  });

  let invokeError: string | undefined;
  try {
    const res = await invokeModel({
      modelId: model,
      prompt,
      maxTokens: 3000,
      temperature: 0.7,
    });
    const parsed = parseDraftEnvelope(res.text);
    await AiInteraction.create({
      kind: "blog_draft",
      model,
      promptVersion: BLOG_POST_PROMPT_VERSION,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      durationMs: Date.now() - start,
    });
    return {
      ...parsed,
      model,
      inputTokens: res.inputTokens,
      outputTokens: res.outputTokens,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    invokeError = (err as Error).message;
    await AiInteraction.create({
      kind: "blog_draft",
      model,
      promptVersion: BLOG_POST_PROMPT_VERSION,
      durationMs: Date.now() - start,
      error: invokeError,
    }).catch(() => undefined);
    throw err;
  }
}

/** Defensive parse of the JSON envelope — strip fences, take first {...} block. */
function parseDraftEnvelope(text: string): Pick<Draft, "title" | "metaDescription" | "bodyMarkdown"> {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("model returned no JSON object");
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const metaDescription =
    typeof obj.metaDescription === "string" ? obj.metaDescription.trim().slice(0, 155) : "";
  const bodyMarkdown = typeof obj.bodyMarkdown === "string" ? obj.bodyMarkdown.trim() : "";
  if (!title || !metaDescription || bodyMarkdown.length < 200) {
    throw new Error("model JSON missing/short title, metaDescription, or bodyMarkdown");
  }
  return { title, metaDescription, bodyMarkdown };
}

// ── slug ──────────────────────────────────────────────────────────
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "post"
  );
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  let candidate = base;
  for (let n = 2; n < 50; n++) {
    const exists = await BlogPost.exists({ slug: candidate });
    if (!exists) return candidate;
    candidate = `${base}-${n}`;
  }
  throw new Error(`could not find a free slug for "${base}"`);
}
