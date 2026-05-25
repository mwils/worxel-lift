# U3 — Repair Orders

> **Status**: Documenting existing code. Self-approved on 2026-05-24T21:30:00Z.

## Functional Design

This unit is the **heart of the shop's daily work** — repair orders, line items, photos, voice-to-RO, inspections, and customer-facing estimate/inspection sends. It also includes job templates (saved jobs) and the global lookup endpoint, both of which exist to make RO creation fast.

**Key business rules:**

1. **One RO = one work-unit on one vehicle.** Status enum: `in` → `in_repair` → `ready` → `picked_up`. Status transitions are owner-initiated except: SMS estimate approval flips `in` → `in_repair`; Stripe webhook flips `ready` → `picked_up`.
2. **RO number is per-shop atomic.** Created via `Shop.findOneAndUpdate({_id}, {$inc:{"counters.ro":1}})`. Never duplicated within a shop.
3. **Public token** (random 24 bytes base64url) is minted at RO creation; customer-facing links carry only this token, never an internal ID.
4. **Line items use cents.** `_totals.ts` recomputes labor/parts/tax/total on every line-item mutation. Totals are persisted (denormalized) for fast reads.
5. **Photos go through presigned PUT URLs.** Two-call flow: presign → client uploads to S3 → confirm-upload persists metadata. Confirmation includes RO id + S3 key. Photos can carry inspection severity (green/yellow/red) + a plain-English note.
6. **Voice-to-RO is a two-step pipeline.** Lambda enqueues a Transcribe job; when the job completes, Bedrock (Claude Haiku) extracts structured line items from the transcript. Owner reviews/edits before saving.
7. **Send estimate** drafts the SMS body via Bedrock, sends through `sendSms`, and writes a `Message` row with `direction=out`, `repairOrderId` set, `autoReplied=false`.
8. **Send inspection** is analogous but uses an inspection-specific prompt and renders photos on the public side.
9. **Job templates apply** drops a pre-saved set of lines onto an RO in two taps. Starter library is a one-time import of common jobs.
10. **Global lookup** (`/lookup?q=`) is a typeahead across customers + vehicles + ROs for fast keyboard navigation.

**Stories covered**: US-B1, US-B2, US-B3, US-B4, US-B5, US-B6, US-D1, US-D3.
**Requirements covered**: FR-23 through FR-32, FR-52 through FR-54, FR-64, FR-66.

## NFR Requirements (in scope)

| NFR | Scope |
|---|---|
| NFR-2 | Warm read p95 <300ms (board view, RO detail) |
| NFR-3, NFR-5 | Bedrock cost guardrail (<$0.05/RO) |
| NFR-11 | Voice-to-RO Lambda has longer timeout — Transcribe polling |
| NFR-14 | All queries filtered by shopId |
| NFR-15 | Public token is `randomBytes(24).base64url` |

## NFR Design

- **Cost guardrail**: each Bedrock call writes an `AiInteraction` row with `inputTokens`, `outputTokens`, `costCents`, `durationMs`. A daily query rolls up `costCents` per `repairOrderId` to verify the <$0.05 target.
- **Photo upload security**: presigned URLs are scoped to one S3 key, expire in minutes, and require the upload to come from the same owner who owns the RO.
- **Voice timeout**: `voiceToRo` Lambda has its timeout bumped above the 10s default (Transcribe synchronous polling).
- **Idempotent line items**: re-saving the same line-item list is a no-op beyond updating timestamps and re-running `_totals.ts`.

## Infrastructure Design

| Resource | Purpose |
|---|---|
| Lambda `repairOrders/{list,create,get,patch}` | RO core CRUD |
| Lambda `repairOrders/lineItems` | Line item CRUD + totals recompute |
| Lambda `repairOrders/inspectionItem` | Inspection item CRUD |
| Lambda `repairOrders/{photosPresign,photosConfirm}` | S3 photo upload flow |
| Lambda `repairOrders/{voicePresign,voiceToRo}` | Voice memo → Transcribe → Bedrock structuring |
| Lambda `repairOrders/{sendEstimate,sendInspection}` | AI-draft + SMS send |
| Lambda `jobTemplates/{list,create,get,patch,del,apply,starterLibrary,importStarter}` | Saved jobs |
| Lambda `lookup` | Cross-collection typeahead |
| S3 bucket: photos | Photo + voice memo storage |
| CloudFront: photos CDN | Public photo delivery for inspection pages |
| Mongo collection: `repairOrders` | Indexes: `{ shopId: 1, status: 1, updatedAt: -1 }`, `{ shopId: 1, customerId: 1 }`, `{ publicToken: 1 }` |
| Mongo collection: `jobTemplates` | Index: `{ shopId: 1, name: 1 }` |
| Mongo collection: `aiInteractions` | Index: `{ shopId: 1, repairOrderId: 1, createdAt: -1 }` |
| IAM: bedrock + transcribe + s3 on photos bucket | from `commonPermissions` |

## Code Map

| Function | File |
|---|---|
| RO list | `apps/api/src/functions/repairOrders/list.ts` |
| RO create | `apps/api/src/functions/repairOrders/create.ts` |
| RO get | `apps/api/src/functions/repairOrders/get.ts` |
| RO patch | `apps/api/src/functions/repairOrders/patch.ts` |
| Line items | `apps/api/src/functions/repairOrders/lineItems.ts` |
| Totals helper | `apps/api/src/functions/repairOrders/_totals.ts` |
| Inspection item | `apps/api/src/functions/repairOrders/inspectionItem.ts` |
| Photos presign | `apps/api/src/functions/repairOrders/photosPresign.ts` |
| Photos confirm | `apps/api/src/functions/repairOrders/photosConfirm.ts` |
| Voice presign | `apps/api/src/functions/repairOrders/voicePresign.ts` |
| Voice→RO | `apps/api/src/functions/repairOrders/voiceToRo.ts` |
| Send estimate | `apps/api/src/functions/repairOrders/sendEstimate.ts` |
| Send inspection | `apps/api/src/functions/repairOrders/sendInspection.ts` |
| Reminders inference | `apps/api/src/functions/repairOrders/_inferReminders.ts` |
| Job templates (8 files) | `apps/api/src/functions/jobTemplates/*.ts` |
| Lookup | `apps/api/src/functions/lookup.ts` |

**Models**: `RepairOrder`, `JobTemplate`, `AiInteraction` — `packages/shared/src/models/{repairOrder,jobTemplate,aiInteraction}.ts`.
