# U6 — Public Customer Pages

> **Status**: Documenting existing code. Self-approved on 2026-05-24T21:30:00Z.

## Functional Design

This unit owns every endpoint and frontend route that **Mike's customer** (Jess, persona P2) interacts with. None of these are authenticated; all are scoped by an unguessable token in the URL.

**Surfaces:**

1. **Estimate page** (`/public/e/:token`): customer sees line items + total + approve/decline buttons. Approval flips the RO to `in_repair`. Decline notifies the owner.
2. **Inspection page** (`/public/i/:token`): customer sees photos grouped by severity (green/yellow/red), each with a plain-English note. Estimate is visible if attached.
3. **Pay page** (`/public/pay/:token`): customer pays for the RO via Stripe-hosted surface. Co-owned with U5.
4. **Booking — landing** (`/public/book/:slug`): shop-branded booking page with date picker.
5. **Booking — slots** (`/public/book/:slug/slots?date=`): returns available slots respecting shop hours, capacity, and existing bookings.
6. **Booking — submit** (POST `/public/book/:slug`): creates customer + vehicle + RO atomically with `source=booking, status=scheduled`. Sends SMS confirmation to the customer and notification SMS to the owner's personal phone.
7. **Booking — manage** (`/public/booking/:bookingToken`): customer can view, reschedule, or cancel.

**Key business rules:**

- **Customer never logs in.** All flows are token-scoped.
- **Tokens are unguessable** (24 bytes base64url) and **scoped to one purpose** — an estimate token cannot be used to access the pay or booking endpoints.
- **Booking opt-in capture**: filling the booking form is treated as SMS opt-in (`Customer.smsOptInAt` set to booking timestamp). If the customer has `smsOptOutAt` set, skip outbound SMS and only notify owner.
- **Booking idempotency** on (shopId, phone) — second booking from the same phone returns the existing customer rather than creating a duplicate; same for vehicle (year, make, model match on the same customer).
- **Owner notification** goes to `Shop.ownerUserId.phone` (not the shop's SMS number).
- **Slot validation** uses `_slots.ts` — respects shop hours, slot length, capacity, and a "too soon" minimum lead time.

**Stories covered**: US-D2, US-F1, US-F2, US-F3, US-I1, US-I2, US-I3.
**Requirements covered**: FR-41 through FR-47.

## NFR Requirements (in scope)

| NFR | Scope |
|---|---|
| NFR-12 | All public traffic HTTPS |
| NFR-15 | Token security: 24-byte random base64url |
| NFR-17 | Tokens scoped by purpose (no cross-resource leakage) |
| NFR-21, NFR-27 | SMS opt-out respected |

## NFR Design

- **Token scoping**: each purpose has its own token field on its primary doc (`RepairOrder.publicToken`, `RepairOrder.inspectionToken` if separate, `Payment.publicToken`, `Booking.bookingToken`).
- **Token rotation**: tokens are minted at resource-create time and reused; no current rotation, but the `lib/auth.ts` model would support rotation if abuse is observed.
- **Rate limit**: not implemented at the application layer in v1; relies on API Gateway throttling defaults. If abuse appears, add per-IP rate limit at API Gateway WAF.
- **Branded pages**: the public web routes render the shop's name and branding (not Lift) so the customer experience feels like Mike's shop.

## Infrastructure Design

| Resource | Purpose |
|---|---|
| Lambda `public/getEstimate`, `approveEstimate`, `declineEstimate` | Estimate page + actions |
| Lambda `public/getInspection` | Inspection page |
| Lambda `public/getPay`, `pay` | Pay (co-owned with U5) |
| Lambda `public/getBook`, `getBookSlots` | Booking listing + slots |
| Lambda `public/book` | Booking submit (creates customer + vehicle + RO + SMS) |
| Lambda `public/getBooking`, `rescheduleBooking`, `cancelBooking` | Manage booking |
| `apps/web/src/routes/public/*` | Public web routes (PWA-hosted) |
| Mongo: indexes on `RepairOrder.publicToken`, `Payment.publicToken`, `RepairOrder.bookingToken` | Fast lookup |

## Code Map

| Function | File |
|---|---|
| Estimate get/approve/decline | `apps/api/src/functions/public/{getEstimate,approveEstimate,declineEstimate}.ts` |
| Inspection get | `apps/api/src/functions/public/getInspection.ts` |
| Pay get/submit | `apps/api/src/functions/public/{getPay,pay}.ts` |
| Booking get + slots + create | `apps/api/src/functions/public/{getBook,getBookSlots,book}.ts` |
| Booking manage | `apps/api/src/functions/public/{getBooking,rescheduleBooking,cancelBooking}.ts` |
| Slot validation helper | `apps/api/src/functions/public/_slots.ts` |
| Public web routes | `apps/web/src/routes/public/{estimate,inspection,pay}.tsx` |

**Notes**: Booking routes need `shop.settings.booking.enabled === true` per `public/book.ts:36`.
