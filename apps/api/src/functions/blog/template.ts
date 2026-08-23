/**
 * Server-rendered HTML shell for the public blog — Service Manual aesthetic
 * (matches apps/marketing: newsprint cream, warm ink, Snap-On red, Archivo
 * Black / Spectral / Space Mono). Kept dependency-free: one function, inline CSS.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ShellArgs {
  /** <title> content — page-specific, suffix added here. */
  title: string;
  metaDescription: string;
  /** Absolute canonical URL for this page. */
  canonicalUrl: string;
  /** Absolute og:image URL. */
  ogImageUrl: string;
  /** Pre-escaped/safe HTML body content (rendered markdown or built markup). */
  bodyHtml: string;
  /** Marketing site base URL for header/footer links. */
  siteUrl: string;
  /** Set for post pages — enables article og:type + published meta. */
  publishedAtIso?: string;
}

export function htmlShell(a: ShellArgs): string {
  const title = escapeHtml(a.title);
  const desc = escapeHtml(a.metaDescription);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Lift</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${escapeHtml(a.canonicalUrl)}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="${a.publishedAtIso ? "article" : "website"}">
<meta property="og:url" content="${escapeHtml(a.canonicalUrl)}">
<meta property="og:image" content="${escapeHtml(a.ogImageUrl)}">
${a.publishedAtIso ? `<meta property="article:published_time" content="${escapeHtml(a.publishedAtIso)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Spectral:ital,wght@0,400;0,600;1,400&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --paper:#f4eedf; --ink:#1a1714; --soft:#605849; --hair:#8c8270; --red:#c8261d; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
    font-family:Spectral, Georgia, "Times New Roman", serif; font-size:18px; line-height:1.6; }
  .wrap { max-width:720px; margin:0 auto; padding:28px 20px 64px; }
  .masthead { display:flex; justify-content:space-between; align-items:baseline;
    border-bottom:2px solid var(--ink); padding-bottom:14px; margin-bottom:28px; }
  .wordmark { font-family:"Archivo Black","Arial Black","Helvetica Neue",sans-serif;
    font-size:24px; letter-spacing:-0.02em; color:var(--ink); text-decoration:none; text-transform:uppercase; }
  .mono { font-family:"Space Mono","Courier New",monospace; text-transform:uppercase;
    letter-spacing:0.15em; font-size:11px; color:var(--soft); }
  h1 { font-family:"Archivo Black","Arial Black","Helvetica Neue",sans-serif;
    font-size:34px; line-height:1.1; letter-spacing:-0.02em; text-transform:uppercase; margin:8px 0 10px; }
  h2 { font-family:"Archivo Black","Arial Black","Helvetica Neue",sans-serif;
    font-size:21px; line-height:1.2; letter-spacing:-0.01em; margin:36px 0 8px; }
  a { color:var(--red); }
  .byline { font-family:"Space Mono","Courier New",monospace; font-size:12px;
    letter-spacing:0.12em; text-transform:uppercase; color:var(--soft); margin-bottom:28px; }
  blockquote { border-left:3px solid var(--red); margin:20px 0; padding:8px 16px;
    background:#ecdfca; font-style:italic; }
  code { font-family:"Space Mono","Courier New",monospace; font-size:0.85em; background:#ecdfca; padding:1px 5px; }
  pre { background:#ecdfca; padding:14px; overflow-x:auto; }
  img { max-width:100%; }
  .index-item { border-bottom:1px solid var(--hair); padding:22px 0; }
  .index-item h2 { margin:4px 0 8px; }
  .index-item a { color:var(--ink); text-decoration:none; }
  .index-item a:hover { color:var(--red); }
  .cta { margin-top:48px; border:2px solid var(--ink); padding:20px;
    box-shadow:5px 5px 0 var(--ink); background:var(--paper); }
  .cta .head { font-family:"Archivo Black","Arial Black","Helvetica Neue",sans-serif;
    font-size:18px; text-transform:uppercase; letter-spacing:-0.01em; margin-bottom:6px; }
  .cta a.btn { display:inline-block; margin-top:10px; background:var(--red); color:var(--paper);
    font-family:"Space Mono","Courier New",monospace; font-size:12px; letter-spacing:0.15em;
    text-transform:uppercase; text-decoration:none; padding:10px 18px; }
  footer { margin-top:56px; border-top:1px solid var(--hair); padding-top:16px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="masthead">
    <a class="wordmark" href="${escapeHtml(a.siteUrl)}">Lift</a>
    <a class="mono" href="${escapeHtml(a.siteUrl)}/blog" style="text-decoration:none">The shop notes</a>
  </div>
  ${a.bodyHtml}
  <div class="cta">
    <div class="head">Run the whole shop from your phone. You talk, it types.</div>
    <div style="font-size:16px">Lift is the shop app for 1–3 bay independents. Dead-simple ROs,
    invoices, and customer status checks — $79/mo flat, 14-day free trial, no card.</div>
    <a class="btn" href="${escapeHtml(a.siteUrl)}?utm_source=blog&amp;utm_medium=organic&amp;utm_campaign=blog-cta">See how Lift works</a>
  </div>
  <footer class="mono">© Worxel · <a href="${escapeHtml(a.siteUrl)}/privacy">Privacy</a> · <a href="${escapeHtml(a.siteUrl)}/terms">Terms</a></footer>
</div>
</body>
</html>`;
}
