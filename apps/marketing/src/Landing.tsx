import { Box, Container, Group, SimpleGrid, Stack, Text, Title, Anchor } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";

const APP_URL = import.meta.env.VITE_WEB_APP_URL ?? "https://lift-app.worxel.com";
const CTA_BASE = `${APP_URL}/login`;
const inboundPid = (): string | null => {
  if (typeof window === "undefined") return null;
  const pid = new URLSearchParams(window.location.search).get("pid");
  return pid && /^[a-fA-F0-9]{24}$/.test(pid) ? pid : null;
};
const ctaHref = (position: string) => {
  const base = `${CTA_BASE}?utm_source=cold-email&utm_medium=email&utm_campaign=2026-q2-lift-launch&utm_content=${position}`;
  const pid = inboundPid();
  return pid ? `${base}&pid=${pid}` : base;
};

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

      <Hairline labeled />
      <SectionWedge />

      <Hairline labeled />
      <SectionWho />

      <Hairline labeled />
      <SectionFeatures />

      <Hairline labeled />
      <SectionPricing />

      <Hairline labeled />
      <SectionFAQ />

      <Hairline labeled />
      <FinalCTA />

      <Colophon />
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Page chrome                                                         */
/* ------------------------------------------------------------------ */

function ScopedStyles() {
  return (
    <style>{`
      @keyframes draw-line { from { stroke-dashoffset: var(--len, 400); } to { stroke-dashoffset: 0; } }
      @keyframes slide-in-rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      @keyframes fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

      .lift-leader { stroke-dasharray: var(--len, 400); stroke-dashoffset: var(--len, 400); animation: draw-line 1.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.4s forwards; }
      .lift-leader-label { opacity: 0; animation: fade-up 0.6s ease-out forwards; animation-delay: 1.5s; }

      .lift-rule { transform-origin: left center; animation: slide-in-rule 0.9s cubic-bezier(0.4, 0, 0.2, 1) both; }

      .lift-link { color: ${COLORS.ink}; text-decoration: none; font-family: ${FONT.mono}; font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; padding-bottom: 2px; border-bottom: 1px solid transparent; transition: border-color 120ms ease; }
      .lift-link:hover { border-bottom-color: ${COLORS.ink}; }

      .lift-cta { background: ${COLORS.red}; color: ${COLORS.paper}; font-family: ${FONT.mono}; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; font-size: 12px; padding: 16px 28px; border: 1px solid ${COLORS.ink}; box-shadow: 4px 4px 0 ${COLORS.ink}; text-decoration: none; display: inline-block; transition: transform 100ms ease, box-shadow 100ms ease; cursor: pointer; }
      .lift-cta:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 ${COLORS.ink}; }
      .lift-cta:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 ${COLORS.ink}; }
      .lift-cta-small { padding: 10px 18px; font-size: 11px; }
      .lift-cta-ghost { background: transparent; color: ${COLORS.ink}; box-shadow: 4px 4px 0 ${COLORS.ink}; }
      .lift-cta-ghost:hover { box-shadow: 5px 5px 0 ${COLORS.ink}; }

      .lift-drop::first-letter {
        font-family: ${FONT.display};
        float: left;
        font-size: 5.2rem;
        line-height: 0.82;
        padding: 6px 10px 0 0;
        color: ${COLORS.red};
      }

      .lift-faq-item { border-bottom: 1px solid ${COLORS.ink}; }
      .lift-faq-item:first-child { border-top: 1px solid ${COLORS.ink}; }
      .lift-faq-item summary { list-style: none; padding: 22px 0; cursor: pointer; display: flex; align-items: baseline; justify-content: space-between; gap: 24px; }
      .lift-faq-item summary::-webkit-details-marker { display: none; }
      .lift-faq-item summary .q { font-family: ${FONT.serif}; font-weight: 600; font-size: 1.25rem; color: ${COLORS.ink}; }
      .lift-faq-item summary .marker { font-family: ${FONT.mono}; font-size: 12px; color: ${COLORS.red}; flex-shrink: 0; }
      .lift-faq-item[open] summary .marker { color: ${COLORS.ink}; }
      .lift-faq-item .a { padding: 0 0 22px 0; font-family: ${FONT.serif}; font-size: 1.05rem; line-height: 1.55; color: ${COLORS.inkSoft}; max-width: 56ch; }

      :where(.lift-page *) { box-sizing: border-box; }
      .lift-page h1, .lift-page h2, .lift-page h3, .lift-page p { overflow-wrap: break-word; word-break: normal; }

      .lift-grid-2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 48px; }
      .lift-grid-2 > * { min-width: 0; max-width: 100%; }
      .lift-grid-2 svg { max-width: 100%; height: auto; }
      .lift-grid-hero { grid-template-columns: minmax(0, 1fr); }
      @media (min-width: 768px) {
        .lift-grid-hero { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: center; }
      }
      @media (min-width: 768px) {
        .lift-grid-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; }
        .lift-grid-2-top { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: flex-start; }
      }
      .lift-grid-2-top { display: grid; grid-template-columns: minmax(0, 1fr); gap: 48px; }
      .lift-masthead { display: flex; flex-wrap: wrap; gap: 8px 24px; justify-content: space-between; }
      .lift-hero-headline { font-size: 4.5rem !important; line-height: 0.96 !important; max-width: 100%; }
      .lift-h2 { font-size: 3rem !important; line-height: 1.0 !important; max-width: 100%; }
      .lift-final-h2 { font-size: 6rem !important; line-height: 0.95 !important; max-width: 100%; }
      .lift-price { font-size: 5.5rem !important; line-height: 1 !important; }
      @media (min-width: 1100px) {
        .lift-hero-headline { font-size: 5.25rem !important; }
        .lift-h2 { font-size: 3.5rem !important; }
      }

      @media (max-width: 900px) {
        .lift-hero-headline { font-size: 3.75rem !important; }
        .lift-h2 { font-size: 2.4rem !important; line-height: 1.02 !important; }
        .lift-final-h2 { font-size: 4rem !important; }
        .lift-price { font-size: 4.25rem !important; }
      }
      @media (max-width: 640px) {
        .lift-hero-headline { font-size: 2.5rem !important; }
        .lift-h2 { font-size: 1.7rem !important; line-height: 1.05 !important; }
        .lift-final-h2 { font-size: 2.75rem !important; }
        .lift-price { font-size: 3.25rem !important; }
        .lift-masthead-mid, .lift-masthead-date { display: none !important; }
        .lift-cta { padding: 12px 18px; font-size: 11px; }
        .lift-drop::first-letter { font-size: 4rem; padding: 4px 8px 0 0; }
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
        <MonoLabel>The Lift Manual · Vol. 1, No. 1</MonoLabel>
        <MonoLabel className="lift-masthead-mid" visibleSmUp>For 1–3 Bay Independent Shops</MonoLabel>
        <MonoLabel className="lift-masthead-date">{ISSUE_DATE}</MonoLabel>
      </Box>
    </Container>
  );
}

function NavBar() {
  return (
    <Container size="lg" px="md" py="md" style={{ position: "relative", zIndex: 1 }}>
      <Group justify="space-between" wrap="nowrap" gap="md">
        <Anchor href="/" underline="never" style={{ color: COLORS.ink, lineHeight: 1 }}>
          <Title order={3} style={{ fontFamily: FONT.display, fontSize: "1.75rem", letterSpacing: "-0.02em", textTransform: "uppercase", color: COLORS.ink }}>
            Lift
          </Title>
        </Anchor>
        <Group gap={28} visibleFrom="sm">
          <a href="#wedge" className="lift-link">How it works</a>
          <a href="#features" className="lift-link">Features</a>
          <a href="#pricing" className="lift-link">Pricing</a>
          <a href="#faq" className="lift-link">FAQ</a>
          {/* Plain href — /blog is server-rendered outside the SPA. */}
          <a href="/blog" className="lift-link">Shop notes</a>
          <a href={CTA_BASE} className="lift-link">Sign in</a>
        </Group>
        <a href={ctaHref("nav")} className="lift-cta lift-cta-small">Start trial →</a>
      </Group>
    </Container>
  );
}

function Hairline({ thick, labeled }: { thick?: boolean; labeled?: boolean } = {}) {
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
      {labeled ? null : null}
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero() {
  return (
    <Container size="lg" px="md" py={{ base: 48, md: 96 }} style={{ position: "relative", zIndex: 1, overflow: "hidden" }}>
      <Box className="lift-grid-2 lift-grid-hero">
        <Box style={{ minWidth: 0, overflowWrap: "break-word" }}>
          <Stack gap="xl">
            <SectionLabel num="00" title="The Bay · Field Notes" />
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
              Run the whole<br />
              shop from <span style={{ color: COLORS.red }}>the bay</span>.
            </Title>

            <Text
              className="lift-drop"
              style={{
                fontFamily: FONT.serif,
                fontSize: "1.35rem",
                lineHeight: 1.45,
                color: COLORS.ink,
                maxWidth: 560,
              }}
            >
              Repair orders, photo inspections, status updates, invoices, pay links — all from your phone. The AI handles "is my car ready" so you stay under the hood.
            </Text>

            <Group gap="lg" align="center">
              <a href={ctaHref("hero")} className="lift-cta">Start your 14-day trial →</a>
              <MonoLabel size={10}>$79/mo · No card · Cancel anytime</MonoLabel>
            </Group>
          </Stack>
        </Box>

        <Box className="lift-hero-diagram" style={{ minWidth: 0, maxWidth: "100%" }}>
          <ExplodedDiagram />
        </Box>
      </Box>
    </Container>
  );
}

function ExplodedDiagram() {
  // Stylized phone schematic with self-drawing leader lines pointing to labeled callouts.
  return (
    <Box style={{ position: "relative", padding: "48px 24px" }}>
      <RegistrationFrame />

      <svg viewBox="0 0 460 540" preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", maxWidth: "100%", height: "auto", position: "relative", zIndex: 2 }}>
        {/* Phone outline */}
        <rect
          x="160"
          y="80"
          width="180"
          height="360"
          rx="2"
          ry="2"
          fill={COLORS.paper}
          stroke={COLORS.ink}
          strokeWidth="1.5"
        />
        <line x1="160" y1="120" x2="340" y2="120" stroke={COLORS.ink} strokeWidth="0.75" />
        <line x1="160" y1="400" x2="340" y2="400" stroke={COLORS.ink} strokeWidth="0.75" />
        <circle cx="250" cy="420" r="6" fill="none" stroke={COLORS.ink} strokeWidth="1" />

        {/* Phone header text */}
        <text x="170" y="113" fontFamily={FONT.mono} fontSize="8" fill={COLORS.inkSoft}>
          LIFT · 12:42 PM
        </text>

        {/* Incoming message bubble */}
        <rect x="172" y="138" width="120" height="36" fill={COLORS.paperShade} stroke={COLORS.ink} strokeWidth="0.75" />
        <text x="178" y="152" fontFamily={FONT.serif} fontSize="9" fill={COLORS.ink}>
          hey is my car
        </text>
        <text x="178" y="164" fontFamily={FONT.serif} fontSize="9" fill={COLORS.ink}>
          ready
        </text>

        {/* Auto-reply bubble (red border = AI) */}
        <rect x="188" y="188" width="140" height="46" fill={COLORS.paper} stroke={COLORS.red} strokeWidth="1.25" />
        <text x="194" y="203" fontFamily={FONT.serif} fontSize="9" fill={COLORS.ink}>
          Hi Jess — we're
        </text>
        <text x="194" y="215" fontFamily={FONT.serif} fontSize="9" fill={COLORS.ink}>
          finishing brakes now,
        </text>
        <text x="194" y="227" fontFamily={FONT.serif} fontSize="9" fill={COLORS.ink}>
          ready by 4pm.
        </text>

        {/* Estimate card */}
        <rect x="172" y="250" width="156" height="80" fill={COLORS.paper} stroke={COLORS.ink} strokeWidth="0.75" />
        <text x="178" y="264" fontFamily={FONT.mono} fontSize="7" fill={COLORS.inkSoft}>
          AI-DRAFTED ESTIMATE
        </text>
        <text x="178" y="280" fontFamily={FONT.serif} fontSize="9" fill={COLORS.ink}>
          Front brakes · pads
        </text>
        <text x="178" y="292" fontFamily={FONT.serif} fontSize="9" fill={COLORS.ink}>
          + rotor turn
        </text>
        <text x="178" y="310" fontFamily={FONT.display} fontSize="14" fill={COLORS.ink}>
          $284.00
        </text>

        {/* Approve button */}
        <rect x="188" y="345" width="124" height="22" fill={COLORS.red} />
        <text x="223" y="360" fontFamily={FONT.mono} fontSize="8" fill={COLORS.paper} fontWeight="700">
          APPROVE →
        </text>

        {/* LEADER LINES — left side */}
        <g>
          <path
            d="M 172 156 L 80 156 L 30 90"
            fill="none"
            stroke={COLORS.ink}
            strokeWidth="1"
            className="lift-leader"
            style={{ ["--len" as never]: "220" }}
          />
          <circle cx="172" cy="156" r="2.5" fill={COLORS.ink} />
        </g>
        <g>
          <path
            d="M 188 211 L 70 211 L 30 245"
            fill="none"
            stroke={COLORS.red}
            strokeWidth="1"
            className="lift-leader"
            style={{ ["--len" as never]: "200", animationDelay: "0.7s" } as CSSProperties}
          />
          <circle cx="188" cy="211" r="2.5" fill={COLORS.red} />
        </g>

        {/* LEADER LINES — right side */}
        <g>
          <path
            d="M 328 290 L 410 290 L 430 250"
            fill="none"
            stroke={COLORS.ink}
            strokeWidth="1"
            className="lift-leader"
            style={{ ["--len" as never]: "160", animationDelay: "1.0s" } as CSSProperties}
          />
          <circle cx="328" cy="290" r="2.5" fill={COLORS.ink} />
        </g>
        <g>
          <path
            d="M 312 356 L 410 356 L 430 410"
            fill="none"
            stroke={COLORS.red}
            strokeWidth="1"
            className="lift-leader"
            style={{ ["--len" as never]: "180", animationDelay: "1.3s" } as CSSProperties}
          />
          <circle cx="312" cy="356" r="2.5" fill={COLORS.red} />
        </g>

        {/* Callout labels */}
        <g className="lift-leader-label">
          <text x="0" y="84" fontFamily={FONT.mono} fontSize="9" fill={COLORS.ink} fontWeight="700">
            A — Customer
          </text>
          <text x="0" y="95" fontFamily={FONT.mono} fontSize="8" fill={COLORS.inkSoft}>
            inbound text
          </text>
        </g>
        <g className="lift-leader-label" style={{ animationDelay: "1.8s" } as CSSProperties}>
          <text x="0" y="240" fontFamily={FONT.mono} fontSize="9" fill={COLORS.red} fontWeight="700">
            B — AI auto-reply
          </text>
          <text x="0" y="251" fontFamily={FONT.mono} fontSize="8" fill={COLORS.inkSoft}>
            status check
          </text>
        </g>
        <g className="lift-leader-label" style={{ animationDelay: "2.1s" } as CSSProperties}>
          <text x="395" y="244" fontFamily={FONT.mono} fontSize="9" fill={COLORS.ink} fontWeight="700">
            C — Drafted
          </text>
          <text x="395" y="255" fontFamily={FONT.mono} fontSize="8" fill={COLORS.inkSoft}>
            estimate
          </text>
        </g>
        <g className="lift-leader-label" style={{ animationDelay: "2.4s" } as CSSProperties}>
          <text x="395" y="404" fontFamily={FONT.mono} fontSize="9" fill={COLORS.red} fontWeight="700">
            D — One-tap
          </text>
          <text x="395" y="415" fontFamily={FONT.mono} fontSize="8" fill={COLORS.inkSoft}>
            approval
          </text>
        </g>

        {/* Bottom plate */}
        <text x="230" y="500" textAnchor="middle" fontFamily={FONT.mono} fontSize="8" fill={COLORS.inkSoft} letterSpacing="2">
          FIG. 1 — RO TO PAID, ONE PHONE
        </text>
      </svg>
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
/* § 01 — The Wedge                                                    */
/* ------------------------------------------------------------------ */

function SectionWedge() {
  return (
    <Box id="wedge" style={{ position: "relative", zIndex: 1, background: COLORS.paperShade }}>
      <Container size="lg" px="md" py={96}>
        <SectionLabel num="01" title="The Wedge" />
        <Title
          order={2}
          className="lift-h2"
          style={{
            fontFamily: FONT.display,
            fontSize: "3.25rem",
            lineHeight: 1.0,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: COLORS.ink,
            margin: "24px 0 16px",
            maxWidth: 760,
          }}
        >
          How a job goes through Lift.
        </Title>
        <Text style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: "1.25rem", color: COLORS.inkSoft, maxWidth: 640, lineHeight: 1.5 }}>
          A car shows up. You snap an RO from your phone. Lift texts the estimate, the customer taps approve, and the pay link clears at pickup. You hit Send a couple of times. Otherwise, you stay in the bay.
        </Text>

        <Box className="lift-grid-2-top" mt={56}>
          <Box style={{ minWidth: 0 }}>
            <SmsThreadDemo />
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Stack gap={32}>
              <ManualFeature
                tag="§01.A"
                title="Snap the RO on your phone"
                body="Photos from your camera. Line items in two taps — or narrate the job out loud, and Lift turns the voice memo into parts and labor you can edit before sending."
              />
              <ManualFeature
                tag="§01.B"
                title="AI texts the estimate. Customer taps approve."
                body="Mechanic-speak in, plain English out. You read it, you hit Send. They tap a link, the RO flips to In Repair on its own."
              />
              <ManualFeature
                tag="§01.C"
                title="Auto-replies to 'is my car ready'"
                body="Lift answers status checks with the current state of the RO — by name, in plain English. One tap turns it off. You stay under the hood."
              />
              <ManualFeature
                tag="§01.D"
                title="Pay link in the ready text. Car leaves paid."
                body="Stripe pay link goes out with the ready-for-pickup message. Card-on-file pre-auth, too — no wallet-fumble at the counter."
              />
            </Stack>
          </Box>
        </Box>

        <Group justify="flex-start" mt={56}>
          <a href={ctaHref("wedge")} className="lift-cta">Start your 14-day trial →</a>
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
      <Text style={{ fontFamily: FONT.display, fontSize: "1.2rem", lineHeight: 1.15, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.01em" }}>
        {title}
      </Text>
      <Text style={{ fontFamily: FONT.serif, fontSize: "1.02rem", lineHeight: 1.5, color: COLORS.inkSoft, marginTop: 8, maxWidth: 480 }}>
        {body}
      </Text>
    </Box>
  );
}

function SmsThreadDemo() {
  return (
    <Box style={{ position: "relative", border: `1px solid ${COLORS.ink}`, background: COLORS.paper, padding: "20px 22px" }}>
      <Group justify="space-between" mb="md">
        <Text style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.15em", color: COLORS.inkSoft }}>
          THREAD · JESS K. · 2026-MAY-23
        </Text>
        <Box style={{ width: 8, height: 8, background: COLORS.red, borderRadius: "50%" }} />
      </Group>

      <Stack gap="xs">
        <Bubble from="customer">hey is my car ready</Bubble>
        <Bubble from="ai">
          Hi Jess — we're finishing brakes now, should be ready by 4pm. — Mike's Auto
        </Bubble>
        <ManualTag color={COLORS.red}>Auto-replied · status check</ManualTag>

        <Box my={10} style={{ borderTop: `1px dashed ${COLORS.inkFaint}` }} />

        <Bubble from="customer">yes go ahead with the brakes</Bubble>
        <Bubble from="ai">Got it — approval logged. We'll text you when she's ready.</Bubble>
        <ManualTag color={COLORS.blue}>Auto-confirmed · estimate</ManualTag>
      </Stack>
    </Box>
  );
}

function Bubble({ from, children }: { from: "customer" | "ai"; children: ReactNode }) {
  const isCustomer = from === "customer";
  return (
    <Box style={{ display: "flex", justifyContent: isCustomer ? "flex-start" : "flex-end" }}>
      <Box
        style={{
          maxWidth: "82%",
          padding: "8px 12px",
          fontFamily: FONT.serif,
          fontSize: 14,
          lineHeight: 1.4,
          color: isCustomer ? COLORS.ink : COLORS.paper,
          background: isCustomer ? COLORS.paperShade : COLORS.ink,
          border: `1px solid ${COLORS.ink}`,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function ManualTag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <Box style={{ display: "inline-flex", alignSelf: "flex-end", padding: "3px 8px", border: `1px solid ${color}`, color }}>
      <Text style={{ fontFamily: FONT.mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {children}
      </Text>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* § 02 — Who it's for                                                 */
/* ------------------------------------------------------------------ */

function SectionWho() {
  return (
    <Box style={{ position: "relative", zIndex: 1 }}>
      <Container size="lg" px="md" py={96}>
        <SectionLabel num="02" title="The Persona" />
        <Box className="lift-grid-2-top" mt={24}>
          <Box style={{ minWidth: 0 }}>
            <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, fontSize: "2.5rem", lineHeight: 1.0, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.02em", margin: 0 }}>
              This is for you if…
            </Title>
            <Stack gap={14} mt={28}>
              {[
                "You own a 1–3 bay shop and you're under a hood most of the day",
                "You're the owner, the tech, and the service advisor",
                "Your phone won't stop buzzing with 'is my car ready'",
                "You quote work on paper or in Notes and lose track of ROs",
                "You looked at Shopmonkey or AutoLeap and walked away from the price",
              ].map((line, i) => (
                <CheckRow key={i} mark="✓" color={COLORS.ink}>{line}</CheckRow>
              ))}
            </Stack>
          </Box>

          <Box style={{ minWidth: 0 }}>
            <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, fontSize: "2.5rem", lineHeight: 1.0, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.02em", margin: 0 }}>
              This is <span style={{ color: COLORS.red }}>not</span> for you if…
            </Title>
            <Stack gap={14} mt={28}>
              {[
                "You run multiple locations",
                "You have a dedicated service advisor at the front",
                "Most of your revenue is fleet or B2B contracts",
                "You're a specialty shop (trans-only, tires-only, body)",
                "You're past $1M/yr and need real scheduling — Shopmonkey or AutoLeap fit better",
              ].map((line, i) => (
                <CheckRow key={i} mark="✕" color={COLORS.red}>{line}</CheckRow>
              ))}
            </Stack>
            <Text mt={24} style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: "0.95rem", color: COLORS.inkSoft }}>
              — We say no to a lot so the product feels right for the rest.
            </Text>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

function CheckRow({ mark, color, children }: { mark: string; color: string; children: ReactNode }) {
  return (
    <Group align="flex-start" gap={14} wrap="nowrap">
      <Box style={{
        flexShrink: 0,
        width: 26,
        height: 26,
        border: `1px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT.display,
        color,
        fontSize: 14,
      }}>
        {mark}
      </Box>
      <Text style={{ fontFamily: FONT.serif, fontSize: "1.08rem", lineHeight: 1.45, color: COLORS.ink, paddingTop: 2 }}>
        {children}
      </Text>
    </Group>
  );
}

/* ------------------------------------------------------------------ */
/* § 03 — Features                                                     */
/* ------------------------------------------------------------------ */

function SectionFeatures() {
  const features = [
    { tag: "I", title: "ROs from your phone", body: "Snap photos with the camera. Add line items. Send for customer approval in two taps. Works anywhere with signal." },
    { tag: "II", title: "Voice-to-RO", body: "Walk around the car and talk. Lift turns the voice memo into structured line items you can edit before sending." },
    { tag: "III", title: "Photo inspections customers read", body: "Group photos under green/yellow/red items with a plain-English note. One link shows them what's wrong and the estimate right under it." },
    { tag: "IV", title: "Every car remembers itself", body: "Type a name, a phone, or a plate. See every job that car's ever had — what you charged, what parts you used, when she was last in." },
    { tag: "V", title: "Saved jobs in two taps", body: "The 20 jobs you do every week — saved once. Tap, tap, they're on the RO. Never retype 'front pads, 1.5 hours' again." },
    { tag: "VI", title: "Customers book themselves", body: "Your shop gets a booking link. They pick a time off your day-view; you get a text when it lands. The phone stays in your pocket." },
    { tag: "VII", title: "Service-due nudges, tied to the car", body: "Finish an oil change, Lift texts that customer in 90 days — by name, for that specific car. They reply; you book the work." },
    { tag: "VIII", title: "Customer pay links", body: "Stripe pay link in the SMS. Card on file with pre-auth. Car gets picked up — payment's already done." },
    { tag: "IX", title: "CSV export, anytime", body: "Customers, vehicles, ROs, messages, payments — one click. Your data leaves with you. Even after you cancel." },
  ];

  return (
    <Box id="features" style={{ position: "relative", zIndex: 1, background: COLORS.paperShade }}>
      <Container size="lg" px="md" py={96}>
        <SectionLabel num="03" title="The Toolbox" />
        <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, fontSize: "3.25rem", lineHeight: 1.0, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.02em", margin: "24px 0 16px", maxWidth: 720 }}>
          Just what a 1–3 bay shop runs on.
        </Title>
        <Text style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: "1.25rem", color: COLORS.inkSoft, maxWidth: 640 }}>
          From customer in the door to paid invoice — same flow, same phone. No bigger-shop features you'll never touch.
        </Text>

        <Box mt={56} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 0, border: `1px solid ${COLORS.ink}` }}>
          {features.map((f, i) => (
            <FeatureCell key={f.tag} feature={f} index={i} total={features.length} />
          ))}
        </Box>

        <ManualNote>
          <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.red }}>
            Errata · Not in Lift
          </Text>
          <Text mt={10} style={{ fontFamily: FONT.serif, fontSize: "1.05rem", lineHeight: 1.5, color: COLORS.ink }}>
            Multi-location · time-clocks · native QuickBooks sync · fleet/B2B billing ·
            multi-resource scheduling · mass-email blasts · review-request campaigns ·
            coupon push lists. By design.
          </Text>
          <Text mt={14} style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: "0.95rem", color: COLORS.inkSoft }}>
            Service-due reminders are one customer, one car, when their oil's actually due —
            a shop calling a regular back. That's not marketing.
          </Text>
        </ManualNote>
      </Container>
    </Box>
  );
}

function FeatureCell({ feature, index, total }: { feature: { tag: string; title: string; body: string }; index: number; total: number }) {
  // Build a 3-column grid; figure out which borders are needed for the cell.
  return (
    <Box style={{
      padding: "28px 26px",
      borderRight: `1px solid ${COLORS.ink}`,
      borderBottom: `1px solid ${COLORS.ink}`,
      background: COLORS.paper,
      position: "relative",
    }}>
      <Group justify="space-between" align="baseline" mb={10}>
        <Text style={{ fontFamily: FONT.mono, fontSize: 12, color: COLORS.red, letterSpacing: "0.15em" }}>
          §3.{feature.tag}
        </Text>
        <Text style={{ fontFamily: FONT.mono, fontSize: 10, color: COLORS.inkFaint, letterSpacing: "0.15em" }}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </Text>
      </Group>
      <Text style={{ fontFamily: FONT.display, fontSize: "1.15rem", lineHeight: 1.15, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.01em" }}>
        {feature.title}
      </Text>
      <Text mt={8} style={{ fontFamily: FONT.serif, fontSize: "0.98rem", lineHeight: 1.5, color: COLORS.inkSoft }}>
        {feature.body}
      </Text>
    </Box>
  );
}

function ManualNote({ children }: { children: ReactNode }) {
  return (
    <Box
      mt={48}
      style={{
        position: "relative",
        padding: "28px 32px",
        border: `2px solid ${COLORS.ink}`,
        background: COLORS.paper,
      }}
    >
      <RegistrationFrame />
      <Box style={{ position: "relative", zIndex: 2 }}>{children}</Box>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* § 04 — Pricing                                                      */
/* ------------------------------------------------------------------ */

function SectionPricing() {
  return (
    <Box id="pricing" style={{ position: "relative", zIndex: 1 }}>
      <Container size="md" px="md" py={96}>
        <SectionLabel num="04" title="The Price" />
        <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, fontSize: "3.25rem", lineHeight: 1.0, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.02em", margin: "24px 0 16px", textAlign: "center" }}>
          $79/mo. One price.<br />No surprises.
        </Title>
        <Text style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: "1.2rem", color: COLORS.inkSoft, maxWidth: 540, margin: "0 auto", textAlign: "center", lineHeight: 1.5 }}>
          Most shops your size get quoted $300–$400/mo from the big platforms. Lift is $79
          because we built it for you, not for a 10-bay multi-location.
        </Text>

        <Box mt={48} style={{ position: "relative", border: `2px solid ${COLORS.ink}`, background: COLORS.paper, padding: 0 }}>
          <RegistrationFrame />

          {/* Stamped header band */}
          <Box style={{ borderBottom: `2px solid ${COLORS.ink}`, padding: "16px 28px", background: COLORS.ink, color: COLORS.paper, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              Plan · Lift Standard · No. 1
            </Text>
            <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              14-day trial · No card
            </Text>
          </Box>

          <Box style={{ padding: "40px 32px", textAlign: "center" }}>
            <Text className="lift-price" style={{ fontFamily: FONT.display, fontSize: "5.5rem", lineHeight: 1, color: COLORS.ink, letterSpacing: "-0.04em" }}>
              <span style={{ color: COLORS.red }}>$</span>79
              <span style={{ fontFamily: FONT.serif, fontWeight: 400, fontSize: "1.5rem", color: COLORS.inkSoft, marginLeft: 6 }}>/mo</span>
            </Text>
          </Box>

          <Box style={{ borderTop: `1px solid ${COLORS.ink}`, padding: "28px 32px" }}>
            <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.red, marginBottom: 16 }}>
              Included · No add-ons
            </Text>
            <Stack gap={10}>
              {[
                "Unlimited ROs, customers, vehicles, photos",
                "Unlimited AI-drafted customer messages",
                "Dedicated two-way SMS number for your shop",
                "Customer pay links via Stripe (card fees pass through at cost)",
                "One-click CSV export of everything",
              ].map((line) => (
                <CheckRow key={line} mark="✓" color={COLORS.ink}>{line}</CheckRow>
              ))}
            </Stack>
          </Box>

          <Box style={{ borderTop: `1px solid ${COLORS.ink}`, padding: "28px 32px" }}>
            <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.red, marginBottom: 16 }}>
              No tricks
            </Text>
            <Stack gap={10}>
              {[
                "No card required to start the trial",
                "No per-tech, per-message, or per-RO fees, ever",
                "Cancel in two taps from the Stripe portal",
                "Take your data with you anytime — even after cancel",
                "Kill-switch for AI auto-reply, one tap",
              ].map((line) => (
                <CheckRow key={line} mark="✓" color={COLORS.ink}>{line}</CheckRow>
              ))}
            </Stack>
          </Box>

          <Box style={{ borderTop: `2px solid ${COLORS.ink}`, padding: "28px 32px", textAlign: "center" }}>
            <a href={ctaHref("pricing")} className="lift-cta" style={{ display: "inline-block" }}>
              Start your 14-day trial →
            </a>
            <Text mt={14} style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: "0.95rem", color: COLORS.inkSoft }}>
              10-minute setup. First AI-drafted estimate goes out the same afternoon.
            </Text>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* § 05 — FAQ                                                          */
/* ------------------------------------------------------------------ */

function SectionFAQ() {
  // Mirrored as FAQPage JSON-LD in index.html — Google requires the markup to
  // match the visible copy, so update both together.
  const faq: { q: string; a: string }[] = [
    {
      q: "Will I waste my weekend setting it up?",
      a: "No. Onboarding is three screens: shop info, test the SMS number, start the trial. About 10 minutes. You'll send your first AI-drafted estimate the same afternoon.",
    },
    {
      q: "Will my customers hate AI texts?",
      a: "You approve every word before it sends. The only auto-replies are short status-check acknowledgements (\"we're finishing brakes, ready by 4pm\") — and you can switch them off in one tap. The AI rewrites mechanic-speak into plain English, so customers usually get clearer texts, not weirder ones.",
    },
    {
      q: "Can I get my data out if I leave?",
      a: "Yes. One-click CSV export of customers, vehicles, ROs, messages, and payments — anytime, including after you cancel. No lock-in, no exit fees, no friction.",
    },
    {
      q: "Does it sync with QuickBooks?",
      a: "Not natively yet. Today: CSV export in QuickBooks Import format. Native sync is on the roadmap for 2026.",
    },
    {
      q: "Do I need a new phone or a new number?",
      a: "No. Lift is a web app that installs to your home screen — works on the phone you already have. We give your shop a dedicated two-way SMS number so customer texts route into Lift, not your personal inbox.",
    },
    {
      q: "How is this different from Shopmonkey or AutoLeap?",
      a: "Those are built for 10-bay shops with a dedicated service advisor. You don't need 90% of what they ship — and you're paying $300–$400/mo for the parts you do use. Lift does one thing: keep you in the bay while customers get answers.",
    },
  ];

  return (
    <Box id="faq" style={{ position: "relative", zIndex: 1, background: COLORS.paperShade }}>
      <Container size="md" px="md" py={96}>
        <SectionLabel num="05" title="Honest Answers" />
        <Title order={2} className="lift-h2" style={{ fontFamily: FONT.display, fontSize: "3.25rem", lineHeight: 1.0, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.02em", margin: "24px 0 32px" }}>
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
      <Container size="md" px="md" py={120}>
        <Stack align="center" gap="lg">
          <SectionLabel num="06" title="The Close" />
          <Title order={2} className="lift-final-h2" style={{ fontFamily: FONT.display, fontSize: "6rem", lineHeight: 0.95, textTransform: "uppercase", color: COLORS.ink, letterSpacing: "-0.03em", textAlign: "center", margin: "16px 0 0" }}>
            Stay <span style={{ color: COLORS.red }}>in</span> the bay.
          </Title>
          <Text style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: "1.25rem", color: COLORS.inkSoft, maxWidth: 540, textAlign: "center", lineHeight: 1.5 }}>
            $79/mo flat. RO, AI texts, pay link — same phone, same afternoon. 14-day trial, no card. Cancel in two taps. Take your data with you if you do.
          </Text>
          <Box mt={8}>
            <a href={ctaHref("final")} className="lift-cta">Start your 14-day trial →</a>
          </Box>
          <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: COLORS.inkSoft, marginTop: 4 }}>
            First AI-drafted estimate · same afternoon
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}

/* ------------------------------------------------------------------ */
/* Colophon (footer)                                                   */
/* ------------------------------------------------------------------ */

function Colophon() {
  return (
    <Box style={{ position: "relative", zIndex: 1, borderTop: `2px solid ${COLORS.ink}`, background: COLORS.ink, color: COLORS.paper, padding: "40px 0" }}>
      <Container size="lg" px="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="xl">
          <Box>
            <Title order={3} style={{ fontFamily: FONT.display, color: COLORS.paper, fontSize: "1.5rem", textTransform: "uppercase", letterSpacing: "-0.02em", margin: 0 }}>
              Lift
            </Title>
            <Text style={{ fontFamily: FONT.mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: COLORS.paperShade, marginTop: 8 }}>
              The Shop Manual · Vol. 1
            </Text>
          </Box>
          <Group gap={32}>
            {/* Plain href on purpose — /blog is server-rendered outside the SPA. */}
            <FooterLink href="/blog">Shop notes</FooterLink>
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
    <Group gap="md" align="center">
      <Text style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.25em", textTransform: "uppercase", color: COLORS.red, fontWeight: 700 }}>
        § {num}
      </Text>
      <Box style={{ flexShrink: 0, width: 24, height: 1, background: COLORS.ink }} />
      <Text style={{ fontFamily: FONT.mono, fontSize: 12, letterSpacing: "0.25em", textTransform: "uppercase", color: COLORS.ink, fontWeight: 700 }}>
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
