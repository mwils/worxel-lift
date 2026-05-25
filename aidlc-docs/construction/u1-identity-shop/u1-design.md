# U1 — Identity & Shop

> **Status**: Documenting existing code (brownfield). Self-approved by orchestrator on 2026-05-24T21:30:00Z.

## Functional Design

This unit owns the **shop tenant** and the **owner's identity**. It handles signup, magic-link / SMS-code login, onboarding (shop creation, SMS number provisioning, Stripe customer creation), shop-settings management, and the Stripe Customer Portal redirect.

**Key business rules:**

1. **One user, one shop (v1).** A `User` is associated with exactly one `Shop` via `shop.ownerUserId`. Multi-tenant ownership is deferred (PLAN.md §"Explicitly deferred").
2. **Magic-link is the primary login** path. JWT cookie (`lift_session`, HS256, signed with `JwtSecret`, HTTP-only, Secure, SameSite=Lax) is set on `/auth/verify`.
3. **SMS-code is the fallback** for when email is slow/blocked.
4. **Onboarding is three screens**: shop info → SMS-test → trial start. The corresponding endpoints are `onboard/shop`, `onboard/smsVerify`, and `onboard/stripeSetup`.
5. **No card required to start the trial.** Stripe Customer is created during onboarding; card capture is deferred to a later date in the trial (Stripe Setup Intent flow).
6. **Settings include the AI auto-reply kill-switch** (`shop.settings.aiAutoReply`). One-tap toggle disables FR-38.
7. **Billing portal is a Stripe redirect** — Lift does not host a billing UI.

**Stories covered**: US-A1, US-A2, US-A3, US-H1, US-H2.
**Requirements covered**: FR-1 through FR-13, FR-59, FR-60, FR-62, FR-63.

## NFR Requirements (in scope)

| NFR | Scope |
|---|---|
| NFR-1, NFR-2 | Cold-start <2.5s; warm read <300ms |
| NFR-10 | Cached `mongoose.connect` (provided by U8) |
| NFR-12 | All endpoints HTTPS |
| NFR-13 | JWT cookie HTTP-only + Secure + SameSite=Lax |
| NFR-14 | Multi-tenancy: `withAuth` populates `ctx.user.shopId`; body-supplied shopId ignored |
| NFR-16 | Stripe webhook signature verification (handled by U5 webhook, but subscription events flow through here) |
| NFR-17 | PII access scoped by shopId |
| NFR-20 | All secrets via `sst secret set` |

## NFR Design (how achieved)

- **Authentication**: HS256 JWT in HTTP-only cookie. Token TTL set in `lib/auth.ts`. No refresh token in v1 — re-login required after expiry.
- **Magic-link security**: tokens are random, single-use, time-limited (TTL in `packages/shared/src/constants.ts`). Reused/expired tokens return 401.
- **Multi-tenancy enforcement**: `withAuth` extracts `shopId` from the verified JWT; handlers thread it through. `shop/get.ts` and `shop/patch.ts` only ever query by `ctx.user.shopId`.
- **SMS-code rate limit**: per-phone code-send rate limit (single in-flight code per phone).
- **Stripe customer creation idempotency**: shop creation creates one Stripe Customer; the Customer ID is stored on `shop.stripe.customerId`. If retried, look up first by shop, not by email.

## Infrastructure Design

| Resource | Purpose |
|---|---|
| Lambda `auth/magicLink` | POST `/auth/magic-link` — generate + email token |
| Lambda `auth/verify` | GET `/auth/verify` — set cookie |
| Lambda `auth/smsCode` | POST `/auth/sms-code` — fallback |
| Lambda `auth/me` | GET `/auth/me` — session info |
| Lambda `auth/logout` | POST `/auth/logout` — clear cookie |
| Lambda `onboard/shop` | POST `/onboard/shop` — provision shop |
| Lambda `onboard/smsVerify` | POST `/onboard/sms-verify` — test SMS |
| Lambda `onboard/stripeSetup` | POST `/onboard/stripe-setup` — Checkout/Setup Intent |
| Lambda `shop/get`, `shop/patch` | GET/PATCH `/shop` |
| Lambda `billing/portal` | GET `/billing/portal` — Stripe Customer Portal redirect |
| Mongo collection: `users` | Authentication identity |
| Mongo collection: `shops` | Tenant |
| Secret: `JwtSecret`, `StripeSecretKey`, `StripePriceLift79`, `SesFromEmail`, `SmsPoolId` | bound from SST |

## Code Map

| Function | File | Notes |
|---|---|---|
| `auth/magicLink` | `apps/api/src/functions/auth/magicLink.ts` | Sends magic-link via SES; logs to `Message` (out, channel=email) |
| `auth/verify` | `apps/api/src/functions/auth/verify.ts` | Validates token, sets cookie, redirects |
| `auth/smsCode` | `apps/api/src/functions/auth/smsCode.ts` | Sends 6-digit code via SMS |
| `auth/me` | `apps/api/src/functions/auth/me.ts` | Returns user + shop summary |
| `auth/logout` | `apps/api/src/functions/auth/logout.ts` | Clears `lift_session` cookie |
| `onboard/shop` | `apps/api/src/functions/onboard/shop.ts` | Creates `shop`, provisions EUM phone number, creates Stripe customer |
| `onboard/smsVerify` | `apps/api/src/functions/onboard/smsVerify.ts` | Confirms test SMS receipt |
| `onboard/stripeSetup` | `apps/api/src/functions/onboard/stripeSetup.ts` | Stripe Checkout/Setup Intent |
| `shop/get`, `shop/patch` | `apps/api/src/functions/shop/*.ts` | Settings CRUD |
| `billing/portal` | `apps/api/src/functions/billing/portal.ts` | Stripe Customer Portal redirect |
| Auth helpers | `apps/api/src/lib/auth.ts` | `withAuth`, `signJwt`, `verifyJwt` |

**Models**: `User`, `Shop` — `packages/shared/src/models/user.ts`, `shop.ts`.
