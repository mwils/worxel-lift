import { Box, Container, Group, Stack, Text, Title, Anchor } from "@mantine/core";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const APP_URL = import.meta.env.VITE_WEB_APP_URL ?? "https://lift-app.worxel.com";
const CTA_BASE = `${APP_URL}/login`;
const inboundPid = (): string | null => {
  if (typeof window === "undefined") return null;
  const pid = new URLSearchParams(window.location.search).get("pid");
  return pid && /^[a-fA-F0-9]{24}$/.test(pid) ? pid : null;
};
/**
 * Attribution for the app-signup CTAs. If the visitor arrived with utm_*
 * params (cold-email, blog, ads, the printed brochure), pass them through
 * untouched so the signup is credited to the campaign that brought them.
 * Otherwise it's organic traffic to lift.worxel.com — never default to a
 * campaign. `utm_content` is always the CTA position so we can see which
 * button converts.
 *
 * `window` is undefined during pre-render, so the static HTML carries the
 * organic default; the client render (createRoot) recomputes from the URL.
 */
const ctaHref = (position: string) => {
  const params = new URLSearchParams();
  const inbound =
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  let hasUtm = false;
  if (inbound) {
    for (const [k, v] of inbound) {
      if (k.startsWith("utm_") && k !== "utm_content" && v) {
        params.set(k, v);
        hasUtm = true;
      }
    }
  }
  if (!hasUtm) {
    params.set("utm_source", "lift.worxel.com");
    params.set("utm_medium", "organic");
  }
  params.set("utm_content", position);
  const pid = inboundPid();
  if (pid) params.set("pid", pid);
  return `${CTA_BASE}?${params.toString()}`;
};

/** GA4 event, if gtag.js loaded (index.html). No-op during pre-render and when blocked. */
const track = (name: string, params?: Record<string, string>) => {
  if (typeof window === "undefined") return;
  const g = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof g === "function") g("event", name, params ?? {});
};

/** One label everywhere. The brief forbids rotating CTA copy. */
const CTA_LABEL = "Try it on one RO →";

const COLORS = {
  paper: "#f4eedf",
  paperShade: "#ecdfca",
  ink: "#1a1714",
  inkSoft: "#605849",
  inkFaint: "#8c8270",
  red: "#c8261d",
  redDeep: "#8b1612",
  blue: "#1e3a6b",
  rule: "#1a1714",
};

const FONT = {
  display: '"Archivo Black", "Helvetica Neue", Helvetica, Arial, sans-serif',
  serif: 'Spectral, "Iowan Old Style", Georgia, "Times New Roman", serif',
  mono: '"Space Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
};

const ISSUE_DATE = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
}).toUpperCase();

export function Landing() {
  return (
    <Box className="lift-page" style={{ background: COLORS.paper, color: COLORS.ink, fontFamily: FONT.serif, position: "relative", overflow: "hidden", width: "100%", maxWidth: "100vw" }}>
      <ScopedStyles />
      <HalftoneBackdrop />

      <Masthead />
      <Hairline />
      <NavBar />
      <Hairline thick />

      <Hero />

      <Hairline />
      <SectionStatement />

      <Hairline />
      <SectionWorkflow />

      <Hairline />
      <SectionPricing />

      <Hairline />
      <SectionFeatures />

      <Hairline />
      <SectionFit />

      <Hairline />
      <SectionFounder />

      <Hairline />
      <SectionFAQ />

      <Hairline />
      <FinalCTA />

      <Colophon />
      <StickyCta />
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Page chrome                                                         */
/* ------------------------------------------------------------------ */

function ScopedStyles() {
  return (
    <style>{`
      @keyframes slide-in-rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }

      .lift-rule { transform-origin: left center; animation: slide-in-rule 0.9s cubic-bezier(0.4, 0, 0.2, 1) both; }

      .lift-link { color: ${COLORS.ink}; text-decoration: none; font-family: ${FONT.mono}; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; padding: 12px 0; border-bottom: 1px solid transparent; transition: border-color 120ms ease; display: inline-block; }
      .lift-link:hover { border-bottom-color: ${COLORS.ink}; }

      .lift-cta { background: ${COLORS.red}; color: ${COLORS.paper}; font-family: ${FONT.mono}; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; font-size: 12px; padding: 16px 28px; border: 1px solid ${COLORS.ink}; box-shadow: 4px 4px 0 ${COLORS.ink}; text-decoration: none; display: inline-block; transition: transform 100ms ease, box-shadow 100ms ease; cursor: pointer; min-height: 44px; text-align: center; }
      .lift-cta:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 ${COLORS.ink}; }
      .lift-cta:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 ${COLORS.ink}; }
      .lift-cta-small { padding: 12px 18px; font-size: 11px; }

      .lift-faq-item { border-bottom: 1px solid ${COLORS.ink}; }
      .lift-faq-item:first-child { border-top: 1px solid ${COLORS.ink}; }
      .lift-faq-item summary { list-style: none; padding: 16px 0; cursor: pointer; display: flex; align-items: baseline; justify-content: space-between; gap: 24px; min-height: 44px; }
      .lift-faq-item summary::-webkit-details-marker { display: none; }
      .lift-faq-item summary .q { font-family: ${FONT.serif}; font-weight: 600; font-size: 1.2rem; color: ${COLORS.ink}; }
      .lift-faq-item summary .marker { font-family: ${FONT.mono}; font-size: 12px; color: ${COLORS.red}; flex-shrink: 0; }
      .lift-faq-item[open] summary .marker { color: ${COLORS.ink}; }
      .lift-faq-item .a { padding: 0 0 18px 0; font-family: ${FONT.serif}; font-size: 1.05rem; line-height: 1.55; color: ${COLORS.inkSoft}; max-width: 60ch; }

      :where(.lift-page *) { box-sizing: border-box; }
      .lift-page h1, .lift-page h2, .lift-page h3, .lift-page p { overflow-wrap: break-word; word-break: normal; }

      .lift-grid-2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 40px; }
      .lift-grid-2 > * { min-width: 0; max-width: 100%; }
      .lift-grid-hero { grid-template-columns: minmax(0, 1fr); }
      .lift-grid-2-top { display: grid; grid-template-columns: minmax(0, 1fr); gap: 40px; }
      .lift-grid-3 { display: grid; grid-template-columns: minmax(0, 1fr); border: 1px solid ${COLORS.ink}; background: ${COLORS.paper}; }
      .lift-grid-3 > * + * { border-top: 1px solid ${COLORS.ink}; }
      @media (min-width: 768px) {
        /* ~55/45 copy-to-visual split per the brief. */
        .lift-grid-hero { grid-template-columns: minmax(0, 1.22fr) minmax(0, 1fr); align-items: center; }
        .lift-grid-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; }
        .lift-grid-2-top { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: flex-start; }
        .lift-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .lift-grid-3 > * + * { border-top: 0; border-left: 1px solid ${COLORS.ink}; }
      }
      .lift-secondary { color: ${COLORS.ink}; font-size: 1rem; text-underline-offset: 4px; padding: 12px 0; display: inline-block; }
      .lift-page a:focus-visible, .lift-faq-item summary:focus-visible { outline: 3px solid ${COLORS.blue}; outline-offset: 5px; }
      .lift-page [id] { scroll-margin-top: 24px; }
      @media (prefers-reduced-motion: reduce) {
        .lift-page *, .lift-page *::before, .lift-page *::after { animation: none !important; transition: none !important; }
      }
      .lift-masthead { display: flex; flex-wrap: wrap; gap: 8px 24px; justify-content: space-between; }

      /* Headline scale: clamp() keeps the three-line hero inside its column at
         every width instead of forcing desktop breaks onto phones. */
      .lift-hero-headline { font-size: clamp(2.1rem, 3.7vw, 3rem) !important; line-height: 0.98 !important; max-width: 100%; text-wrap: balance; }
      .lift-h2 { font-size: clamp(1.7rem, 3.6vw, 3rem) !important; line-height: 1.02 !important; max-width: 100%; text-wrap: balance; }
      .lift-final-h2 { font-size: clamp(2.4rem, 6vw, 4.5rem) !important; line-height: 0.95 !important; max-width: 100%; text-wrap: balance; }
      .lift-price { font-size: clamp(3rem, 6vw, 4.5rem) !important; line-height: 1 !important; }

      .lift-board-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 14px; align-items: center; padding: 11px 0; border-top: 1px dashed ${COLORS.inkFaint}; }
      .lift-board-row:first-of-type { border-top: 0; }

      .lift-sticky { display: none; }
      @media (max-width: 767px) {
        .lift-cta-primary { display: block; width: 100%; }
        .lift-sticky[data-show="true"] { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; padding: 10px 16px calc(10px + env(safe-area-inset-bottom)); background: ${COLORS.ink}; border-top: 2px solid ${COLORS.red}; }
        .lift-sticky a { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 44px; color: ${COLORS.paper}; text-decoration: none; font-family: ${FONT.mono}; font-weight: 700; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; }
        .lift-sticky a .price { color: ${COLORS.paperShade}; font-weight: 400; }
        .lift-sticky a:focus-visible { outline: 3px solid ${COLORS.paper}; outline-offset: -4px; }
        /* Room for the sticky bar so the last FAQ control never sits under it. */
        .lift-page[data-sticky="true"] .lift-faq-pad { padding-bottom: 72px; }
      }
      @media (max-width: 640px) {
        .lift-masthead-mid, .lift-masthead-date { display: none !important; }
        .lift-cta { padding: 14px 18px; font-size: 11px; }
      }
    `}</style>
  );
}

function HalftoneBackdrop() {
  return (
    <svg
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.18,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <defs>
        <pattern id="halftone" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.55" fill={COLORS.ink} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#halftone)" />
    </svg>
  );
}

function Masthead() {
  return (
    <Container size="lg" px="md" py={10} style={{ position: "relative", zIndex: 1 }}>
      <Box className="lift-masthead">
        <MonoLabel>The Lift Manual · Vol. 1, No. 2</MonoLabel>
        <MonoLabel className="lift-masthead-mid" visibleSmUp>Simple shop management · 1–3 bay shops</MonoLabel>
        <MonoLabel className="lift-masthead-date">{ISSUE_DATE}</MonoLabel>
      </Box>
    </Container>
  );
}

function NavBar() {
  return (
    <Container size="lg" px="md" py="sm" style={{ position: "relative", zIndex: 1 }}>
      <Group justify="space-between" wrap="nowrap" gap="md">
        {/* Wordmark, not a heading — keeps the page's heading order starting at the H1. */}
        <Anchor href="/" underline="never" aria-label="Lift home" style={{ color: COLORS.ink, lineHeight: 1, display: "inline-block", padding: "8px 0" }}>
          <Text component="span" style={{ fontFamily: FONT.display, fontSize: "1.75rem", letterSpacing: "-0.02em", textTransform: "uppercase", color: COLORS.ink, lineHeight: 1 }}>
            Lift
          </Text>
        </Anchor>
        <Group gap={28} visibleFrom="sm">
          <a href="#workflow" className="lift-link">How it works</a>
          <a href="#features" className="lift-link">Features</a>
          <a href="#pricing" className="lift-link">Pricing</a>
          <a href="#faq" className="lift-link">FAQ</a>
          <a href={CTA_BASE} className="lift-link">Sign in</a>
        </Group>
        <Group gap="md" wrap="nowrap">
          {/* Mobile: logo · Sign in · primary CTA. Secondary nav lives in the footer. */}
          <Box hiddenFrom="sm">
            <a href={CTA_BASE} className="lift-link">Sign in</a>
          </Box>
          <a href={ctaHref("nav")} className="lift-cta lift-cta-small" onClick={() => track("nav_cta_click", { cta_position: "nav" })}>
            {CTA_LABEL}
          </a>
        </Group>
      </Group>
    </Container>
  );
}

function Hairline({ thick }: { thick?: boolean } = {}) {
  return (
    <Box style={{ position: "relative", zIndex: 1 }}>
      <Box
        className="lift-rule"
        style={{
          height: thick ? 3 : 1,
          background: COLORS.rule,
          width: "100%",
        }}
      />
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <Container size="lg" px="md" py={{ base: 28, md: 48 }} style={{ position: "relative", zIndex: 1, overflow: "hidden" }}>
      <Box className="lift-grid-2 lift-grid-hero">
        <Box style={{ minWidth: 0, overflowWrap: "break-word" }}>
          <Stack gap="lg">
            <SectionLabel num="00" title="For 1–3 bay independent shops" />
            <Title
              order={1}
              className="lift-hero-headline"
              style={{
                fontFamily: FONT.display,
                letterSpacing: "-0.02em",
                textTransform: "uppercase",
                color: COLORS.ink,
                margin: 0,
              }}
            >
              Simple shop management for people who still <span style={{ color: COLORS.red }}>turn wrenches</span>.
            </Title>

            <Text
              style={{
                fontFamily: FONT.serif,
                fontSize: "1.3rem",
                lineHeight: 1.45,
                color: COLORS.ink,
                maxWidth: 560,
              }}
            >
              Repair orders, estimates, approvals, job tracking, invoices, and payments—all in one straightforward app that works from your phone.
            </Text>

            <Stack gap="sm">
              <Group gap="lg">
                <a id="hero-cta" href={ctaHref("hero")} className="lift-cta lift-cta-primary" onClick={() => track("hero_cta_click", { cta_position: "hero" })}>
                  {CTA_LABEL}
                </a>
                <a href="#workflow" className="lift-secondary" onClick={() => track("see_how_it_works_click", { cta_position: "hero" })}>
                  See how Lift works ↓
                </a>
              </Group>
              <Text size="sm" style={{ color: COLORS.inkSoft, fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                14 days free · No credit card · $79/month flat
              </Text>
            </Stack>
          </Stack>
        </Box>

        <Box style={{ minWidth: 0, maxWidth: "100%" }}>
          <JobBoardDemo />
        </Box>
      </Box>
    </Container>
  );
}

/**
 * The hero visual: today's board. Five jobs in recognizable states so a
 * first-time visitor reads "this manages my day's work" — not "this texts my
 * customers." Illustrative data; the layout mirrors the app's board.
 */
function JobBoardDemo() {
  const jobs: { name: string; vehicle: string; job: string; total: string; status: string; tone: "outline-red" | "outline" | "blue" | "red" | "ink" }[] = [
    { name: "Jess Ramirez", vehicle: "2016 Honda CR-V", job: "Front brakes", total: "$612.40", status: "Awaiting approval", tone: "outline-red" },
    { name: "Tom Okafor", vehicle: "2012 Ford F-150", job: "Oil + rotation", total: "$118.75", status: "Scheduled · 2:30", tone: "outline" },
    { name: "Dana Whitfield", vehicle: "2019 Subaru Outback", job: "Alternator", total: "$784.10", status: "In repair", tone: "blue" },
    { name: "Luis Herrera", vehicle: "2008 Chevy Silverado", job: "Water pump", total: "$933.22", status: "Ready for pickup", tone: "red" },
    { name: "Kim Park", vehicle: "2015 Toyota Camry", job: "Rear pads + rotors", total: "$498.60", status: "Paid", tone: "ink" },
  ];
  return (
    <Box aria-label="Illustration of the Lift job board" role="img" style={{ border: `2px solid ${COLORS.ink}`, background: COLORS.paper, boxShadow: `6px 6px 0 ${COLORS.ink}` }}>
      <Box style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 18px", background: COLORS.ink, color: COLORS.paper }}>
        <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" }}>Today · Mike's Auto</Text>
        <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.paperShade }}>5 open</Text>
      </Box>
      <Box style={{ padding: "6px 18px 10px" }}>
        {jobs.map((j) => (
          <Box key={j.name} className="lift-board-row">
            <Box style={{ minWidth: 0 }}>
              <Text style={{ fontFamily: FONT.serif, fontWeight: 600, fontSize: 15, lineHeight: 1.25, color: COLORS.ink }}>{j.name}</Text>
              <Text style={{ fontFamily: FONT.mono, fontSize: 10.5, letterSpacing: "0.04em", color: COLORS.inkSoft, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {j.vehicle} · {j.job}
              </Text>
            </Box>
            <Box style={{ textAlign: "right" }}>
              <Text style={{ fontFamily: FONT.mono, fontSize: 13, fontWeight: 700, color: COLORS.ink, lineHeight: 1.2 }}>{j.total}</Text>
              <StatusStamp tone={j.tone}>{j.status}</StatusStamp>
            </Box>
          </Box>
        ))}
      </Box>
      <Box style={{ borderTop: `1px solid ${COLORS.ink}`, padding: "10px 18px", background: COLORS.paperShade }}>
        <Text style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.06em", color: COLORS.inkSoft, lineHeight: 1.6 }}>
          9:42 AM · Jess approved the brake estimate<br />
          11:05 AM · Kim paid $498.60 by card
        </Text>
      </Box>
    </Box>
  );
}

function StatusStamp({ tone, children }: { tone: "outline-red" | "outline" | "blue" | "red" | "ink"; children: ReactNode }) {
  const styles: Record<typeof tone, CSSProperties> = {
    "outline-red": { color: COLORS.red, border: `1px solid ${COLORS.red}`, background: "transparent" },
    outline: { color: COLORS.ink, border: `1px solid ${COLORS.ink}`, background: "transparent" },
    blue: { color: COLORS.paper, border: `1px solid ${COLORS.blue}`, background: COLORS.blue },
    red: { color: COLORS.paper, border: `1px solid ${COLORS.red}`, background: COLORS.red },
    ink: { color: COLORS.paper, border: `1px solid ${COLORS.ink}`, background: COLORS.ink },
  };
  return (
    <Box style={{ display: "inline-block", marginTop: 4, padding: "2px 7px", fontFamily: FONT.mono, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", ...styles[tone] }}>
      {children}
    </Box>
  );
}

function RegistrationFrame() {
  // Printer's registration marks at four corners — magazine-press wildcard.
  const mark = (style: CSSProperties) => (
    <Box style={{ position: "absolute", width: 14, height: 14, ...style }}>
      <svg viewBox="0 0 14 14" width="14" height="14">
        <line x1="7" y1="0" x2="7" y2="14" stroke={COLORS.inkFaint} strokeWidth="1" />
        <line x1="0" y1="7" x2="14" y2="7" stroke={COLORS.inkFaint} strokeWidth="1" />
        <circle cx="7" cy="7" r="3.5" fill="none" stroke={COLORS.inkFaint} strokeWidth="0.5" />
      </svg>
    </Box>
  );
  return (
    <>
      {mark({ top: 0, left: 0 })}
      {mark({ top: 0, right: 0 })}
      {mark({ bottom: 0, left: 0 })}
      {mark({ bottom: 0, right: 0 })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Supporting statement                                                */
/* ------------------------------------------------------------------ */

function SectionStatement() {
  return (
    <Box style={{ position: "relative", zIndex: 1, background: COLORS.paperShade }}>
      <Container size="lg" px="md" py={{ base: 24, md: 32 }}>
        <Box className="lift-grid-2-top" style={{ gap: 24 }}>
          <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, letterSpacing: "-0.02em", textTransform: "uppercase", color: COLORS.ink, margin: 0 }}>
            Less paperwork.<br />More <span style={{ color: COLORS.red }}>wrench time</span>.
          </Title>
          <Text style={{ fontFamily: FONT.serif, fontSize: "1.2rem", lineHeight: 1.5, color: COLORS.ink, maxWidth: 520, alignSelf: "center" }}>
            Lift handles the write-up and keeps every job organized, so you spend less time at a desk and more time doing the work.
          </Text>
        </Box>
      </Container>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* § 01 — Workflow                                                     */
/* ------------------------------------------------------------------ */

function SectionWorkflow() {
  return (
    <Box id="workflow" style={{ position: "relative", zIndex: 1 }}>
      <Container size="lg" px="md" py={{ base: 36, md: 56 }}>
        <SectionLabel num="01" title="How it works" />
        <Title
          order={2}
          className="lift-h2"
          style={{
            fontFamily: FONT.display,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: COLORS.ink,
            margin: "20px 0 0",
            maxWidth: 760,
          }}
        >
          One job. From write-up to paid.
        </Title>

        <Box className="lift-grid-2-top" mt={32}>
          <Box style={{ minWidth: 0 }}>
            <Stack gap={22}>
              <ManualFeature
                tag="01"
                title="Create the repair order"
                body="Add the customer, vehicle, work, parts, labor, and photos from your phone. Use saved jobs or talk through what you found when that is faster."
              />
              <ManualFeature
                tag="02"
                title="Review and send the estimate"
                body="Check the work, make any changes, and send it to the customer. They review the estimate and tap once to approve."
              />
              <ManualFeature
                tag="03"
                title="Keep every job moving"
                body="One board shows what is awaiting approval, scheduled, in repair, ready for pickup, or paid. No paper pile and no guessing where a job stands."
              />
              <ManualFeature
                tag="04"
                title="Invoice and collect payment"
                body="When the work is finished, send the invoice and payment link by text. The invoice and payment stay attached to the repair order."
              />
            </Stack>
          </Box>
          <Box style={{ minWidth: 0 }}>
            <EstimateCardDemo />
          </Box>
        </Box>

        <Group justify="flex-start" mt={32}>
          <a href={ctaHref("workflow")} className="lift-cta lift-cta-primary" onClick={() => track("workflow_cta_click", { cta_position: "workflow" })}>
            {CTA_LABEL}
          </a>
        </Group>
      </Container>
    </Box>
  );
}

function ManualFeature({ tag, title, body }: { tag: string; title: string; body: string }) {
  return (
    <Box>
      <Group gap="md" align="baseline" mb={6}>
        <Text style={{ fontFamily: FONT.mono, fontSize: 11, color: COLORS.red, letterSpacing: "0.15em" }}>{tag}</Text>
        <Box style={{ flex: 1, height: 1, background: COLORS.ink, opacity: 0.4 }} />
      </Group>
      <Text component="h3" style={{ fontFamily: FONT.display, fontSize: "1.2rem", lineHeight: 1.15, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.01em", margin: 0 }}>
        {title}
      </Text>
      <Text style={{ fontFamily: FONT.serif, fontSize: "1.02rem", lineHeight: 1.5, color: COLORS.inkSoft, marginTop: 8, maxWidth: 480 }}>
        {body}
      </Text>
    </Box>
  );
}

/**
 * Supporting visual for the workflow: one repair order carrying its estimate,
 * the customer's approval, and the payment. Cropped to the interaction being
 * explained so it stays legible on a phone.
 */
function EstimateCardDemo() {
  const lines = [
    { desc: "Front brake pads (ceramic)", kind: "Part", amt: "$148.00" },
    { desc: "Front rotors, pair", kind: "Part", amt: "$212.00" },
    { desc: "Replace pads + rotors · 1.5 hr", kind: "Labor", amt: "$202.50" },
  ];
  return (
    <Box aria-label="Illustration of a repair order with an approved estimate and payment" role="img" style={{ position: "relative", border: `1px solid ${COLORS.ink}`, background: COLORS.paper }}>
      <Box style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${COLORS.ink}` }}>
        <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.ink }}>RO #1042 · Jess Ramirez</Text>
        <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.1em", color: COLORS.inkSoft, whiteSpace: "nowrap" }}>2016 CR-V</Text>
      </Box>
      <Box style={{ padding: "8px 18px" }}>
        {lines.map((l) => (
          <Box key={l.desc} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: `1px dashed ${COLORS.inkFaint}` }}>
            <Box style={{ minWidth: 0 }}>
              <Text style={{ fontFamily: FONT.serif, fontSize: 14.5, color: COLORS.ink, lineHeight: 1.3 }}>{l.desc}</Text>
              <Text style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: COLORS.inkFaint }}>{l.kind}</Text>
            </Box>
            <Text style={{ fontFamily: FONT.mono, fontSize: 13, color: COLORS.ink, whiteSpace: "nowrap" }}>{l.amt}</Text>
          </Box>
        ))}
        <Box style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px" }}>
          <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.inkSoft }}>Total w/ tax</Text>
          <Text style={{ fontFamily: FONT.display, fontSize: 18, color: COLORS.ink }}>$612.40</Text>
        </Box>
      </Box>
      <Box style={{ borderTop: `1px solid ${COLORS.ink}`, padding: "12px 18px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", background: COLORS.paperShade }}>
        <StatusStamp tone="red">Approved by customer · 9:42 AM</StatusStamp>
        <StatusStamp tone="outline">Invoice + pay link sent</StatusStamp>
      </Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* § 02 — Pricing                                                      */
/* ------------------------------------------------------------------ */

function SectionPricing() {
  return (
    <Box id="pricing" style={{ position: "relative", zIndex: 1, background: COLORS.paperShade }}>
      <Container size="md" px="md" py={{ base: 36, md: 56 }}>
        <Stack align="center" gap={0}>
          <SectionLabel num="02" title="The Price" />
        </Stack>
        <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, letterSpacing: "-0.02em", textTransform: "uppercase", color: COLORS.ink, margin: "20px 0 12px", textAlign: "center" }}>
          One shop. One price.<br />$79/month.
        </Title>
        <Text style={{ fontFamily: FONT.serif, fontSize: "1.15rem", color: COLORS.inkSoft, maxWidth: 540, margin: "0 auto", textAlign: "center", lineHeight: 1.5 }}>
          Repair orders, job tracking, estimates, approvals, invoices, and payments in one simple plan.
        </Text>

        <Box mt={28} style={{ position: "relative", border: `2px solid ${COLORS.ink}`, background: COLORS.paper, padding: 0 }}>
          <RegistrationFrame />

          {/* Stamped header band */}
          <Box style={{ borderBottom: `2px solid ${COLORS.ink}`, padding: "14px 28px", background: COLORS.ink, color: COLORS.paper, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Plan · Lift Standard · No. 1
            </Text>
            <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              14-day trial · No card
            </Text>
          </Box>

          <Box style={{ padding: "20px 32px 16px", textAlign: "center" }}>
            <Text className="lift-price" style={{ fontFamily: FONT.display, color: COLORS.ink, letterSpacing: "-0.04em" }}>
              <span style={{ color: COLORS.red }}>$</span>79
              <span style={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: "1.5rem", color: COLORS.inkSoft, marginLeft: 6 }}>/mo</span>
            </Text>
          </Box>

          <Box style={{ borderTop: `1px solid ${COLORS.ink}`, padding: "24px 32px" }}>
            <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.red, marginBottom: 14 }}>
              Included
            </Text>
            <Box style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px 24px" }}>
              {[
                "Unlimited repair orders, customers, vehicles, and photos",
                "Voice-assisted repair-order creation",
                "Estimate and approval links",
                "Invoices and customer payment links",
                "Estimate, approval, invoice, and payment messages included",
                "Complete vehicle and repair history",
                "One-click CSV export",
                "No per-tech or per-RO fees",
                "No add-ons or contract",
              ].map((line) => (
                <CheckRow key={line} mark="✓" color={COLORS.ink}>{line}</CheckRow>
              ))}
            </Box>
            <Text mt={18} style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: "0.95rem", color: COLORS.inkSoft }}>
              Card payments run through your own Stripe account. Standard Stripe processing fees apply; Lift adds nothing on top.
            </Text>
          </Box>

          <Box style={{ borderTop: `2px solid ${COLORS.ink}`, padding: "24px 32px", textAlign: "center" }}>
            <a href={ctaHref("pricing")} className="lift-cta lift-cta-primary" onClick={() => track("pricing_cta_click", { cta_position: "pricing" })}>
              {CTA_LABEL}
            </a>
            <Text mt={12} style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: "0.95rem", color: COLORS.inkSoft }}>
              Free for 14 days. No card required.
            </Text>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function CheckRow({ mark, color, children }: { mark: string; color: string; children: ReactNode }) {
  return (
    <Group align="flex-start" gap={12} wrap="nowrap">
      <Box style={{
        flexShrink: 0,
        width: 24,
        height: 24,
        border: `1px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT.display,
        color,
        fontSize: 13,
      }}>
        {mark}
      </Box>
      <Text style={{ fontFamily: FONT.serif, fontSize: "1.05rem", lineHeight: 1.4, color: COLORS.ink, paddingTop: 1 }}>
        {children}
      </Text>
    </Group>
  );
}

/* ------------------------------------------------------------------ */
/* § 03 — Features (three outcome groups)                              */
/* ------------------------------------------------------------------ */

function SectionFeatures() {
  const groups: { tag: string; title: string; items: string[] }[] = [
    {
      tag: "A",
      title: "Write it up",
      items: ["Repair orders from your phone", "Parts and labor line items", "Voice-to-RO", "Saved common jobs", "Photo inspections"],
    },
    {
      tag: "B",
      title: "Run the day",
      items: ["Simple job-status board", "Customers and vehicles", "Complete repair history", "Simple booking", "Vehicle-specific service reminders"],
    },
    {
      tag: "C",
      title: "Close the job",
      items: ["Texted estimates", "Customer approval links", "Invoices and payment links", "Secure card processing", "One-click data export"],
    },
  ];

  return (
    <Box id="features" style={{ position: "relative", zIndex: 1 }}>
      <Container size="lg" px="md" py={{ base: 36, md: 56 }}>
        <SectionLabel num="03" title="The Toolbox" />
        <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, letterSpacing: "-0.02em", textTransform: "uppercase", color: COLORS.ink, margin: "20px 0 0", maxWidth: 720 }}>
          Just what a 1–3 bay shop runs on.
        </Title>

        <Box className="lift-grid-3" mt={28}>
          {groups.map((g) => (
            <Box key={g.tag} style={{ padding: "24px 24px 26px", minWidth: 0 }}>
              <Group justify="space-between" align="baseline" mb={8}>
                <Text style={{ fontFamily: FONT.mono, fontSize: 11, color: COLORS.red, letterSpacing: "0.2em" }}>§03.{g.tag}</Text>
              </Group>
              <Text component="h3" style={{ fontFamily: FONT.display, fontSize: "1.35rem", lineHeight: 1.1, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.01em", margin: 0 }}>
                {g.title}
              </Text>
              <Stack gap={0} mt={14}>
                {g.items.map((item) => (
                  <Text key={item} style={{ fontFamily: FONT.serif, fontSize: "1.02rem", lineHeight: 1.4, color: COLORS.ink, padding: "8px 0", borderTop: `1px dashed ${COLORS.inkFaint}` }}>
                    {item}
                  </Text>
                ))}
              </Stack>
              {g.tag === "A" ? <VoiceFeature /> : null}
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/** Voice entry gets its own block inside "Write it up" — a capability, not the category. */
function VoiceFeature() {
  return (
    <Box mt={20} style={{ border: `1px solid ${COLORS.ink}`, background: COLORS.paperShade, padding: "16px 16px 18px" }}>
      <Text style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.red }}>Voice-to-RO</Text>
      <Text component="h4" style={{ fontFamily: FONT.display, fontSize: "1.05rem", lineHeight: 1.15, textTransform: "uppercase", color: COLORS.ink, margin: "6px 0 0" }}>
        You talk. Lift writes it up.
      </Text>
      <Text style={{ fontFamily: FONT.serif, fontSize: "0.98rem", lineHeight: 1.5, color: COLORS.inkSoft, marginTop: 8 }}>
        Walk around the vehicle and describe what you found. Lift turns it into editable parts and labor on the repair order.
      </Text>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* § 04 — Who it's for                                                 */
/* ------------------------------------------------------------------ */

function SectionFit() {
  return (
    <Box style={{ position: "relative", zIndex: 1, background: COLORS.paperShade }}>
      <Container size="lg" px="md" py={{ base: 36, md: 56 }}>
        <SectionLabel num="04" title="Built for your shop" />
        <Box className="lift-grid-2-top" mt={20}>
          <Box style={{ minWidth: 0 }}>
            <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.02em", margin: 0 }}>
              Built for the owner who's also the tech.
            </Title>
            <Text mt={16} style={{ fontFamily: FONT.serif, fontSize: "1.15rem", lineHeight: 1.5, color: COLORS.inkSoft, maxWidth: 520 }}>
              Lift fits best when you run a 1–3 bay shop, spend most of the day under a hood, and still have to write the ROs, track the jobs, send the invoices, and collect the payments.
            </Text>
          </Box>

          <Box style={{ minWidth: 0 }}>
            <Stack gap={12}>
              {[
                "You operate a 1–3 bay independent shop.",
                "You write the repair orders and do the repair work.",
                "Your jobs currently live on paper, a whiteboard, in Notes, or in your head.",
                "You need something simpler than software built for large shops.",
                "You want the complete job, customer, vehicle, invoice, and payment history in one place.",
              ].map((line) => (
                <CheckRow key={line} mark="✓" color={COLORS.ink}>{line}</CheckRow>
              ))}
            </Stack>
            <Text mt={22} style={{ fontFamily: FONT.serif, fontSize: "0.98rem", lineHeight: 1.5, color: COLORS.inkSoft, borderTop: `1px dashed ${COLORS.inkFaint}`, paddingTop: 14 }}>
              <strong style={{ color: COLORS.ink }}>Probably not a fit:</strong> multi-location shops, fleet-heavy operations, or shops with a full front-office team.
            </Text>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* § 05 — Founder                                                      */
/* ------------------------------------------------------------------ */

function SectionFounder() {
  return (
    <Box style={{ position: "relative", zIndex: 1 }}>
      <Container size="lg" px="md" py={{ base: 32, md: 48 }}>
        <SectionLabel num="05" title="Who built this" />
        <Box className="lift-grid-2-top" mt={20}>
          <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.02em", margin: 0 }}>
            Built by someone who knows both sides.
          </Title>
          <Box style={{ minWidth: 0, borderLeft: `3px solid ${COLORS.red}`, paddingLeft: 20 }}>
            <Text style={{ fontFamily: FONT.serif, fontSize: "1.15rem", lineHeight: 1.55, color: COLORS.ink }}>
              I'm Matthew—a mechanic and software engineer. I built Lift for shops where the same person diagnoses the car, writes the estimate, tracks the work, and collects the payment.
            </Text>
            <Text mt={14} style={{ fontFamily: FONT.serif, fontSize: "1.15rem", lineHeight: 1.55, color: COLORS.ink }}>
              If something is broken or confusing, you'll reach me—not a call center or a ticket number.
            </Text>
            <Text mt={16} style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: COLORS.inkSoft }}>
              — Matthew ·{" "}
              <Anchor href="mailto:lift@worxel.com" style={{ fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "none", color: COLORS.ink, textDecoration: "underline", textUnderlineOffset: 3 }}>
                lift@worxel.com
              </Anchor>
            </Text>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* § 06 — FAQ                                                          */
/* ------------------------------------------------------------------ */

function SectionFAQ() {
  // Mirrored as FAQPage JSON-LD in index.html — Google requires the markup to
  // match the visible copy, so update both together.
  const faq: { q: string; a: string }[] = [
    {
      q: "Will I waste my weekend setting it up?",
      a: "No. Setup is two screens: your email, then your shop details. No credit card. Create your first repair order the same afternoon.",
    },
    {
      q: "Can I try Lift without moving my whole shop over?",
      a: "Yes. Start with one repair order and keep using your current process while you test Lift. Add customers and vehicles as they come in.",
    },
    {
      q: "Do I have to change my shop's phone number?",
      a: "No. Keep using your existing number for calls and everyday customer conversations. Lift sends estimates, approval links, invoices, and payment links from a shared Lift texting number, and customer replies land in your Lift inbox next to the repair order.",
    },
    {
      q: "How do customer estimates and approvals work?",
      a: "You build the estimate on the repair order and send it by text. The customer opens a link, sees the line items and total, and taps Approve or Decline. Their decision is recorded on the repair order, and the job moves along on your board.",
    },
    {
      q: "What payment-processing fees apply?",
      a: "Card payments run through your own Stripe account, so Stripe's standard processing fees apply and are charged by Stripe. Lift takes no cut and adds no per-payment fee. Your $79/month is the only thing you pay Lift.",
    },
    {
      q: "Does it sync with QuickBooks?",
      a: "Not natively yet. Today: CSV export in QuickBooks Import format. Native sync is on the roadmap for 2026.",
    },
    {
      q: "Can I take my data if I leave?",
      a: "Yes. One-click CSV export of customers, vehicles, repair orders, messages, and payments — anytime, including after you cancel. No lock-in and no exit fees.",
    },
    {
      q: "How is Lift different from Shopmonkey or AutoLeap?",
      a: "Shopmonkey and AutoLeap are designed for larger shops and more complex workflows. Lift is built for an owner-operated 1–3 bay shop that wants repair orders, job tracking, approvals, invoices, and payments without the extra complexity or price.",
    },
  ];

  return (
    <Box id="faq" className="lift-faq-pad" style={{ position: "relative", zIndex: 1, background: COLORS.paperShade }}>
      <Container size="md" px="md" py={{ base: 36, md: 56 }}>
        <SectionLabel num="06" title="Honest Answers" />
        <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, letterSpacing: "-0.02em", textTransform: "uppercase", color: COLORS.ink, margin: "20px 0 20px" }}>
          Questions, answered<br />without spin.
        </Title>

        <Box>
          {faq.map((item, i) => (
            <details key={i} className="lift-faq-item">
              <summary>
                <span className="q">{item.q}</span>
                <span className="marker">Q.{String(i + 1).padStart(2, "0")}  +</span>
              </summary>
              <div className="a">{item.a}</div>
            </details>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCTA() {
  return (
    <Box style={{ position: "relative", zIndex: 1 }}>
      <Container size="md" px="md" py={{ base: 40, md: 64 }}>
        <Stack align="center" gap="md">
          <SectionLabel num="07" title="The Close" />
          <Title order={2} className="lift-final-h2" style={{ fontFamily: FONT.display, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.03em", textAlign: "center", margin: "12px 0 0" }}>
            Start with <span style={{ color: COLORS.red }}>one</span> RO.
          </Title>
          <Text style={{ fontFamily: FONT.serif, fontSize: "1.2rem", color: COLORS.inkSoft, maxWidth: 540, textAlign: "center", lineHeight: 1.5 }}>
            Write up your next job in Lift. Send the estimate, watch it move across the board, and collect the payment. Free for 14 days, then $79/month.
          </Text>
          <Box mt={4} style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
            <a id="final-cta" href={ctaHref("final")} className="lift-cta lift-cta-primary" onClick={() => track("final_cta_click", { cta_position: "final" })}>
              {CTA_LABEL}
            </a>
          </Box>
          <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.inkSoft, marginTop: 2, textAlign: "center" }}>
            No credit card required · Cancel anytime
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}

/**
 * Mobile-only bar that appears once the hero CTA scrolls off and hides again
 * when the final CTA is on screen. Desktop never renders it (CSS). Pre-render
 * starts hidden, so the static HTML is unaffected.
 */
function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("hero-cta");
    const final = document.getElementById("final-cta");
    if (!hero || !final || typeof IntersectionObserver === "undefined") return;
    let heroVisible = true;
    let heroAbove = false;
    let finalVisible = false;
    const apply = () => {
      const next = heroAbove && !heroVisible && !finalVisible;
      setShow(next);
      document.querySelector(".lift-page")?.setAttribute("data-sticky", String(next));
    };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) {
          heroVisible = e.isIntersecting;
          heroAbove = !e.isIntersecting && e.boundingClientRect.top < 0;
        } else if (e.target === final) {
          finalVisible = e.isIntersecting;
        }
      }
      apply();
    });
    io.observe(hero);
    io.observe(final);
    return () => io.disconnect();
  }, []);
  return (
    <Box className="lift-sticky" data-show={show ? "true" : "false"} aria-hidden={!show}>
      <a href={ctaHref("sticky")} tabIndex={show ? 0 : -1} onClick={() => track("sticky_cta_click", { cta_position: "sticky" })}>
        <span className="price">$79/mo</span>
        <span aria-hidden>·</span>
        <span>Try one RO free →</span>
      </a>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Colophon (footer)                                                   */
/* ------------------------------------------------------------------ */

function Colophon() {
  return (
    <Box style={{ position: "relative", zIndex: 1, borderTop: `2px solid ${COLORS.ink}`, background: COLORS.ink, color: COLORS.paper, padding: "36px 0" }}>
      <Container size="lg" px="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl">
          <Box>
            <Title order={3} style={{ fontFamily: FONT.display, color: COLORS.paper, fontSize: "1.5rem", textTransform: "uppercase", letterSpacing: "-0.02em", margin: 0 }}>
              Lift
            </Title>
            <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.paperShade, marginTop: 8 }}>
              Simple shop management · The Shop Manual · Vol. 1
            </Text>
          </Box>
          <Group gap={28} style={{ rowGap: 4 }}>
            <FooterLink href="#workflow">How it works</FooterLink>
            <FooterLink href="#features">Features</FooterLink>
            <FooterLink href="#pricing">Pricing</FooterLink>
            <FooterLink href="#faq">FAQ</FooterLink>
            {/* Plain href on purpose — /blog is server-rendered outside the SPA. */}
            <FooterLink href="/blog">Shop notes</FooterLink>
            <FooterLink href={CTA_BASE}>Sign in</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="mailto:lift@worxel.com">lift@worxel.com</FooterLink>
          </Group>
          <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.paperShade }}>
            © {new Date().getFullYear()} ·{" "}
            <Anchor href="https://worxel.com" style={{ fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit", color: "inherit", textDecoration: "underline" }}>
              A Worxel company
            </Anchor>{" "}
            · Printed on the internet
          </Text>
        </Group>
      </Container>
    </Box>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Anchor
      href={href}
      style={{
        fontFamily: FONT.mono,
        fontSize: 11,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: COLORS.paper,
        textDecoration: "none",
        borderBottom: `1px solid transparent`,
        padding: "8px 0",
        display: "inline-block",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = COLORS.paper)}
      onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
    >
      {children}
    </Anchor>
  );
}

/* ------------------------------------------------------------------ */
/* Shared atoms                                                        */
/* ------------------------------------------------------------------ */

function SectionLabel({ num, title }: { num: string; title: string }) {
  return (
    <Group gap="sm" align="center" wrap="nowrap">
      <Text style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.25em", textTransform: "uppercase", color: COLORS.red, fontWeight: 700, whiteSpace: "nowrap" }}>
        § {num}
      </Text>
      <Box style={{ flexShrink: 0, width: 24, height: 1, background: COLORS.ink }} />
      <Text style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.ink, fontWeight: 700, lineHeight: 1.3 }}>
        {title}
      </Text>
    </Group>
  );
}

function MonoLabel({ children, size = 11, visibleSmUp, className }: { children: ReactNode; size?: number; visibleSmUp?: boolean; className?: string }) {
  return (
    <Text
      className={className}
      visibleFrom={visibleSmUp ? "sm" : undefined}
      style={{
        fontFamily: FONT.mono,
        fontSize: size,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: COLORS.inkSoft,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Text>
  );
}
