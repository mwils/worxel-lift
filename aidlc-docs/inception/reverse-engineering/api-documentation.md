# API Documentation — Lift

## Conventions

- **Base URL** (dev): set in SST output — typically `https://<id>.execute-api.us-east-1.amazonaws.com`. Web app reads via `import.meta.env.VITE_API_URL`.
- **Base URL** (prod): `https://api-lift.worxel.com`.
- **Auth**: HTTP-only `lift_session` cookie containing a JWT (HS256, signed with `JwtSecret`). `withAuth` middleware extracts `ctx.user = { userId, shopId, email }`.
- **Body validation**: Every body-accepting handler runs `parseBody(event, ZodSchema)` where the schema lives in `@lift/shared/dto`.
- **Error format**: All errors return `{ error: string, code?: string, details?: object }` with appropriate HTTP status via helpers in `apps/api/src/lib/response.ts`.
- **Multi-tenancy**: Every authenticated handler MUST filter queries by `ctx.user.shopId`. Body-supplied shopIds are ignored — see `CLAUDE.md`.
- **Public endpoints** are at `/public/*` and use unguessable token-scoped URLs instead of session auth.

## Authentication (`/auth/*`)

| Method | Path | Handler | Auth | Purpose |
|---|---|---|---|---|
| POST | `/auth/magic-link` | `auth/magicLink.ts` | none | Email a magic link to the supplied address |
| GET | `/auth/verify?token=` | `auth/verify.ts` | none | Verify token, set `lift_session` cookie, redirect to app |
| POST | `/auth/sms-code` | `auth/smsCode.ts` | none | SMS code fallback flow |
| GET | `/auth/me` | `auth/me.ts` | session | Current user + shop summary |
| POST | `/auth/logout` | `auth/logout.ts` | session | Clear cookie |

## Onboarding (`/onboard/*`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| POST | `/onboard/shop` | `onboard/shop.ts` | Create shop, provision SMS number, create Stripe customer |
| POST | `/onboard/sms-verify` | `onboard/smsVerify.ts` | Confirm owner received test text on shop's new SMS number |
| POST | `/onboard/stripe-setup` | `onboard/stripeSetup.ts` | Create Stripe Checkout session / Setup Intent for trial |

## Shop (`/shop`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/shop` | `shop/get.ts` | Shop settings, SMS number, status, counters |
| PATCH | `/shop` | `shop/patch.ts` | Update settings (timezone, AI tone, auto-reply toggle, booking enabled) |

## Customers (`/customers`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/customers?q=&page=` | `customers/list.ts` | Paged customer search |
| POST | `/customers` | `customers/create.ts` | Create customer (find-or-create by phone) |
| GET | `/customers/:id` | `customers/get.ts` | Customer detail |
| PATCH | `/customers/:id` | `customers/patch.ts` | Update customer fields |
| GET | `/customers/:id/history` | `customers/history.ts` | All ROs + messages for this customer |

## Vehicles (`/vehicles`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| POST | `/vehicles` | `vehicles/create.ts` | Create vehicle linked to customer |
| PATCH | `/vehicles/:id` | `vehicles/patch.ts` | Update vehicle fields |
| GET | `/vehicles/:id/history` | `vehicles/history.ts` | All ROs for this vehicle |
| POST | `/vehicles/decode-vin` | `vehicles/decodeVin.ts` | VIN → year/make/model via cached lookup |

## Repair Orders (`/repair-orders`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/repair-orders?status=&page=` | `repairOrders/list.ts` | Paged list, optionally filtered by status |
| POST | `/repair-orders` | `repairOrders/create.ts` | Create RO under a customer + vehicle, atomic-increment shop counter |
| GET | `/repair-orders/:id` | `repairOrders/get.ts` | RO detail |
| PATCH | `/repair-orders/:id` | `repairOrders/patch.ts` | Update status, concern, notes |
| POST/PATCH/DELETE | `/repair-orders/:id/line-items` | `repairOrders/lineItems.ts` | Line item CRUD; recomputes totals via `_totals.ts` |
| POST | `/repair-orders/:id/inspection-item` | `repairOrders/inspectionItem.ts` | Add/update an inspection item |
| POST | `/repair-orders/:id/photos/presign` | `repairOrders/photosPresign.ts` | S3 presigned PUT URL for photo upload |
| POST | `/repair-orders/:id/photos/confirm` | `repairOrders/photosConfirm.ts` | Persist photo metadata after S3 upload |
| POST | `/repair-orders/:id/voice/presign` | `repairOrders/voicePresign.ts` | S3 presigned PUT URL for voice memo |
| POST | `/repair-orders/:id/voice-to-ro` | `repairOrders/voiceToRo.ts` | Trigger Transcribe + Bedrock structuring |
| POST | `/repair-orders/:id/send-estimate` | `repairOrders/sendEstimate.ts` | AI-draft estimate + send via SMS |
| POST | `/repair-orders/:id/send-inspection` | `repairOrders/sendInspection.ts` | AI-draft inspection summary + send via SMS |

## Messages (`/messages`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/messages/conversation/:customerId?since=` | `messages/conversation.ts` | Customer thread |
| POST | `/messages/draft` | `messages/draft.ts` | AI-drafted reply preview for owner to edit |
| POST | `/messages/send` | `messages/send.ts` | Send message via End User Messaging |

## Payments (Mike's customers paying Mike) (`/payments`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| POST | `/payments/link` | `payments/createLink.ts` | Generate Stripe payment URL for an RO |
| POST | `/payments/charge` | `payments/charge.ts` | Manual capture (card-on-file) |
| POST | `/payments/save-card` | `payments/saveCard.ts` | Save card-on-file via Stripe |

## Job Templates (`/job-templates`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/job-templates?q=` | `jobTemplates/list.ts` | List/search saved jobs |
| POST | `/job-templates` | `jobTemplates/create.ts` | Create a saved job |
| GET | `/job-templates/:id` | `jobTemplates/get.ts` | Saved job detail |
| PATCH | `/job-templates/:id` | `jobTemplates/patch.ts` | Update |
| DELETE | `/job-templates/:id` | `jobTemplates/del.ts` | Soft delete |
| POST | `/job-templates/apply` | `jobTemplates/apply.ts` | Apply a template to an RO |
| GET | `/job-templates/starter-library` | `jobTemplates/starterLibrary.ts` | Built-in starter set |
| POST | `/job-templates/import-starter` | `jobTemplates/importStarter.ts` | Import starter set into the shop |

## Service Reminders (`/service-reminders`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/service-reminders?status=` | `serviceReminders/list.ts` | List |
| PATCH | `/service-reminders/:id` | `serviceReminders/patch.ts` | Update or cancel |
| POST | `/service-reminders/disable-for-vehicle/:vehicleId` | `serviceReminders/disableForVehicle.ts` | Suppress for a vehicle |
| (scheduled) | — | `serviceReminders/dailyScan.ts` | Daily scan that surfaces and sends due reminders |

## Billing (`/billing`)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/billing/portal` | `billing/portal.ts` | Redirect URL to Stripe Customer Portal |

## Data export

| Method | Path | Handler | Purpose |
|---|---|---|---|
| POST | `/data/export` | `data/export.ts` | Generate a zip of CSVs (customers, vehicles, ROs, messages, payments) |

## Public — token-scoped, no auth (`/public/*`)

These endpoints are reachable by Mike's customers (not authenticated users) via random tokens embedded in SMS links. Tokens are stored on the RO/Booking and validated server-side.

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/public/e/:token` | `public/getEstimate.ts` | Estimate page (no login) |
| POST | `/public/e/:token/approve` | `public/approveEstimate.ts` | Customer approves; RO → in_repair |
| POST | `/public/e/:token/decline` | `public/declineEstimate.ts` | Customer declines |
| GET | `/public/i/:token` | `public/getInspection.ts` | Inspection page |
| GET | `/public/pay/:token` | `public/getPay.ts` | Pay page |
| POST | `/public/pay/:token` | `public/pay.ts` | Confirm payment |
| GET | `/public/book/:slug` | `public/getBook.ts` | Shop booking page |
| GET | `/public/book/:slug/slots?date=` | `public/getBookSlots.ts` | Available booking slots |
| POST | `/public/book/:slug` | `public/book.ts` | Create booking — creates customer/vehicle/RO, sends confirmation SMS, notifies owner |
| GET | `/public/booking/:bookingToken` | `public/getBooking.ts` | View / manage booking |
| POST | `/public/booking/:bookingToken/reschedule` | `public/rescheduleBooking.ts` | Reschedule |
| POST | `/public/booking/:bookingToken/cancel` | `public/cancelBooking.ts` | Cancel |

## Webhooks (`/webhooks/*`)

These are not user-facing; they receive events from AWS and Stripe.

| Method | Path | Handler | Purpose |
|---|---|---|---|
| POST | `/webhooks/sns-inbound` | `webhooks/snsInbound.ts` | Inbound SMS from SNS topic — classify + auto-reply or notify |
| POST | `/webhooks/sns-delivery` | `webhooks/snsDelivery.ts` | SMS delivery status updates |
| POST | `/webhooks/stripe` | `webhooks/stripe.ts` | Stripe events — idempotent dedup by `stripeEventId` |

## Scheduled jobs

| Schedule | Handler | Purpose |
|---|---|---|
| Daily | `serviceReminders/dailyScan.ts` | Scan due reminders + send |
| Hourly (per PLAN.md; not yet confirmed in `sst.config.ts`) | — | Stale-RO nudge (cars in `ready` > 24h) |

## Lookup (cross-collection)

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/lookup?q=` | `lookup.ts` | Single-query lookup across customers + vehicles + ROs (typeahead/global search) |
