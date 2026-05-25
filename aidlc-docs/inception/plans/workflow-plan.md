# Workflow Plan — Lift AI-DLC Run

> **Approval**: Self-approved by orchestrator on 2026-05-24T21:05:00Z (autonomous run).

## Context

This is a **brownfield** project: the Lift codebase is already scaffolded (171 TS files, ~70 Lambda handlers, 12 Mongoose models, 17 web routes). The PRD (`docs/PLAN.md`) and persona (`docs/PERSONA.md`) are mature. This AI-DLC run is a **documentation/formalization pass** — not a new-feature implementation. The output is a complete set of AI-DLC artifacts that mirror the existing system and provide a reusable scaffold for the next feature.

## Stage Selection

| Stage | Phase | Depth | Why included / Why skipped |
|---|---|---|---|
| Workspace Detection | Inception | Default | Always-execute; complete. |
| Reverse Engineering | Inception | Standard | Required (brownfield, no prior artifacts). Complete. |
| Requirements Analysis | Inception | Standard | Mandatory; formalizes PLAN.md into 66 FRs + 32 NFRs. Complete. |
| User Stories | Inception | Standard | Mandatory (user-facing features, multiple personas). Complete. |
| Workflow Planning | Inception | Standard | (this document) |
| Application Design | Inception | Standard | Component & service-layer design exists implicitly in code; formalize it. |
| Units Generation | Inception | Standard | The system decomposes naturally into ~10 units. Formalize. |
| Functional Design (per-unit) | Construction | **Minimal** | Code exists; produce one short design doc per unit that maps unit → existing code + design decisions. |
| NFR Requirements (per-unit) | Construction | Minimal | NFRs were captured globally in requirements.md; per-unit doc captures the specific NFRs in scope. |
| NFR Design (per-unit) | Construction | Minimal | Per-unit doc captures how the NFRs are achieved by existing code. |
| Infrastructure Design (per-unit) | Construction | Standard | SST is the single source of infra; per-unit doc captures the relevant Lambdas + AWS resources. |
| Code Generation (per-unit) | Construction | **SKIP** | Code already exists. Producing duplicate code would conflict with the source-of-truth. Instead, the per-unit doc closes the loop with `<unit>/code/code-map.md` linking to existing files. |
| Build and Test | Construction | Standard | Generate build/test instruction files covering the full system. |
| Operations | Operations | Placeholder | Per workflow definition. |

## Stage Sequence

```mermaid
flowchart TB
    WS[Workspace Detection ✓] --> RE[Reverse Engineering ✓]
    RE --> RA[Requirements Analysis ✓]
    RA --> US[User Stories ✓]
    US --> WP[Workflow Planning ← current]
    WP --> AD[Application Design]
    AD --> UG[Units Generation]
    UG --> Loop[/Per-Unit Loop/]
    Loop --> FD[Functional Design]
    FD --> NR[NFR Requirements]
    NR --> ND[NFR Design]
    ND --> ID[Infrastructure Design]
    ID --> CM[Code Map<br/>(replaces Code Generation)]
    CM --> Loop
    Loop --> BT[Build and Test]
    BT --> Op[Operations<br/>(placeholder)]
```

## Per-Unit Stages — Decision Matrix

For each unit produced in **Units Generation**, the orchestrator will run:
- Functional Design (always — single concise doc)
- NFR Requirements (always — single concise doc summarizing in-scope NFRs)
- NFR Design (always — single concise doc summarizing how NFRs are achieved)
- Infrastructure Design (always — single doc with the relevant SST resource list)
- Code Map (always — replaces Code Generation; lists the existing files implementing this unit)

The construction phases will be **minimal-depth** because the code already exists. The orchestrator is documenting, not generating.

## Approval Strategy

The workflow's "Wait for Explicit Approval" gates are answered by the orchestrator (acting on the user's behalf per autonomous-run authority). Approvals are logged in `audit.md` with the rationale. The user can audit any approval after the run completes by reading `audit.md`.

## Risk Notes

- **Risk**: Generated docs drift from code over time. **Mitigation**: All docs cross-reference exact code paths so a `grep` will surface mismatches.
- **Risk**: Workflow-mandated artifacts pile up and become noise. **Mitigation**: Consolidating where the workflow's schema allows; keeping per-unit docs to ~1 page each.
- **Risk**: Mermaid diagram syntax errors. **Mitigation**: Simple linear flowcharts and sequence diagrams; no complex layouts that often break.

## Estimated artifact count

| Phase | Artifacts |
|---|---|
| Inception (RE, Reqs, Stories, Plan, App Design, Units) | 5 + 1 + 2 + 1 + 1 + 1 = **11 docs** |
| Construction per-unit (~10 units × ~3 short docs each) | ~30 short docs |
| Construction build-and-test | 4 docs |
| Operations | (placeholder; skipped) |
| State + audit | 2 docs |
| **Total** | ~47 docs |
