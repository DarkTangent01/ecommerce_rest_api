# Migration notes: JavaScript → TypeScript (2026-10-17)

The API is now strict TypeScript under `src/`, compiled to `dist/`. The work was done incrementally (28 commits, each green on typecheck/lint/tests), and the Phase 1 audit findings were fixed with a regression test each.

**Final gate:** `yarn typecheck` ✅ · `yarn lint` ✅ · `yarn test` ✅ (22 files, 137 tests) · `yarn build` ✅ · built app started with `NODE_ENV=production` against a MongoDB replica set and probed over HTTP ✅

---

## How to run

```bash
yarn install
cp .env.example .env          # secrets may stay empty outside production
yarn dev                      # tsx watch src/server.ts
yarn build && yarn start      # node dist/server.js
yarn typecheck && yarn lint && yarn test
```

| Script | What it does |
|---|---|
| `dev` | Runs `src/server.ts` with tsx, reloads on change |
| `build` | `tsc -p tsconfig.json` → `dist/` |
| `start` | `node dist/server.js` (run `build` first) |
| `typecheck` | `tsc --noEmit` for `src/`, then tests + scripts |
| `lint` | ESLint (typescript-eslint, type-aware rules incl. `no-floating-promises`, `no-misused-promises`) |
| `test` | Vitest + Supertest; integration suites start an in-memory MongoDB (replica set and standalone) via `mongodb-memory-server`, so no local MongoDB is needed |
| `format` / `format:check` | Prettier (not applied to existing files to keep diffs reviewable) |
| `migrate:reservations-ttl` | One-off DB migration for fix C2 (see deploy checklist) |

Toolchain: Node ≥ 20 for development (CI uses 20; developed on 24), TypeScript 5.9, ESLint 10, Vitest 5, Zod 4. TypeScript is pinned to 5.9 because typescript-eslint does not support TS 7 yet. `@types/express` is pinned to v4 via `resolutions` so `@types/multer` cannot pull in Express 5 types.

### Deploy checklist

1. **Set all five secrets in production**: `JWT_SECRET`, `REFRESH_SECRET`, `WEBHOOK_SECRET`, `SERVICE_JWT_SECRET`, `SIGNED_URL_SECRET` (each ≥ 32 chars, all different). The process now refuses to start without them.
2. **Run `DB_URL=… yarn migrate:reservations-ttl` once per existing database** (`--dry-run` available). Mongoose does not drop indexes, so until this runs MongoDB keeps deleting reservations.
3. Set `CORS_ORIGIN` in production. An empty value now rejects cross-origin browser requests.
4. Point load-balancer readiness at `/api/ready`. It now returns 503 until MongoDB is connected.
5. Use a replica set (transactions). Standalone servers work through compensating fallbacks, but a replica set is the supported production mode.

---

## What was migrated

**Layout.** Every root-level source folder (`controllers/`, `services/`, `models/`, `middlewares/`, `validators/`, `utils/`, `infra/`, `config/`, …) and `server.js` were `git mv`-ed into `src/` in a single pure-move commit. The one-line re-export shims that used to live in `src/` were replaced by the real files. Nothing is left at the root except tooling (`scripts/`, `tests/`, `docs/`).

**Order (one commit per layer):**

1. Shared: config, utils, observability, infra helpers, re-export modules
2. Types and models: `src/types/domain.ts` (User, Product, ProductVariant, Cart, CartItem, Order, OrderItem, Payment, Address, Coupon, InventoryReservation, AuthUser) plus all 22 Mongoose schemas typed as `Schema<T>`/`model<T>`
3. DB layer: connection and repositories
4. Services: auth, cart, coupons, orders, payments, products, security, event bus, saga, workers
5. Middleware
6. Validation: Joi → Zod
7. Controllers
8. Routes and entry point. `allowJs` was then switched off; no `.js` remains in `src/`.

**Express typing.** `src/types/express.d.ts` augments `Request` with `user`, `tenant`, `requestId`, `correlationId`, `rawBody`, `apiKey`, `service`, `sessionContext` and `idempotencyRecord`. Handlers that run behind `auth` call `assertAuthed(req)`, which narrows to `AuthedRequest` (`req.user` non-optional) and throws 401 if a route were ever mounted without `auth`.

**Validation.** Joi was replaced by Zod schemas in `src/validators`, with input types inferred via `z.infer`. Joi's implicit behaviour is preserved: string → number/boolean/date conversion for multipart forms, JSON-string arrays (`variants`), trimming, case folding, defaults, unknown-key stripping, and 2-decimal rounding for prices. `validate(schema, body)` keeps the controllers' `{ error, value }` style. The `joi` dependency was removed.

**Error model.** `AppError` (`status` + `code`) is the single error type. `CustomeErrorHandler` now extends it, so existing call sites are unchanged. One handler (`toAppError`) maps everything else.

**Tests.** The assert-based scripts became Vitest suites. New integration suites cover auth, catalogue/product listing, cart, checkout (transactional and standalone), idempotency, payments, order-history access control, fulfilment, admin/tenant and the audit log. The old manual Mongo E2E script runs as a normal suite.

---

## Bugs fixed

Severity follows the Phase 1 audit. "Test" names the file that would have caught it. Every row was fixed in its own `fix(...)` commit.

### Critical

| # | Before | After | Test |
|---|---|---|---|
| C1 | Only 3 of 6 secrets checked, and only when `NODE_ENV=production`. `WEBHOOK_SECRET` etc. fell back to strings published in the repo, so **anyone could forge a "payment succeeded" webhook**. | Zod env schema, validated at startup. Production requires all secrets (≥ 32 chars, distinct, not a known placeholder). Placeholders are rejected everywhere. Elsewhere, a missing secret becomes a random per-process value. | `unit/env.test.ts` |
| C2 | `inventoryReservations.expiresAt` was a **TTL index**: MongoDB deleted reservations after 15 min **without returning stock**, and later cancels/refunds found nothing to release. | TTL removed, `{status, expiresAt}` index added. A sweeper (`RESERVATION_SWEEP_SECONDS`) atomically cancels still-unpaid orders, *then* returns their stock. If the order was paid first, its reservation is committed instead. Plus a migration script. | `integration/orders.test.ts` |
| C3 | The checkout fallback for standalone Mongo leaked stock and reservations when a later cart item was out of stock. | `runInTransaction()` uses `withTransaction` on replica sets. Without transactions, each step registers an undo action and failures are compensated. | `integration/orders.standalone.test.ts` |

### High

| # | Before | After | Test |
|---|---|---|---|
| H1 | Step-up auth read `req.sessionContext`, which nothing set, so **it never fired**. Any `X-Step-Up-Verified` value bypassed it anyway. | Risk flag loaded from the user's session for the device. Header ignored. | `integration/auth.test.ts` |
| H2 | `role: tokenRole \|\| dbRole`: a demoted admin kept admin rights until the token expired. | Role always read from the DB. | `integration/auth.test.ts` |
| H3 | Idempotency replaced `res.json` with an async function. A failed save was an **unhandled rejection** (can crash Node ≥ 15), and a 5xx left the key "processing", so retries got **429 for 24 h**. | Synchronous override that persists before sending and logs failures. Key deleted on 5xx. "Processing" keys older than 2 min are treated as abandoned. | `integration/idempotency.test.ts` |
| H4 | If a post-commit side effect failed, `abortTransaction()` threw *after* commit, masking the error. Client got 500 for an order that existed. | Side effects run after the transaction helper returns. Their failures are logged and alerted, and the order is still returned (201). | `integration/orders.test.ts` |
| H5 | Cancel always used a transaction (500 on standalone). Concurrent cancels could release stock twice. | Same transaction helper. Atomic `status ∈ {pending, confirmed} → cancelled`, and each reservation released exactly once. | `orders.test.ts`, `orders.standalone.test.ts` |
| H6 | 💳 The webhook recorded the PaymentEvent *before* saving the order. If the save failed, retries were seen as replays and **the payment was lost**. | One transaction: compare-and-set on the order, reservation commit/release, then the event. Without transactions the event is written last. Concurrent events for one order apply once. | `integration/payments.test.ts` |
| H7 | 💳 `payment.succeeded` for a **cancelled** order (stock already returned) marked it paid. | 409 Conflict, plus a high-severity security signal and an alert so the payment gets refunded. | `integration/payments.test.ts` |
| H8 | `PUT /tenant` spread `req.body` into an upsert keyed by `body.key`. **A tenant admin could create, rename or suspend any other tenant.** | Zod-validated body. Only the caller's tenant can be written; a different `key` gets 403. | `integration/admin.test.ts` |
| H9 | Malformed JSON, oversized bodies, `CastError`, Mongoose `ValidationError`, duplicate keys and the checkout lock all returned **500**. | Central mapping returns 400 / 413 / 400 / 422 / 409 / 423, and logs unexpected errors with the request id. | `unit/errorHandler.test.ts`, `integration/errors.test.ts` |
| H10 | `DEBUG_MODE` defaulted to true whenever `NODE_ENV` was unset, so **stack traces leaked in 5xx responses**. | Defaults to false (validated by the env schema). | `unit/env.test.ts`, `integration/errors.test.ts` |
| H11 | Float money math: `0.1 × 3 = 0.30000000000000004`, and 10% of 59.97 was stored as 5.997. | Integer-cent arithmetic for checkout, discounts and revenue. Stored values rounded to 2 dp. No schema change. | `unit/money.test.ts`, `integration/orders.test.ts` |

### Medium

| # | Before → After | Test |
|---|---|---|
| M1 | Refresh read the token, then revoked it, so parallel refreshes all succeeded. → Atomic consume; exactly one wins. | `auth.test.ts` |
| M2 | Refresh tokens stored in plaintext. → Stored as SHA-256 digests. Legacy plaintext rows are still accepted until they expire, so nobody is logged out. | `auth.test.ts` |
| M3 | JWT algorithm not pinned; refresh and access tokens indistinguishable. → HS256 pinned on sign and verify. `typ: access\|refresh` claim, checked on use. | `auth.test.ts` |
| M4 | Concurrent add-to-cart could create duplicate lines or lose increments. → `$inc` an existing line, or `$push` under an `$ne` guard (with retry). | `cart.test.ts` |
| M5 | Admin analytics counted **all tenants**. → Scoped to the admin's tenant. | `fulfilment.test.ts` |
| M6 | Sellers could ship unpaid or cancelled orders. Any shipment status except `delivered` set the order to `shipped`. → Requires a paid, open order (409 otherwise). Status mapping only moves forward. | `fulfilment.test.ts` |
| M7 | `POST /api-keys` used the raw body (500s). → Zod validation (422). | `admin.test.ts` |
| M8 | Any user could sign any path for any subject. → Only `/uploads` paths, and only for the caller's own subject unless they are an admin. | `admin.test.ts` |
| M9 | Reviews and coupons lists were unbounded. → Paginated (default 50, max 100) with `meta`. | `catalog.test.ts` |
| M10 | Product cache keyed on the raw query and never bounded, so memory could grow forever. → Key built from known parameters only. LRU capped at `CACHE_MAX_ENTRIES`. | `catalog.test.ts` |
| M11 | `/ready` always returned 200. A failed initial DB connection was never retried. No graceful shutdown or process-level handlers. → 503 until connected, retry with backoff, SIGTERM/SIGINT drain, and logging for `unhandledRejection`/`uncaughtException`. | `errors.test.ts`, `harness.test.ts` |
| M12 | Concurrent audit writes collided on `sequence`, and the losing entries were dropped. → Writes serialized in-process, with retry across processes. Hash chain verified in the test. | `audit.test.ts` |
| M13 | Empty `CORS_ORIGIN` allowed every origin, with credentials. → Denied in production. | `unit/cors.test.ts` |
| M14 | Duplicate SKU returned 500. → 409 via the central mapping. | `catalog.test.ts` |
| M15 | 💳 A malformed webhook `orderId` returned 500. → Body validated (422). | `payments.test.ts` |

### Low (fixed)

- Refresh-token DB expiry ignored the unit: `"12h"` was read as 12 days. TTLs now require a unit (`unit/duration.test.ts`).
- `?category=a&category=b` built an exact array match that never returned anything; it is now `$in` (`catalog.test.ts`).
- `DELETE /cart/items/:id` returned an unpopulated cart, unlike the other cart endpoints (`cart.test.ts`).
- The upload check rejected genuine JPEGs whose bytes contained "MZ" (`unit/security.test.ts`).
- `GET /products` turned every error into a generic 500.
- The SSE stream had no heartbeat and never cleaned up on disconnect.
- `src/modules/order/validator` re-exported names that don't exist, so importing it would throw.
- Concurrent checkouts could exceed a coupon's `usageLimit`; the claim is now an atomic check-and-increment (`orders.test.ts`).
- Product create/update over multipart keeps accepting `variants` as a JSON string, as Joi did.

---

## Breaking and behaviour changes

No routes were added, removed or renamed. Response fields were only **added**. The changes below come from bug fixes.

| Change | Who is affected |
|---|---|
| **Envelope (additive).** Every response now has `data` and `error`. Errors look like `{ success:false, message, data:null, error:{ code, message, details? }, details? }`; successes add `error: null`. `message`, `details` and `meta` are unchanged. | Nobody, unless a client rejects unknown keys. New clients should read `error.code`. |
| **Validation message wording** now comes from Zod (`{ field, message }` shape unchanged). | Clients matching on message text. |
| **Production refuses to start** without all five secrets (C1). | Deployments. |
| **`.env.example` no longer ships placeholder secrets**, and placeholders are rejected everywhere. | Local `.env` files copied from the old example. |
| **Status-code corrections:** malformed JSON 400, too-large body 413, bad ids 400, duplicates 409, checkout lock 423. These were all 500 before. | Clients that special-cased 500. |
| **Step-up enforced, `X-Step-Up-Verified` ignored** (H1). Risky sessions are refused on checkout, account deletion and API-key creation until the user signs in again. There is no MFA challenge yet. | Clients that sent the bypass header. |
| **`PUT /tenant`**: `name` is required, and `key` must equal the caller's tenant (403 otherwise). | Admin tooling. |
| **Payment for a cancelled order → 409** (H7); webhook bodies validated → 422 (M15). | Payment provider integration (it will retry; alerts fire). |
| **Shipments:** unpaid/cancelled orders → 409. `label_created`/`pending` now set the order to `processing` (was `shipped`), and `failed` leaves it unchanged. | Seller dashboards. |
| **Reviews and coupons lists are paginated** (default 50). | Clients expecting every row. |
| **`/ready` can return 503.** | Load balancers (intended). |
| **Unpaid orders are auto-cancelled** with reason "Payment window expired" after `INVENTORY_RESERVATION_MINUTES` (C2). | Expected business behaviour; previously the stock was silently lost instead. |
| **Production CORS** with an empty allowlist denies cross-origin browser requests. | Deployments without `CORS_ORIGIN`. |
| **Token TTLs** must include a unit (`15m`, `7d`). | Deployments using bare numbers. |

---

## Remaining TODOs

**`any` usages: none in `src/`.** Narrowing and type assertions that remain on purpose:

- `src/services/JwtService.ts`: `expiry as SignOptions["expiresIn"]` (TODO). TTLs are validated strings, but jsonwebtoken types them as a template-literal union.
- `src/services/couponService.ts`: TODO. `maxDiscount: 0` still means "no cap" (original behaviour); product owners should confirm.
- `src/services/OrderService.ts`: `created!` / `reservation!`. `Model.create([doc])` is typed as possibly empty.
- Error-shape assertions such as `(err as { code?: number }).code`, used for driver errors.
- Tests: repository fakes are cast with `as never` (`tests/unit/services.test.ts`, documented in the file), and test ESLint relaxes the `no-unsafe-*` rules for supertest's untyped bodies.

**Open items, deliberately not done:**

- The Docker image now builds and runs on `node:24-alpine` (runtime upgraded from the EOL Node 18 with approval; first to Node 20, then to 24 because vitest 5 and eslint 10 refuse Node 20 and yarn v1 enforces their engines even in the production install). The Docker build itself was **not verified**, because Docker isn't installed on this machine.
- **No MFA.** Step-up blocks risky sessions but offers no way to complete a challenge.
- **No refresh-token reuse detection.** Presenting a revoked token could revoke the whole token family.
- Login timing: bcrypt only runs when the email exists, which allows user enumeration by timing.
- Product SKU uniqueness is global rather than per tenant (a schema change, so not done).
- Cancelling a *paid* (`confirmed`) order releases stock but triggers no refund (business decision).
- The old image file isn't deleted when a product image is replaced.
- `/metrics` content negotiation: `Accept: */*` gets Prometheus text.
- In-memory stand-ins (cache, rate limits, locks, queue) are per process; use Redis when running several instances.
- Prettier is configured but has not been run over the existing code, to keep these diffs reviewable.
- `frontend/` (Angular admin UI) was out of scope and is untouched (it was already untracked).
- Graceful shutdown was not exercised end to end (Windows has no SIGTERM).
- The four legacy one-line test wrappers (`tests/security/security.test.js`, `tests/unit/oop.test.js`, `tests/integration/runtime.test.js`, `tests/e2e/mongo.test.js`) were deleted with approval; the tests they wrapped live on as the Vitest suites above.
