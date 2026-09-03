/**
 * Prompt template: free-form "Draft with AI" from the inbox / conversation view.
 *
 * v2 feeds the customer's actual situation (open ROs, estimate state, ETA,
 * last few thread messages) so the draft is about what's really happening.
 *
 * QA 2026-09-03 M2: v1 only knew the owner's typed context. With a vehicle
 * in the shop on an approved RO it drafted "quick check-in on your recent
 * visit… running smoothly".
 */
import { RO_STATUS_PHRASES } from "./statusReply.js";

export const FREEFORM_PROMPT_VERSION = "freeform.v2";

export interface FreeformRoSituation {
  roNumber: number; // formatted RO-0142
  vehicle: { year?: number; make?: string; model?: string };
  status: string; // RoStatus
  concern?: string;
  estimateSentAt?: Date | null;
  estimateApprovedAt?: Date | null;
  estimateDeclinedAt?: Date | null;
  scheduledFor?: Date | null;
  totalCents?: number;
  /** The RO the owner has open on screen, if any. */
  focused?: boolean;
}

export interface FreeformThreadMessage {
  direction: "in" | "out";
  body: string;
  sentAt?: Date | null;
}

export interface FreeformPromptInput {
  shopName: string;
  customerFirstName: string;
  aiTone: "plain" | "friendly";
  /** Whatever the owner typed in the composer before hitting Draft with AI. */
  context?: string;
  /** Open ROs for this customer (RO_OPEN_STATUSES), most recently updated first. */
  openRos: FreeformRoSituation[];
  /** Most recent completed RO, for when nothing is open. */
  lastCompletedRo?: FreeformRoSituation | null;
  /** Last few thread messages, oldest first. */
  recentMessages?: FreeformThreadMessage[];
  now?: Date;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function vehicleLabel(v: FreeformRoSituation["vehicle"]): string {
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "vehicle";
}

function shortDate(d: Date | null | undefined, now: Date): string {
  if (!d) return "";
  const days = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return days < 0 ? `${label} (${-days} days ago)` : `${label} (in ${days} days)`;
}

function estimateState(ro: FreeformRoSituation, now: Date): string {
  if (ro.estimateApprovedAt) return `estimate APPROVED ${shortDate(ro.estimateApprovedAt, now)}`;
  if (ro.estimateDeclinedAt) return `estimate DECLINED ${shortDate(ro.estimateDeclinedAt, now)}`;
  if (ro.estimateSentAt) return `estimate sent ${shortDate(ro.estimateSentAt, now)}, NOT yet approved`;
  return "no estimate sent yet";
}

function describeRo(ro: FreeformRoSituation, now: Date): string {
  const parts = [
    `RO-${String(ro.roNumber).padStart(4, "0")}${ro.focused ? " (the one the owner has open)" : ""}`,
    vehicleLabel(ro.vehicle),
    `status: ${RO_STATUS_PHRASES[ro.status] ?? ro.status}`,
  ];
  if (ro.status === "scheduled" && ro.scheduledFor) {
    parts.push(`appointment: ${shortDate(ro.scheduledFor, now)}`);
  }
  parts.push(estimateState(ro, now));
  if (ro.totalCents && ro.totalCents > 0) parts.push(`total ${money(ro.totalCents)}`);
  if (ro.concern?.trim()) parts.push(`customer's concern: "${ro.concern.trim()}"`);
  return `- ${parts.join(" · ")}`;
}

/** What kind of message the situation calls for. Keeps the model on-topic. */
function situationGuidance(input: FreeformPromptInput): string {
  const primary = input.openRos.find((r) => r.focused) ?? input.openRos[0];
  if (!primary) {
    return input.lastCompletedRo
      ? "Nothing is in the shop right now. A follow-up on the last completed job (how's it running, anything else needed) is appropriate."
      : "No repair history on file. A short, general note is fine.";
  }
  switch (primary.status) {
    case "scheduled":
      return "The vehicle is NOT in the shop yet — it's booked to come in. Write about the upcoming appointment (confirming, what to bring, when). Do not describe work as done or in progress.";
    case "in":
    case "diagnosing":
      return primary.estimateSentAt
        ? "The vehicle is in the shop. An estimate is out — the message can nudge for approval or give a status, nothing more."
        : "The vehicle is in the shop being looked at. No estimate yet — do not quote prices or name a repair. Say an estimate is coming if relevant.";
    case "awaiting_parts":
      return "The vehicle is in the shop waiting on parts. This is a PROGRESS update — never a post-visit check-in.";
    case "in_repair":
      return primary.estimateApprovedAt
        ? "The vehicle is in the shop and the approved work is underway. This is a PROGRESS update on a car that is still here — never a post-visit check-in, never 'running smoothly'."
        : "The vehicle is in the shop being worked on. This is a PROGRESS update — never a post-visit check-in.";
    case "ready":
      return "The vehicle is done and waiting for pickup. Write about picking it up (and paying, if the total is listed).";
    default:
      return "Write about the current state of the vehicle as listed.";
  }
}

export function buildFreeformPrompt(input: FreeformPromptInput): string {
  const now = input.now ?? new Date();
  const tone =
    input.aiTone === "friendly"
      ? "Warm, neighborly, first-name basis. At most one emoji."
      : "Plain, matter-of-fact, no emojis.";

  const situation =
    input.openRos.length > 0
      ? input.openRos.map((ro) => describeRo(ro, now)).join("\n")
      : input.lastCompletedRo
        ? `- No open repair orders. Last completed job: ${describeRo(input.lastCompletedRo, now).slice(2)}`
        : "- No open repair orders and no repair history on file.";

  const thread =
    input.recentMessages && input.recentMessages.length > 0
      ? input.recentMessages
          .map((m) => {
            const who = m.direction === "in" ? "CUSTOMER" : "SHOP";
            const body = m.body.replace(/\s+/g, " ").trim();
            return `${who}: ${body.length > 160 ? `${body.slice(0, 157)}…` : body}`;
          })
          .join("\n")
      : "(no prior messages)";

  return `
You are drafting a short SMS from a small independent auto shop to a customer.

TONE: ${tone}
SHOP: ${input.shopName}
CUSTOMER FIRST NAME: ${input.customerFirstName}

OWNER'S INSTRUCTIONS: ${input.context?.trim() || "(none — write whatever the current situation calls for)"}

CURRENT SITUATION (source of truth — write about THIS):
${situation}

WHAT THIS SITUATION CALLS FOR: ${situationGuidance(input)}

RECENT THREAD (oldest first):
${thread}

Rules:
- 1–3 sentences, under 320 chars.
- Address the customer by first name.
- Follow the owner's instructions first; use the situation to fill in specifics.
- Stick to the facts above. Do NOT invent an ETA, price, diagnosis, symptom, or outcome that isn't listed. If the owner gave no ETA, don't promise one.
- If a vehicle is currently in the shop, do NOT call it a "recent visit", ask how it's "running", or imply the job is finished.
- Plain text only, no markdown, no links unless one appears in the owner's instructions.
- Do NOT add a signature — the shop name is the sender ID.
- Return ONLY the SMS body. No preamble.
`.trim();
}
