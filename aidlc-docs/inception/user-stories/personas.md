# Personas — Lift

> **Primary persona ("Mike") is canonically defined at [`docs/PERSONA.md`](../../../docs/PERSONA.md). This file summarizes both personas for user-stories traceability and adds the secondary persona ("Customer") that PERSONA.md does not cover.**

## P1 — Mike, the owner-operator (primary)

**Role**: Owner + lead tech + service advisor + bookkeeper at a 1–3 bay independent auto repair shop.
**Age**: 35–55. **Years wrenching**: 15+. **Tech comfort**: smartphone-fluent.
**Where**: on the shop floor, hands dirty, phone in pocket ~80% of the day.
**Dream outcome**: more wrench time, less phone time, getting paid faster.
**Biggest pain**: 6–10 "is my car ready" texts per day breaking flow.
**Top fears**: wasted-weekend-on-setup; customers thinking AI texts feel weird; data lock-in.
**Budget authority**: solo for software under $200/mo.
**Buying triggers**: a missed text → bad review; missed estimate follow-up; QuickBooks renewal sticker shock.
**Voice**: blunt, direct, mechanic-shop. Uses "RO", "the bay", "wrench time".

**Anti-personas** (DO NOT optimize for): multi-location operators, shops with a dedicated SA, fleet/B2B-heavy shops, specialty-only shops (trans/tires/body), shops over $1M/yr.

→ Full persona at [`docs/PERSONA.md`](../../../docs/PERSONA.md).

## P2 — "Jess", Mike's customer (secondary)

**Role**: An end-customer of Mike's shop. Not a Lift user — a recipient of Lift-driven communications.
**Goal**: Get her car fixed without being on the phone all day.
**Channel**: SMS, exclusively. May tap web links from SMS but does not log in anywhere.
**Awareness of Lift**: Zero. Receives texts from "Mike's Auto" and visits a Mike-branded web page — never sees the Lift brand.
**Implications for design**:
- Public pages (`/public/*`) must be brand-clean (Mike's shop, not Lift).
- SMS copy must read like Mike wrote it, not like an automated system.
- Approval/payment flows must work without an account.
- Opt-out (STOP keyword, `smsOptOutAt`) must be respected.

This persona is implied by the product but not explicitly written in `docs/PERSONA.md`. If we later want to do user research on Jess, we'd add a section to PERSONA.md or split it into two docs.
