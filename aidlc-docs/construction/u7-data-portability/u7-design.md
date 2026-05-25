# U7 — Data Portability

> **Status**: Documenting existing code. Self-approved on 2026-05-24T21:30:00Z.

## Functional Design

This unit exists for a single reason: **kill Mike's data-lock-in fear**. From Persona §4: *"I'll be locked in and lose my data."* From `EMAIL_CAMPAIGN_BRIEF.md` §7: the counter is "One-click CSV export, always."

**Key business rules:**

1. **One endpoint** (`POST /data/export`) produces a zip of CSVs scoped to the requesting `shopId`.
2. **Collections exported**: `customers`, `vehicles`, `repairOrders` (with line items denormalized), `messages`, `payments`. (See `data/export.ts` for the actual collection list.)
3. **Format**: CSVs use QuickBooks-importable column names where possible (per NFR-22 and PLAN.md FAQ).
4. **Export works after cancellation**. The `withAuth` middleware admits expired/canceled subscriptions for this endpoint specifically — the data belongs to the shop, not to Lift.
5. **Async path for large exports** (deferred for v1): export currently runs inline. If a shop exceeds a size threshold, the export should be scheduled to S3 and the user sent a download link. (Track in operations backlog.)

**Stories covered**: US-H3.
**Requirements covered**: FR-61, NFR-22, NFR-23.

## NFR Requirements (in scope)

| NFR | Scope |
|---|---|
| NFR-14 | All collection queries filtered by shopId |
| NFR-17 | Customer PII is exported only to the owning shop |
| NFR-22, NFR-23 | QB-importable format; works after cancel |

## NFR Design

- **Authentication exception**: export is allowed even with a canceled subscription. The auth check verifies session validity but does NOT require `shop.stripe.status === 'active'` for this endpoint.
- **Streaming**: for v1, the response is a single zip generated in-memory. Lambda memory should be sized accordingly (256MB+). If a shop's data exceeds memory headroom, switch to an S3-upload model — track as a future enhancement.
- **PII**: customer phone, email, and name are included in the export by design — this is the data Mike owns. The export endpoint logs an audit row (`AiInteraction` is not the right collection; consider adding an `ExportEvent` collection if compliance later requires per-export tracking).

## Infrastructure Design

| Resource | Purpose |
|---|---|
| Lambda `data/export` | Single endpoint; outputs application/zip |
| (None additional) | Reads from all per-shop collections |

## Code Map

| Function | File |
|---|---|
| Export | `apps/api/src/functions/data/export.ts` |

**Future enhancement** (not v1): an `ExportEvent` collection to track each export for compliance. Not currently needed because there are no real users on the platform.
