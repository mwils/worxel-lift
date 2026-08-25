import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { DateTime } from "luxon";
import { micromark } from "micromark";
import { connectDb } from "@lift/shared/db";
import { BLOG_TIMEZONE, BlogPost, type BlogPostDoc } from "@lift/shared";
import { escapeHtml, htmlShell } from "./template.js";

/**
 * Public blog renderer — mounted on the marketing Router at /blog via a
 * Lambda function URL. Serves the index, post pages, and sitemap straight
 * from Mongo; CloudFront caches per the Cache-Control below, so a scheduled
 * post appears within ~5 minutes of its publish instant and edits/retractions
 * propagate on the same clock. No S3, no invalidations.
 */

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=60, s-maxage=300",
};

/** Visible = published, or scheduled with its time already passed. */
function visibleQuery(now: Date) {
  return {
    $or: [
      { status: "published" as const },
      { status: "scheduled" as const, scheduledFor: { $lte: now } },
    ],
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> => {
  try {
    await connectDb();
    const siteUrl = process.env.MARKETING_URL ?? "https://lift.worxel.com";
    // The Router forwards the original path; tolerate a missing /blog prefix
    // so the raw function URL works for testing.
    const sub = (event.rawPath ?? "/").replace(/^\/blog/, "").replace(/\/+$/, "") || "/";

    if (sub === "/") return index(siteUrl);
    if (sub === "/sitemap.xml") return sitemap(siteUrl);
    if (sub === "/rss.xml") return rss(siteUrl);
    const slug = sub.slice(1);
    if (/^[a-z0-9-]{1,80}$/.test(slug)) return post(siteUrl, slug);
    return notFoundPage(siteUrl);
  } catch (err) {
    console.error("[blogRender] error", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      body: "<!doctype html><title>Error</title><p>Something went wrong. Try again in a minute.</p>",
    };
  }
};

function fmtDate(d: Date): string {
  return DateTime.fromJSDate(new Date(d)).setZone(BLOG_TIMEZONE).toFormat("LLLL d, yyyy");
}

function postDate(p: Pick<BlogPostDoc, "publishedAt" | "scheduledFor">): Date {
  return new Date(p.publishedAt ?? p.scheduledFor);
}

async function index(siteUrl: string): Promise<APIGatewayProxyStructuredResultV2> {
  const posts = await BlogPost.find(visibleQuery(new Date()))
    .select("slug title metaDescription scheduledFor publishedAt")
    .sort({ scheduledFor: -1 })
    .limit(200)
    .lean();

  const items = posts
    .map(
      (p) => `
  <div class="index-item">
    <div class="mono">${escapeHtml(fmtDate(postDate(p)))}</div>
    <h2><a href="${siteUrl}/blog/${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a></h2>
    <div style="font-size:16px">${escapeHtml(p.metaDescription)}</div>
  </div>`
    )
    .join("\n");

  const bodyHtml = `
  <div class="mono">§ The shop notes — for 1–3 bay independents</div>
  <h1>Notes from the counter</h1>
  <p style="color:#605849">Running the business side of a small shop — quotes, texts, money,
  and the stuff nobody taught at trade school. New post every couple of days.</p>
  ${items || `<p>No posts yet — first one's coming soon.</p>`}`;

  return {
    statusCode: 200,
    headers: HTML_HEADERS,
    body: htmlShell({
      // Title carries query intent; the on-page H1 stays the pure name.
      title: "The Shop Notes — advice for independent auto repair shops",
      metaDescription:
        "Practical notes for 1–3 bay independent auto repair shops: quotes, customer texts, getting paid, and the business side of running a small shop.",
      canonicalUrl: `${siteUrl}/blog`,
      ogImageUrl: `${siteUrl}/social/blog-og-1200x630.png`,
      bodyHtml,
      siteUrl,
    }),
  };
}

async function post(siteUrl: string, slug: string): Promise<APIGatewayProxyStructuredResultV2> {
  const p = await BlogPost.findOne({ slug, ...visibleQuery(new Date()) }).lean();
  if (!p) return notFoundPage(siteUrl);

  // micromark escapes raw HTML by default (allowDangerousHtml is off) — that
  // is the XSS boundary for model/admin-authored markdown. Keep it that way.
  const articleHtml = micromark(p.bodyMarkdown);

  const bodyHtml = `
  <article>
    <div class="mono">${escapeHtml(p.bucket.replace(/_/g, " "))}</div>
    <h1>${escapeHtml(p.title)}</h1>
    <div class="byline">By Matthew at Lift · ${escapeHtml(fmtDate(postDate(p)))}</div>
    ${articleHtml}
  </article>`;

  return {
    statusCode: 200,
    headers: HTML_HEADERS,
    body: htmlShell({
      title: p.title,
      metaDescription: p.metaDescription,
      canonicalUrl: `${siteUrl}/blog/${p.slug}`,
      ogImageUrl: `${siteUrl}/social/blog-og-1200x630.png`,
      bodyHtml,
      siteUrl,
      publishedAtIso: postDate(p).toISOString(),
    }),
  };
}

async function sitemap(siteUrl: string): Promise<APIGatewayProxyStructuredResultV2> {
  const posts = await BlogPost.find(visibleQuery(new Date()))
    .select("slug scheduledFor publishedAt updatedAt")
    .sort({ scheduledFor: -1 })
    .limit(1000)
    .lean();

  const newest = posts[0]
    ? new Date((posts[0] as { updatedAt?: Date }).updatedAt ?? postDate(posts[0])).toISOString()
    : undefined;
  const urls = [
    // Core marketing pages — this is the only sitemap robots.txt points at,
    // so it covers the whole site, not just the blog.
    `<url><loc>${siteUrl}/</loc></url>`,
    `<url><loc>${siteUrl}/privacy</loc></url>`,
    `<url><loc>${siteUrl}/terms</loc></url>`,
    `<url><loc>${siteUrl}/blog</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>`,
    ...posts.map(
      (p) =>
        `<url><loc>${siteUrl}/blog/${escapeHtml(p.slug)}</loc><lastmod>${new Date(
          (p as { updatedAt?: Date }).updatedAt ?? postDate(p)
        ).toISOString()}</lastmod></url>`
    ),
  ].join("\n");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=900",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`,
  };
}

async function rss(siteUrl: string): Promise<APIGatewayProxyStructuredResultV2> {
  const posts = await BlogPost.find(visibleQuery(new Date()))
    .select("slug title metaDescription scheduledFor publishedAt")
    .sort({ scheduledFor: -1 })
    .limit(50)
    .lean();

  const items = posts
    .map(
      (p) => `  <item>
    <title>${escapeHtml(p.title)}</title>
    <link>${siteUrl}/blog/${escapeHtml(p.slug)}</link>
    <guid isPermaLink="true">${siteUrl}/blog/${escapeHtml(p.slug)}</guid>
    <description>${escapeHtml(p.metaDescription)}</description>
    <pubDate>${postDate(p).toUTCString()}</pubDate>
  </item>`
    )
    .join("\n");

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=900",
    },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>The Shop Notes — Lift</title>
  <link>${siteUrl}/blog</link>
  <description>Practical notes for 1–3 bay independent auto repair shops.</description>
${items}
</channel></rss>`,
  };
}

function notFoundPage(siteUrl: string): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode: 404,
    headers: { ...HTML_HEADERS, "Cache-Control": "public, max-age=60" },
    body: htmlShell({
      title: "Post not found",
      metaDescription: "That post doesn't exist (or was pulled).",
      canonicalUrl: `${siteUrl}/blog`,
      ogImageUrl: `${siteUrl}/social/blog-og-1200x630.png`,
      bodyHtml: `<h1>Not here</h1><p>That post doesn't exist — it may have been pulled. <a href="${siteUrl}/blog">Back to the shop notes.</a></p>`,
      siteUrl,
    }),
  };
}
