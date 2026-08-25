/**
 * Post-build pre-render: render the SPA's static routes to real HTML so
 * crawlers (and LLM agents) see content without executing JavaScript.
 *
 * Uses Vite's SSR build of src/entry-server.tsx (renderToString) — no
 * headless browser involved, so it's deterministic and CI-safe. "/" rewrites
 * index.html in place; "/privacy" and "/terms" become privacy/index.html and
 * terms/index.html, which the SST Router serves natively (extensionless paths
 * resolve to <path>/index.html when the file exists). The React bundle still
 * loads and renders over the markup, so behavior is unchanged for humans.
 *
 * Head tags are route-specific here because useCanonical/useNoindex are
 * effects and don't run during renderToString. Dynamic routes (/book/:slug,
 * /booking/:token) keep the SPA fallback and mark themselves noindex at
 * runtime (src/seo.ts).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const ssrDir = join(root, "dist-ssr");

const ROUTES = [
  { path: "/", out: "index.html", head: null },
  {
    path: "/privacy",
    out: "privacy/index.html",
    head: {
      title: "Privacy Policy & Terms — Lift",
      canonical: "https://lift.worxel.com/privacy",
      description:
        "Lift's privacy policy and terms of service, including SMS consent, STOP/HELP, and data-sharing disclosures.",
    },
  },
  {
    path: "/terms",
    out: "terms/index.html",
    head: {
      title: "Privacy Policy & Terms — Lift",
      canonical: "https://lift.worxel.com/terms",
      description:
        "Lift's terms of service and privacy policy, including SMS consent, STOP/HELP, and data-sharing disclosures.",
    },
  },
];

// 1. SSR-build the entry (CJS-free ESM output importable from node).
execFileSync(
  "npx",
  ["vite", "build", "--ssr", "src/entry-server.tsx", "--outDir", "dist-ssr", "--emptyOutDir"],
  { cwd: root, stdio: ["ignore", "ignore", "inherit"] }
);
const { render } = await import(join(ssrDir, "entry-server.js"));

// 2. Inject each route's markup (and per-route head) into the built template.
const template = readFileSync(join(dist, "index.html"), "utf8");
if (!template.includes('<div id="root"></div>')) {
  console.error("[prerender] template missing empty #root — refusing to continue");
  process.exit(1);
}

let failed = false;
for (const route of ROUTES) {
  try {
    const markup = render(route.path);
    if (markup.length < 500) throw new Error(`rendered markup suspiciously small (${markup.length} chars)`);
    let html = template.replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
    if (route.head) {
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${route.head.title}</title>`)
        .replace(
          /<link rel="canonical" href="[^"]*" \/>/,
          `<link rel="canonical" href="${route.head.canonical}" />`
        )
        .replace(
          /(<meta\s+name="description"\s+content=")[^"]*(")/,
          `$1${route.head.description}$2`
        )
        .replace(
          /<meta property="og:url" content="[^"]*" \/>/,
          `<meta property="og:url" content="${route.head.canonical}" />`
        );
    }
    const out = join(dist, route.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, html);
    console.log(`[prerender] ${route.path} → ${route.out} (${(html.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    failed = true;
    console.error(`[prerender] FAILED ${route.path}:`, err.message);
  }
}

rmSync(ssrDir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
