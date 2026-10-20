# Security Deployment Checklist

For the security fixes in `fcb0377`, `ddaa73d`, `5c9d5cd` and the remediation described in [`security-remediation-report.md`](security-remediation-report.md). Work through it top to bottom, first on staging, then in production.

## 1. Before the deploy

- [ ] **Back up MongoDB** (`mongodump` or a provider snapshot) and record the restore command. The migrations below only change indexes, but the backup is the rollback for everything else.
- [ ] **Deploy the frontend together with the backend.** The refund state moved to `refundStatus` and the seller dashboard returns DTOs; the Angular app in `frontend/` was updated for both.
- [ ] **Create Tenant records for every tenant that accepts sign-ups (SEC-07).** Registration now requires an existing, `active` tenant with `config.allowSelfSignup` not set to `false`. The default tenant (`DEFAULT_TENANT`) is open while it has no record. Find tenants that users exist in but that have no record:
  ```js
  // mongosh
  const known = db.tenants.distinct("key");
  db.users.distinct("tenant").filter((t) => !known.includes(t));
  ```
  For each tenant that should keep public sign-up, create the record (admins can also `PUT /api/tenant`):
  ```js
  db.tenants.insertOne({ key: "<tenant>", name: "<Store name>", status: "active", config: { currency: "USD", locale: "en-US", paymentProvider: "manual", allowSelfSignup: true }, createdAt: new Date(), updatedAt: new Date() });
  ```
- [ ] **Check payment providers (SEC-11).** Every tenant's `config.paymentProvider` (default `manual`) must be listed in `WEBHOOK_PROVIDERS`. Webhooks with any other provider are refused.
- [ ] **Reissue internal service tokens (I-7).** Service JWTs now need a `tenant` claim; tokens without one get 403 on `/internal/events`.
- [ ] **Tell API consumers about the changes** in report §3: refund semantics, seller dashboard shape, `X-Request-Id` now always server-generated, SSE limits, OpenAPI admin-only in production.

## 2. Configuration

| Variable | Set to | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables the production checks below. |
| `TRUST_PROXY` | Hop count (usually `1`) **or** proxy IPs/CIDRs (`10.0.0.0/8`) **or** `false` | **Required behind a reverse proxy or load balancer**, otherwise all clients share the proxy's IP for rate limits and `ADMIN_IP_ALLOWLIST`. Only set it if *all* traffic reaches the API through that proxy, and make sure the proxy overwrites (not appends to) client-supplied `X-Forwarded-For`. `true` is refused. |
| `APP_IP_ADDRESS` | `0.0.0.0` in containers (set in the Dockerfile); `127.0.0.1` when a local proxy fronts the app | Now honoured; it used to be ignored (the app listened on every interface). |
| `DEBUG_MODE` | `false` | `true` is refused at startup in production (SEC-13). |
| `EXPOSE_OPENAPI` | `false` | `true` serves `/openapi.json` anonymously in production. |
| `WEBHOOK_PROVIDERS` | e.g. `manual` or `manual,stripe` | Lower-case, comma-separated. |
| `REFUND_WINDOW_DAYS` | `30` (1–365) | Days after delivery. |
| `SSE_MAX_STREAMS_PER_USER` / `SSE_MAX_STREAMS` / `SSE_MAX_LIFETIME_SECONDS` / `SSE_HEARTBEAT_SECONDS` | `3` / `1000` / `3600` / `25` | Per process (see §5). Heartbeat should be shorter than your proxy's idle timeout. |
| `JWT_SECRET`, `REFRESH_SECRET`, `WEBHOOK_SECRET`, `SERVICE_JWT_SECRET`, `SIGNED_URL_SECRET` | ≥ 32 random chars each, all different | From your secret manager; already enforced. |
| `CORS_ORIGIN` | Your site origins | Unchanged requirement. |

TLS terminates at the proxy or load balancer. The app speaks plain HTTP and must not be reachable from the internet except through that proxy.

## 3. Database migrations

Run each once per database, **in this order**, with the new code's dependencies installed. Production runs with `autoIndex` off, so these are the only way the index changes reach production.

```bash
DB_URL="mongodb://…" yarn migrate:domain-event-index --dry-run
DB_URL="mongodb://…" yarn migrate:domain-event-index
DB_URL="mongodb://…" yarn migrate:shipment-per-seller --dry-run
DB_URL="mongodb://…" yarn migrate:shipment-per-seller
```

| Migration | What it does | Notes |
|---|---|---|
| `002` domain events (SEC-12) | Drops the legacy sparse `type_1_idempotencyKey_1` index and creates the partial unique `type_1_idempotencyKey_1_keyed`. | **SEC-12 stays in effect until this runs.** If keyed events conflict it lists them and exits 1, deleting nothing; resolve them and re-run. Idempotent. |
| `003` shipments (SEC-08) | Drops the unique `{ order }` index and creates unique `order_1_seller_1`. Existing shipments (no seller) become admin whole-order shipments; no documents change. | Run before sellers start shipping on the new code, otherwise a second seller's shipment hits the old unique index. Reports `{order, seller}` duplicates and exits 1 instead of deleting. Idempotent. |
| Automatic | New `paymentEvents.signedDigest` unique sparse index (SEC-11) and new order fields | Build the index with `db.paymentEvents.createIndex({ signedDigest: 1 }, { unique: true, sparse: true })` (or `syncIndexes`) since `autoIndex` is off. Old rows have no digest and are skipped. |

Run `001` (`yarn migrate:reservations-ttl`) first if it was never run on this database.

**Check after migrating:**
```js
db.domainEvents.getIndexes().map((i) => i.name)  // has type_1_idempotencyKey_1_keyed, no type_1_idempotencyKey_1
db.shipments.getIndexes().map((i) => i.name)     // has order_1_seller_1 (unique)
db.paymentEvents.getIndexes().map((i) => i.name) // has signedDigest_1
```

## 4. During and right after the deploy

- [ ] **Expect a short step-up and logout gap.** Access tokens issued before `5c9d5cd` have no `sid`: they get 403 on checkout, account deletion and API-key creation, and logout cannot revoke them, until they expire (`ACCESS_TOKEN_TTL`, 15 min by default). Refresh tokens keep working and pick up a `sid`.
- [ ] **Smoke test:**
  - `GET /api/ready` → 200.
  - Register in an open tenant → 201; register with an unknown `X-Tenant-Id` → 403.
  - Sign in → checkout → pay (provider webhook) → ship → deliver → request refund → `refundStatus: requested`, status still `delivered`.
  - A second refund request → 409.
  - Log out → the old access token gets 401 at once.
  - Open 4 SSE streams as one user → the 4th gets 429.
  - `curl -H 'X-Forwarded-For: 1.2.3.4'` straight at the app (bypassing the proxy) does not change the rate-limit bucket.
  - `GET /api/openapi.json` anonymously → 401.
- [ ] **Watch for 403s on registration** (tenants missing records), **401s on webhooks** (`Unknown payment provider`) and the **`payment.provider_mismatch`** security signal.
- [ ] Check that `inventory.expiry_event_failed` and `domain.event.dispatch_failed` log lines stay at zero.

## 5. Known limits to plan for

- **Single instance assumed.** Rate limits, SSE caps and the checkout lock live in process memory. With N instances each limit is effectively N×. Before scaling out, add Redis-backed rate limiting (`rate-limit-redis`) and locks (`SET key token NX PX`, compare-token delete). `REDIS_URL` currently does **not** switch these on.
- **Refunds need an operator or integration.** `refund.requested` events (stored in `domainEvents`) are the hand-off; the provider's `payment.refunded` webhook completes them. There is no approve/reject API.
- **`pending` domain events are not re-dispatched automatically.** Monitor `db.domainEvents.countDocuments({ status: "pending" })`.
- **One webhook secret for all tenants and providers.** Rotate `WEBHOOK_SECRET` if any provider integration is compromised.

## 6. Rollback

1. Redeploy the previous image and frontend build.
2. The new indexes are compatible with the old code. If you must restore the old shipment behaviour, recreate `db.shipments.createIndex({ order: 1 }, { unique: true })`; this fails if any order already has more than one shipment (check first; do not delete shipments to force it). Leave the domain-event partial index in place: the old sparse index brings SEC-12 back.
3. New order fields (`deliveredAt`, `refundRequestedAt`, `refundReason`), `paymentEvents.signedDigest` and `tenants.config.allowSelfSignup` are ignored by the old code; no data rollback is needed.
4. Orders cancelled after payment on the new code carry `refundStatus: requested`; the old code ignores it, but make sure those refunds are still handled.

## 7. CI and supply chain

- [ ] Push and confirm the workflow runs with the SHA-pinned `actions/checkout@11d5960a…` and `actions/setup-node@49933ea5…` (both `v4.4.0`) and that `yarn audit --groups dependencies --level moderate` passes.
- [ ] Enable Dependabot (`.github/dependabot.yml`: actions + npm, weekly, 7-day cooldown) and review its SHA-bump PRs like code.
- [ ] Build and scan the image: `docker build -t ecommerce-api .` (not run in this remediation because Docker wasn't available).
