# U2 — Contacts (Customers & Vehicles)

> **Status**: Documenting existing code. Self-approved on 2026-05-24T21:30:00Z.

## Functional Design

This unit owns **Mike's customers** (people he serves) and **their vehicles**. It provides paged search, find-or-create-by-phone customer flow, vehicle creation with VIN decoding (cached), and per-customer / per-vehicle history.

**Key business rules:**

1. **Customer keyed by `(shopId, phone)`.** A second create with the same phone is idempotent — returns the existing customer rather than creating a duplicate. Used by both the authenticated owner flow and the public booking flow.
2. **Phone is E.164** — validated at boundary using `e164` Zod refinement.
3. **Vehicle linked to customer.** Customer can own many vehicles. Vehicle has `(year, make, model)` always and optionally `vin`, `plate`, `mileage`.
4. **VIN decode is cached** in `VinDecodeCache` (one of the only collections without `shopId` — VINs are universal). Cache TTL per `packages/shared/src/constants.ts`.
5. **History view** consolidates ROs + messages for a customer (`customers/history`) and ROs for a vehicle (`vehicles/history`).
6. **No customer deletion in v1** — soft via inactive flag (deferred per PLAN.md).

**Stories covered**: US-B2 (parts).
**Requirements covered**: FR-14 through FR-22, FR-65.

## NFR Requirements (in scope)

| NFR | Scope |
|---|---|
| NFR-2 | Warm read p95 <300ms (search must be snappy) |
| NFR-10 | Cached mongoose connection |
| NFR-14 | Every query filtered by shopId from JWT |
| NFR-17 | Customer PII access-controlled by shopId only |

## NFR Design

- **Search uses an index** `{ shopId: 1, _q_normalized: 1 }` or a text index over `firstName lastName phone` — current implementation uses regex over `phone`/`firstName`/`lastName`. Acceptable at v1 scale; revisit when a shop exceeds ~10k customers.
- **VIN cache hit path**: zero external calls; pure Mongo read.
- **VIN cache miss path**: NHTSA decode endpoint; result stored in `VinDecodeCache` for future hits.
- **History queries are bounded** (paged) to avoid pulling enormous result sets.

## Infrastructure Design

| Resource | Purpose |
|---|---|
| Lambda `customers/{list,create,get,patch,history}` | Customer CRUD + history |
| Lambda `vehicles/{create,patch,decodeVin,history}` | Vehicle CRUD + VIN decode |
| Mongo collection: `customers` | Index: `{ shopId: 1, phone: 1 }` (unique), `{ shopId: 1, lastName: 1, firstName: 1 }` |
| Mongo collection: `vehicles` | Index: `{ shopId: 1, customerId: 1 }`, `{ shopId: 1, vin: 1 }` sparse |
| Mongo collection: `vinDecodeCache` | TTL index on `decodedAt + TTL` |

## Code Map

| Function | File |
|---|---|
| customers list/search | `apps/api/src/functions/customers/list.ts` |
| customers find-or-create | `apps/api/src/functions/customers/create.ts` |
| customers get | `apps/api/src/functions/customers/get.ts` |
| customers patch | `apps/api/src/functions/customers/patch.ts` |
| customers history | `apps/api/src/functions/customers/history.ts` |
| vehicles create | `apps/api/src/functions/vehicles/create.ts` |
| vehicles patch | `apps/api/src/functions/vehicles/patch.ts` |
| vehicles history | `apps/api/src/functions/vehicles/history.ts` |
| VIN decode | `apps/api/src/functions/vehicles/decodeVin.ts` |
| Global lookup (typeahead) | `apps/api/src/functions/lookup.ts` |

**Models**: `Customer`, `Vehicle`, `VinDecodeCache` — `packages/shared/src/models/customer.ts`, `vehicle.ts`. (VinDecodeCache may live inline or in `vehicle.ts`.)
