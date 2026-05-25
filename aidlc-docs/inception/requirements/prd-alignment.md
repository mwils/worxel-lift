# PRD Alignment — LIFT_PRD.md vs. the existing scaffold

> **Created**: 2026-05-24T22:10:00Z by orchestrator. **Status**: Critical reconciliation — read this before trusting `requirements.md` for shipping decisions.

## Why this exists

I (the orchestrator) initially treated `docs/PLAN.md` as the canonical PRD for this AI-DLC run. After completing the artifacts, I noticed `LIFT_PRD.md` at the repo root — authored **2026-05-24 15:43**, before the orchestrator handoff — which appears to be the PRD the user actually meant when they said "Start with this PRD". This document reconciles the two.

## Source documents

| File | Last modified | Status |
|---|---|---|
| `LIFT_PRD.md` | 2026-05-24 15:43 | **Canonical PRD** (newer, polished, persona-aligned, scoped tight to 6 features) |
| `docs/PLAN.md` | 2026-05-15 onward | **Build plan** — describes the implemented scaffold in full (~17 BTs), includes features that LIFT_PRD.md cuts |
| `docs/PERSONA.md` | 2026-05-24 | Persona — consistent with both PRD and PLAN |

The TL;DR: **`docs/PLAN.md` describes what got built. `LIFT_PRD.md` describes what should ship in v1.** The code scaffold is more complete than the PRD's v1 scope.

## Scope diff (LIFT_PRD.md vs. existing code scaffold)

| Capability | LIFT_PRD.md v1? | Code exists? | Notes |
|---|---|---|---|
| AI Text Assistant (inbound classify + auto-reply + draft) | ✅ Yes (the wedge) | ✅ Yes | `webhooks/snsInbound`, `messages/*` |
| Estimates & ROs (AI-drafted SMS estimate, public approval) | ✅ Yes | ✅ Yes | `repairOrders/sendEstimate`, `public/{getEstimate,approveEstimate}` |
| Card-on-File Payments | ✅ Yes | ✅ Yes | `payments/*`, `public/{getPay,pay}`, `webhooks/stripe` |
| Service-Due Follow-Ups | ✅ Yes — but as a **draft queue Mike sends** | ✅ Yes | `serviceReminders/*`. *LIFT_PRD.md §4.4 emphasizes "suggestions Mike approves, never automatic blasts" — verify current `dailyScan` aligns; it may need a switch from auto-send to draft-queue.* |
| Job Photos | ✅ Yes (simple capture + attach) | ✅ Yes | `repairOrders/{photosPresign,photosConfirm}`. LIFT_PRD.md explicitly cuts photo annotation studio. |
| Saved Jobs & Consistent Pricing | ✅ Yes | ✅ Yes | `jobTemplates/*` |
| Phone-first home screen | ✅ Yes (connective tissue) | ✅ Yes | `apps/web/src/routes/app/board.tsx` |
| 10-minute onboarding (3 screens) | ✅ Yes | ✅ Yes | `apps/api/src/functions/onboard/*` + `apps/web/src/routes/onboarding.tsx` |
| Dedicated shop SMS number | ✅ Yes | ✅ Yes | `onboard/shop`, `onboard/smsVerify` |
| CSV export, anytime, post-cancel | ✅ Yes | ✅ Yes | `data/export.ts` |
| **Voice-to-RO (dictate a job)** | ❌ **Not in LIFT_PRD.md** | ✅ Yes | LIFT_PRD.md §4.2 talks about *typed* shorthand → AI-structured estimate. Voice-to-RO via Transcribe is in `repairOrders/{voicePresign,voiceToRo}` and `commonPermissions` but not in the PRD's v1. **Decision needed:** ship hidden behind a flag, ship if surfaced, or drop. |
| **Photo inspection w/ green-yellow-red severity + customer page** | ❌ **Not in LIFT_PRD.md** | ✅ Yes | LIFT_PRD.md §4.5 says "Deliberately simple: capture, attach, done. No annotation studio". Inspection pages and severity tagging in `repairOrders/inspectionItem`, `public/getInspection`, etc. exceed PRD scope. |
| **Online customer booking** (`/public/book/*`) | ❌ **Explicitly cut** | ✅ Yes | LIFT_PRD.md §6: "A full scheduling/calendar engine. … A lightweight 'when can you take my car' reply is handled inside the Text Assistant." The booking endpoints, slot validation, and confirmation SMS exist but are out of v1 scope per LIFT_PRD.md. **Decision needed:** hide from marketing, gate behind `shop.settings.booking.enabled=false`, or full removal. |
| **SMS-code login fallback** | ❌ Not explicitly in LIFT_PRD.md | ✅ Yes | `auth/smsCode.ts`. Reasonable to keep as a UX nice-to-have; LIFT_PRD.md doesn't prohibit it. |
| **Auto-approve estimate from inbound "yes" SMS** | ✅ Yes (LIFT_PRD.md §4.2, §5) | ✅ Partial | The classifier handles `estimate_approval` category; confirm the wire-through correctly flips the RO. |

## Implications for the artifacts already produced

| Artifact | Conflict? | Action |
|---|---|---|
| `inception/requirements/requirements.md` (FR-1..FR-66) | Some FRs describe features explicitly cut by LIFT_PRD.md (FR-30 voice-to-RO, FR-32 photo inspection send, FR-45–47 booking) | Add a "v1 scope" annotation on each FR — see scope-tagged list below |
| `inception/user-stories/stories.md` | US-B3 (voice-to-RO), US-D3 (photo inspection), US-F1/F2/F3 (booking), US-I2 (inspection page) all out of LIFT_PRD.md v1 scope | Tag these stories `[out-of-v1]` so test/build effort doesn't go there |
| `construction/u3-repair-orders/u3-design.md` | Includes voice-to-RO + inspection items in unit | Keep code map; flag voice + inspection as "code exists, out of v1 launch" |
| `construction/u6-public-pages/u6-design.md` | Booking endpoints documented | Flag booking surfaces as "out of v1 launch" |
| `construction/u4-customer-messaging/u4-design.md` | Service reminders documented as `dailyScan` auto-send | **Confirm semantics match LIFT_PRD.md §4.4 — drafts in a queue, not auto-blast.** If code currently auto-sends, that's a launch blocker. |

## v1-scope-tagged FR list (which FRs ship vs. which sit on the bench)

| FR ID | LIFT_PRD.md v1? | Note |
|---|---|---|
| FR-1 through FR-13 (auth, onboarding, shop settings) | ✅ ship | core |
| FR-14 through FR-22 (customers, vehicles, VIN decode) | ✅ ship | core |
| FR-23 through FR-29 (RO list/create/get/patch, line items, inspection items, photos) | ✅ ship — except FR-28 (inspection items) which is out-of-v1 | Inspection severity + customer inspection page is annotation-studio-adjacent per LIFT_PRD.md §4.5 |
| FR-30 (voice-to-RO presign + voiceToRo Lambda) | ❌ out-of-v1 | Hide UI; code can stay (no harm) |
| FR-31 (send estimate) | ✅ ship | the wedge |
| FR-32 (send inspection) | ❌ out-of-v1 | depends on inspection items being shipped |
| FR-33 through FR-40 (messaging, classify, auto-reply, owner-notify) | ✅ ship | core wedge |
| FR-41–44 (public estimate, inspection, pay) | ✅ ship for estimate + pay; ❌ out-of-v1 for inspection page | |
| FR-45 through FR-47 (booking) | ❌ out-of-v1 | LIFT_PRD.md §6 explicit |
| FR-48–51 (customer payments) | ✅ ship | core |
| FR-52–54 (job templates) | ✅ ship | core |
| FR-55–58 (service reminders) | ✅ ship — but **must be draft-queue, not auto-send** per LIFT_PRD.md §4.4 | Audit `dailyScan` semantics before launch |
| FR-59, FR-60 (billing portal, subscription events) | ✅ ship | core |
| FR-61 (data export) | ✅ ship | core |
| FR-62–66 (cross-cutting) | ✅ ship | always-on |

## Marketing-page alignment

The current `apps/marketing/src/Landing.tsx` (heavily styled editorial layout, presumably the rewrite that landed via linter/user post-orchestrator-handoff) appears to promote features. **Before launch:**
- Confirm Landing.tsx does NOT promote voice-to-RO, customer self-booking, or photo inspection beyond simple photo attachment.
- Confirm pricing remains $79/mo flat with the four risk-reversal bullets from `EMAIL_CAMPAIGN_BRIEF.md` and the LIFT_PRD.md §7 constraints.

## Recommended next action (when user returns)

1. **Confirm** that LIFT_PRD.md is in fact the canonical PRD. If yes, this alignment doc stands; if no, this doc is moot.
2. **Decide** on each out-of-v1-code item:
   - Voice-to-RO: hide UI, leave code? Drop code? Keep as a hidden "labs" feature?
   - Photo inspection: same questions.
   - Online booking: same questions. The endpoints exist; `shop.settings.booking.enabled=false` by default would gate it.
3. **Audit `serviceReminders/dailyScan`** to verify it surfaces a draft queue rather than auto-blasting customers. This is the single most-important pre-launch behavioral check per LIFT_PRD.md §4.4.
4. **Decide** whether to rewrite the 25 artifacts to drop out-of-v1 content, or leave them as "full scaffold documentation" with this alignment doc as the lens.

I am leaving the artifacts intact (full-scaffold view) and using this doc as the lens because:
- It preserves discoverability if you decide to ship the extra capabilities later.
- Removing FRs/stories now would feel like rewriting history and would obscure what was actually built.
- This doc is the single source of truth on **what ships vs. what waits**.
