# U4 — Customer Messaging

> **Status**: Documenting existing code. Self-approved on 2026-05-24T21:30:00Z.

## Functional Design

This unit owns the **wedge** of the product — AI-handled inbound customer SMS plus the manual draft/send path for non-routine messages. It also includes service-due reminders (per-customer, per-vehicle, time-based) because they share the SMS outbound rail.

**Key business rules:**

1. **One conversation = one customer**, sorted by `sentAt`. Messages have `direction: in|out`, `autoReplied: bool`, `repairOrderId?`, and `awsMessageId` for delivery tracking.
2. **Inbound SMS arrives via SNS topic** (`SmsInboundTopic`), invoking `webhooks/snsInbound`. The Lambda extracts `From`, matches it against `Customer.phone + Shop.smsNumber` to identify the conversation, and falls through to "drop with log" if no match.
3. **Classification** uses Bedrock Haiku via `BEDROCK_MODEL_CLASSIFY`. Categories: `status_check`, `estimate_approval`, `question`, `other`. Returns a confidence score.
4. **Auto-reply path** (status_check, confidence ≥0.85, owner has auto-reply enabled): draft a short status reply using the customer's open RO state, send, mark `autoReplied=true`.
5. **Owner-notify path** (question/other or low-confidence): write the inbound `Message`, push a notification to the owner's PWA, do NOT auto-reply.
6. **Estimate-approval inbound** (e.g., customer texts "yes" instead of using the link) flips the RO state if a single matching pending estimate exists.
7. **Manual draft**: `POST /messages/draft` returns an AI-drafted reply preview given conversation context. Owner edits then sends via `POST /messages/send`.
8. **Service reminders** are scheduled per-customer per-vehicle (e.g., 90 days after an oil change). The daily scan finds due reminders and sends an SMS reusing the same outbound path. Reminder content references the specific vehicle by year/make/model.
9. **`MOCK_SMS=1`** routes all outbound SMS through SES email (to `mockEmailRecipient` per call) while AWS 10DLC is in review. Flag removed when 10DLC clears.
10. **SMS delivery webhook** (`snsDelivery`) updates `Message.deliveryStatus` so the owner can see failed/queued/delivered states.
11. **Opt-out** is respected via `Customer.smsOptOutAt`. STOP keyword handling lives in the SMS provider; we also gate outbound on this flag.

**Stories covered**: US-C1, US-C2, US-C3, US-C4, US-G1, US-G2, US-G3.
**Requirements covered**: FR-33 through FR-40, FR-55 through FR-58, FR-64.

## NFR Requirements (in scope)

| NFR | Scope |
|---|---|
| NFR-3 | Bedrock classify p95 <2s |
| NFR-4 | Inbound → outbound auto-reply end-to-end <10s |
| NFR-5 | Per-RO AI cost <$0.05 |
| NFR-9 | No auto-reply on classify confidence <0.85; graceful fallback |
| NFR-21, NFR-27 | TCPA / opt-out respected |
| NFR-25 | Auto-replies tagged `autoReplied=true` |
| NFR-26 | Owner can kill-switch AI auto-reply |

## NFR Design

- **Classification prompt** (`packages/shared/src/prompts/classify.ts`) is versioned via `CLASSIFY_PROMPT_VERSION`. Outputs structured JSON.
- **Confidence threshold** is a constant (configurable later if needed). Below threshold → owner-notify path.
- **Owner kill-switch** (`shop.settings.aiAutoReply=false`) is honored before any AI call — saves cost and respects intent immediately.
- **Cost tracking**: every Bedrock call (classify and draft) logs `AiInteraction`. Per-RO rollup verifies the guardrail.
- **Opt-out gating**: `sendSms` checks `Customer.smsOptOutAt` (or is gated by the caller) and skips sending while still recording owner-visible state.

## Infrastructure Design

| Resource | Purpose |
|---|---|
| SNS topic: `SmsInboundTopic` | Receives inbound SMS from End User Messaging |
| Lambda `webhooks/snsInbound` | Subscribed to topic; classifies + routes |
| Lambda `webhooks/snsDelivery` | Subscribed to delivery-status topic |
| Lambda `messages/{conversation,draft,send}` | Authenticated owner endpoints |
| Lambda `serviceReminders/dailyScan` | Scheduled daily; sends due reminders |
| Lambda `serviceReminders/{list,patch,disableForVehicle}` | Owner CRUD |
| End User Messaging SMS v2 | Outbound SMS path |
| SES (fallback while MOCK_SMS=1) | Mock outbound during 10DLC review |
| Mongo collection: `messages` | Index: `{ shopId: 1, customerId: 1, sentAt: -1 }`, `{ shopId: 1, awsMessageId: 1 }` |
| Mongo collection: `serviceReminders` | Index: `{ shopId: 1, dueAt: 1, status: 1 }` |
| Mongo collection: `aiInteractions` | Shared with U3 |

## Code Map

| Function | File |
|---|---|
| Inbound SMS handler | `apps/api/src/functions/webhooks/snsInbound.ts` |
| Delivery webhook | `apps/api/src/functions/webhooks/snsDelivery.ts` |
| Conversation view | `apps/api/src/functions/messages/conversation.ts` |
| AI draft preview | `apps/api/src/functions/messages/draft.ts` |
| Send | `apps/api/src/functions/messages/send.ts` |
| Daily scan | `apps/api/src/functions/serviceReminders/dailyScan.ts` |
| Reminder list/patch | `apps/api/src/functions/serviceReminders/{list,patch}.ts` |
| Disable for vehicle | `apps/api/src/functions/serviceReminders/disableForVehicle.ts` |
| Reminder serializer | `apps/api/src/functions/serviceReminders/_serialize.ts` |
| Adapter: `sendSms` | `apps/api/src/lib/sms.ts` |
| Adapter: `invokeClaude` | `apps/api/src/lib/bedrock.ts` |

**Prompts**: `packages/shared/src/prompts/classify.ts`, `draftStatus.ts`, `draftReply.ts` (versioned).
**Models**: `Message`, `ServiceReminder`, `AiInteraction` — `packages/shared/src/models/{message,serviceReminder,aiInteraction}.ts`.
