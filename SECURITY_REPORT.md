# Security Assessment: E-commerce REST API

**Assessment date:** 2026-10-20
**Scope owner:** repository owner (authorized, local-only testing)
**Commit assessed:** `58ef9d5` (`main`), backend under `src/`
**Status:** assessment complete. P1 findings SEC-12, SEC-01 and SEC-02 are fixed (Section 0); every other finding is still open.

---

## 0. Remediation status (updated 2026-10-20)

| ID | Status | Commit | Regression tests | PoC after the fix |
|---|---|---|---|---|
| SEC-12 | **Fixed** | `fcb0377` | `tests/integration/orders.test.ts`: sweeps every overdue order; keeps sweeping when publishing fails; un-keyed events coexist; every cancellation returns 200 | `sweeper-poc.mjs`: NOT REPRODUCED (8/8 expired orders released, stock 8/8) |
| SEC-01 | **Fixed** | `ddaa73d` | `tests/unit/env.test.ts` (TRUST_PROXY parsing); `tests/integration/trust-proxy.test.ts` (XFF ignored by default, per-account login limit, successes don't count) | `trust-proxy-poc.mjs`: NOT REPRODUCED (rotating XFF: 40/40 got 429; spoofed allowlist IP: 403) |
| SEC-02 | **Fixed** | `5c9d5cd` | `tests/integration/auth.test.ts`, step-up block: forged device id, no or foreign `sid`, risky login on any device, `sid` kept across refresh (including legacy tokens) | `poc.mjs`: NOT REPRODUCED (403 with a random X-Device-Id) |

Each new test was confirmed to fail against the pre-fix code. After all three fixes: typecheck and lint are clean, 152/152 backend tests pass and 8/8 Playwright E2E tests pass.

**What changed**
- **SEC-12:** the unique `{ type, idempotencyKey }` index is now partial (keyed events only) and named `type_1_idempotencyKey_1_keyed`. The reservation sweeper logs a failed `order.cancelled` publish and continues.
- **SEC-01:** a new `TRUST_PROXY` setting drives `trust proxy`. It defaults to `false` and accepts a hop count ≤ 10 or IPs, CIDRs and presets (`loopback`, `linklocal`, `uniquelocal`); `true` is refused. The server now binds to `APP_IP_ADDRESS`. A per-account limiter (`loginAccountLimiter`: 10 failed logins per 15 minutes per email; successes don't count) sits beside the per-IP one.
- **SEC-02:** login and register create the `UserSession` first and sign its id into both tokens as `sid`. Refresh carries `sid` forward, recovering it for pre-fix refresh tokens through the session's `refreshToken` link, and repoints the session at each rotated token. `stepUpAuth` loads exactly that session and **fails closed**. `X-Device-Id` now only names the session row at sign-in.

**Deploy checklist for these fixes**
1. **Run the index migration once per existing database, before or right after deploying `fcb0377`:**
   `DB_URL=… yarn migrate:domain-event-index` (`--dry-run` available). It drops the legacy `type_1_idempotencyKey_1` index and creates the partial one. Production runs with `autoIndex` off and Mongoose never drops indexes, so **SEC-12 stays in effect until this runs.** The script is idempotent.
2. **Set `TRUST_PROXY` wherever a reverse proxy or load balancer fronts the API.** Use its hop count (usually `1`) or its addresses (for example `10.0.0.0/8`). If you leave it unset behind a proxy, every client shares the proxy's IP, so the per-IP limits (auth: 10 per 15 minutes) and `ADMIN_IP_ALLOWLIST` apply to everyone at once. Only set it when *all* traffic reaches the API through that proxy.
3. **Bind address:** `APP_IP_ADDRESS` is now honoured; it defaults to `127.0.0.1`. The Dockerfile sets `0.0.0.0`. Other deployments that relied on the old listen-on-every-interface behaviour must set it explicitly.
4. **Expect a short step-up gap after deploying `5c9d5cd`.** Access tokens issued before the deploy carry no `sid`, so step-up routes (checkout, `DELETE /users/me`, `POST /api-keys`) return 403 for them until the client refreshes. That takes at most `ACCESS_TOKEN_TTL` (15 minutes by default). Refresh tokens keep working.
5. The frontend E2E harness sets `TRUST_PROXY=loopback` (`frontend/e2e/support/backend.mjs`) because its specs use `X-Forwarded-For` for per-test budgets.

## 1. Executive summary

The API has a solid baseline for an Express/Mongoose service:

- JWTs pin the algorithm, issuer and audience, and access and refresh tokens use separate secrets with a `typ` claim.
- Refresh tokens are hashed, rotated and atomically consumed.
- Authorization reads the stored role on every request.
- Order and cart queries are scoped by owner and tenant (no BOLA found).
- Prices come from the database, stock is decremented atomically, and coupon usage is claimed with compare-and-set.
- Payments only move through an HMAC-signed webhook with a timestamp window.
- Mass assignment is blocked by Zod schemas and a role field-allowlist.
- Uploads are checked by type, extension and magic bytes, and are renamed to random UUIDs.

**No critical findings.** We found **13 confirmed issues: 0 High, 8 Medium and 5 Low**, plus 1 Medium dependency issue (multer) and several informational notes. Every High or Critical candidate was either reproduced or downgraded with the reason stated. All Medium findings were reproduced locally (Section 6).

The most important problems:

1. **The app trusts `X-Forwarded-For` from anyone (SEC-01).** `trust proxy 1` is hard-coded, but the Docker image is exposed directly and the repo has no reverse proxy. A client can choose its own IP, which defeats the login brute-force limiter, the `ADMIN_IP_ALLOWLIST`, and the risk score that drives step-up auth.
2. **Step-up auth can be bypassed with any new `X-Device-Id` (SEC-02).** Risky sessions are blocked from checkout, account deletion and API-key creation only for the device id the client itself reports.
3. **One bad database index breaks event publishing (SEC-12).** Only one domain event of each type can ever be stored. Every later cancel, shipment or refund is committed but returns 409. The reservation sweeper then releases only one expired order per pass, so unpaid orders hold stock far longer than intended.
4. **The seller dashboard leaks customer data (SEC-03).** It returns full order documents, including shipping addresses and other sellers' line items.
5. **Unauthenticated requests can grow the metrics store without limit (SEC-04).** Each unknown URL path adds a new metrics key (memory DoS).

## 2. Scope and methodology

| Item | Detail |
|---|---|
| Target | Backend API in `src/`: 53 routes mounted under `/api` and `/api/v1`, plus static `/uploads` |
| Out of scope | Angular `frontend/` (scanned by Semgrep and Gitleaks only), production and staging hosts (never contacted) |
| Environment | Node 24.22.0 on Windows 11. The API ran from source (`tsx`) on `127.0.0.1:5055` against `mongodb-memory-server` (single-node replica set), with random per-run secrets and `NODE_ENV=development`. |
| Test accounts | Seeded through the API by `security-tests/harness.mjs`: 1 admin, 1 seller and 2 normal users (alice, bob), all `@poc.test` with throwaway passwords, in an in-memory database that is deleted after each run. |
| Network | Every request went to `127.0.0.1`. `X-Forwarded-For` values use documentation IP ranges and were only ever sent as headers to localhost. Tool downloads (pip/uv, Semgrep rule packs, the Gitleaks release) were the only outbound traffic, as approved. |

**Phases**
1. **Inventory.** We listed every route with its middleware chain (Appendix A).
2. **Automated scanning.**
   - `yarn audit` (the repo uses a yarn lockfile, so this replaces `npm audit`).
   - Semgrep 1.181.0 with `p/javascript`, `p/typescript`, `p/nodejs`, `p/expressjs`, `p/jwt`, `p/secrets` and `p/owasp-top-ten`. It ran in WSL Ubuntu 22.04, because `semgrep-core` cannot create the `socketpair` it needs on native Windows. It scanned 396 files with 0 errors.
   - Gitleaks 8.30.1 over the full git history (65 commits) and the working tree.
   - `eslint-plugin-security` (recommended rules) over `src/` and `scripts/`, using a temporary config outside the repo.
   - We triaged every result (Section 5).
3. **Manual review** of all routes, middlewares, controllers, services, repositories and models against the OWASP API Security Top 10 (2023).
4. **Dynamic verification.** We wrote PoCs in `security-tests/` and ran them locally. Findings we could not reproduce were dropped or downgraded.
5. **This report.**

**How to reproduce** (from the repo root):
- `node security-tests/trust-proxy-poc.mjs`: SEC-01 and SEC-01b against the default configuration
- `node security-tests/poc.mjs` (about 1 minute): SEC-02 to SEC-11
- `node security-tests/sweeper-poc.mjs` (about 1.5 minutes): SEC-12

The findings and evidence below describe the code **as assessed at `58ef9d5`**. For what has been fixed since, see Section 0.

## 3. Findings summary

Severity follows the CVSS 3.1 base score. Where the context changes the practical risk, a note in the finding's details says why.

| ID | Title | Severity | CVSS 3.1 | OWASP API 2023 | CWE | Location | Status |
|---|---|---|---|---|---|---|---|
| SEC-01 | `X-Forwarded-For` trusted from any client: bypasses rate limits, admin IP allowlist and risk scoring | Medium | 6.5 `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N` | API8 Misconfiguration, API4 | CWE-348, CWE-307 | `src/server.ts:91`, `src/middlewares/adminNetworkPolicy.ts:12`, `src/middlewares/rateLimiters.ts:5-21`, `src/services/securityService.ts:31-36` | **Fixed** (`ddaa73d`) |
| SEC-12 | Domain-event unique index allows one event per type; later actions return 409 after committing, and the reservation sweeper stalls | Medium | 5.4 `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L` | API6 Sensitive business flows, API4 | CWE-754, CWE-400 | `src/models/domainEvent.ts:35`, `src/infra/events/eventBus.ts:19`, `src/services/inventoryService.ts:82` | **Fixed** (`fcb0377`) |
| SEC-02 | Step-up auth bypass with a client-chosen `X-Device-Id` | Medium | 5.4 `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N` | API2 Broken authentication | CWE-290 | `src/services/securityService.ts:26-27`, `src/middlewares/stepUpAuth.ts:18` | **Fixed** (`5c9d5cd`) |
| SEC-04 | Unbounded metrics cardinality from unauthenticated 404 paths (memory DoS) | Medium | 5.3 `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` | API4 Unrestricted resource consumption | CWE-770 | `src/observability/metrics.ts:24-37` | Confirmed (PoC) |
| SEC-07 | Users pick their own tenant at registration (`X-Tenant-Id`) | Medium (design-dependent) | 5.3 `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` | API1/API5 (tenant isolation) | CWE-639 | `src/middlewares/tenantContext.ts:5-8`, `src/controllers/auth/registerControllers.ts:26` | Confirmed (PoC) |
| SEC-03 | Seller dashboard exposes customer PII and other sellers' line items | Medium | 4.3 `AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N` | API3 Broken object property level authorization | CWE-213 | `src/controllers/sellerController.ts:19-21,39` | Confirmed (PoC) |
| SEC-05 | Order state machine gaps: refunds requested on any paid order (even delivered); cancelling a paid order issues no refund | Medium | 4.3 `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N` | API6 Sensitive business flows | CWE-841 | `src/services/OrderService.ts:221-252`, `src/controllers/shipmentController.ts:26` | Confirmed (PoC) |
| SEC-06 | No limit on concurrent SSE streams per user | Medium | 4.3 `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L` | API4 | CWE-770 | `src/controllers/platformController.ts:173-185` | Confirmed (PoC) |
| SEC-09 | Account enumeration (409 on register, login timing) | Low (CVSS 5.3) | 5.3 `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N` | API2 | CWE-204, CWE-208 | `src/services/AuthService.ts:47-50,71-75` | Confirmed (PoC) |
| SEC-10 | Client-controlled `X-Request-Id` / `X-Correlation-Id` used unvalidated in logs and audit trail | Low (CVSS 5.3) | 5.3 `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N` | API8, logging | CWE-117 | `src/utils/requestContext.ts:7-8`, `src/server.ts:124` | Confirmed (PoC) |
| SEC-11 | Webhook event id and provider are outside the HMAC, so the deduplication key can be changed | Low | 3.7 `AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:N` | API10 Unsafe consumption of APIs | CWE-345 | `src/utils/webhook.ts:5-6`, `src/controllers/paymentController.ts:17-20`, `src/services/PaymentService.ts:71` | Confirmed (PoC) |
| SEC-13 | `DEBUG_MODE=true` is accepted in production (stack traces in 5xx responses) | Low | 3.7 `AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N` | API8 | CWE-209 | `src/config/env.schema.ts:39`, `src/middlewares/errorHandler.ts:68-70` | Confirmed (code review) |
| SEC-08 | A seller with one item in a multi-seller order controls the whole order's fulfilment status | Low | 2.7 `AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:L/A:N` | API5 Broken function level authorization | CWE-285 | `src/controllers/shipmentController.ts:44-57` | Confirmed (PoC) |
| DEP-01 | multer 2.1.1: DoS advisories (fixed in 2.2.0 and 2.3.0); upload routes need a seller or admin account | Medium (advisory says High) | 6.5 `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:H` | API8 / vulnerable components | CWE-400 | `package.json:40`, `src/controllers/productsContollers/productContoller.ts:26-36` | Confirmed (version); PoC not run |
| SEC-14 | CI uses mutable action tags (`@v4`) | Low | n/a (supply chain) | n/a | CWE-829 | `.github/workflows/ci.yml:11-12` | Confirmed (Semgrep) |

Informational notes (no score) are in Section 4.15.

## 4. Finding details

### SEC-01: `X-Forwarded-For` trusted from any client (Medium, 6.5)

**Code**
```ts
// src/server.ts:91
app.set("trust proxy", 1);
// src/server.ts:74: binds every interface; APP_IP_ADDRESS is only used in the log line
const httpServer = app.listen(APP_PORT, () => console.log(`[+] Listening on http://${APP_IP_ADDRESS}:${APP_PORT}/`));
```
```ts
// src/middlewares/adminNetworkPolicy.ts:12
const ip = req.ip?.replace("::ffff:", "") ?? "";
```
`express-rate-limit` keys on `req.ip` (`rateLimiters.ts:5-14`), and so does the failed-login count behind step-up risk (`securityService.ts:31-36`).

With `trust proxy 1`, `req.ip` is the last `X-Forwarded-For` entry. That is correct only when exactly one trusted proxy always overwrites the header. The `Dockerfile` publishes port 5000 directly (`EXPOSE 5000`), the repo has no reverse proxy, and the server binds every interface. In that deployment any client chooses its own `req.ip`.

**Impact:** unlimited password guessing (the `authLimiter` allows 10 attempts per 15 minutes per IP), bypass of `ADMIN_IP_ALLOWLIST`, step-up risk that is never raised (the failure count is per IP), and bypass of every other limiter (checkout, coupon, review, general). The README's backend gap #11 already notes this.

**PoC** (originally in `poc.mjs`; now `security-tests/trust-proxy-poc.mjs`), result at `58ef9d5`:
```
same XFF: 2/12 got 429; rotating XFF: 40 attempts, 0 got 429 (all 401)
allowlist=203.0.113.7; other XFF -> 403, spoofed XFF 203.0.113.7 -> 200
```
Equivalent curl:
```bash
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code}\n" -H "X-Forwarded-For: 192.0.2.$i" -H 'Content-Type: application/json' -d '{"email":"alice@poc.test","password":"guess'$i'"}' http://127.0.0.1:5055/api/v1/login; done
```

**Fix:** make the trust setting configuration-driven, default it to off, and document it.
```ts
// env.schema.ts
TRUST_PROXY: z.string().default("false"), // "false" | hop count | "loopback, 10.0.0.0/8"
// server.ts
const trust = env.TRUST_PROXY === "false" ? false : /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY;
app.set("trust proxy", trust);
app.listen(APP_PORT, APP_IP_ADDRESS, ...); // honour the configured bind address
```
Also key the login limiter on IP plus normalized email (or add per-account lockout or backoff), so a spoofed IP alone cannot reset the budget.

---

### SEC-12: One domain event per type; later actions fail after committing, and the sweeper stalls (Medium, 5.4)

**Code**
```ts
// src/models/domainEvent.ts:35
domainEventSchema.index({ type: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
```
A *compound* sparse index skips a document only when **all** of its indexed fields are missing. `type` is always set, so every event without an `idempotencyKey` is indexed as `(type, null)`. No caller passes `idempotencyKey` (`eventBus.ts:19-28`). As a result, the second event of any type throws E11000.

The callers publish after their state change has committed:
- `OrderService.cancel`: `:239`, after the transaction commits
- `requestRefund`: `:251`, after `order.save()`
- `shipmentController`: `:60`, after `order.save()` at `:57`
- `releaseExpiredReservations`: `inventoryService.ts:82`, inside the loop with no catch

**Impact**
- **Wrong error for committed changes.** From the second cancellation, shipment update or refund request in the whole database onward, the user receives `409 Duplicate value for type, idempotencyKey` although the change was saved. Clients that retry or show an error make the problem worse.
- **Lost side effects.** `afterCheckout` swallows the error, so only the first checkout ever writes `inventory.reserved`, `order.created` and so on. All later ones lose their events silently, which breaks the outbox and saga trail.
- **Stock held hostage.** The reservation sweeper throws on the first expired order in each pass, so it releases **at most one expired order per sweep** (default every 60 s). Any user (or several, especially with SEC-01) can create unpaid orders faster than one per minute and keep stock locked long after the 15-minute payment window.

**PoC**
- `security-tests/poc.mjs`: the SEC-05 and SEC-08 evidence lines show the 409 after a committed save. A local debug run also showed that the second user's cancel returns 409 while the stored status is `cancelled`.
- `security-tests/sweeper-poc.mjs` (1-minute reservations, 5-second sweeps):
```
8 unpaid orders hold all stock; stock now 0
CONFIRMED  SEC-12  sweeper stalls after the first expiry
    76 s after checkout (≈3 sweeps past expiry): 4/8 expired orders cancelled; stock=4/8
```

**Fix:** use a partial index so only keyed events are unique, and keep the sweeper loop resilient.
```ts
domainEventSchema.index(
  { type: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
```
The existing index also has to be dropped and rebuilt (a migration, or `syncIndexes()`). In `releaseExpiredReservations`, wrap the per-order `publishEvent` in `try/catch` and log the error, so one failure cannot abort the batch.

---

### SEC-02: Step-up auth bypass with a fresh `X-Device-Id` (Medium, 5.4)

**Code**
```ts
// src/services/securityService.ts:26-27
export const deviceIdFor = (req) =>
  req.get("X-Device-Id") || crypto.createHash("sha256").update(`${req.get("user-agent") || "unknown"}:${req.ip}`).digest("hex");
// src/middlewares/stepUpAuth.ts:18
const session = await UserSession.findOne({ user: req.user._id, deviceId: deviceIdFor(req), revokedAt: { $exists: false } })
```
At login the session is flagged `stepUpRequired` (5 or more failed logins from that IP in 30 minutes) and stored under the device id the client reported. `stepUpAuth` looks the session up by the device id on the *current* request. Any other value finds no session, `stepUpRequired` becomes `false`, and the request passes. A missing session means "not risky": the check fails open.

**Impact:** an attacker with stolen credentials whose login was flagged as risky can still complete checkout (`/orders/checkout`), delete the account (`DELETE /users/me`), or, as an admin, mint API keys (`POST /api-keys`).

**PoC** (SEC-02):
```
login step_up_required=true; checkout same device -> 403 (Step-up authentication required); with random X-Device-Id -> 201 (Order created)
```

**Fix:** bind the step-up state to the token, not to a header. Put the session id in the access token (`sid` claim) at login and refresh. `stepUpAuth` then loads `UserSession` by `sid` and the user, and **fails closed** when it finds nothing.
```ts
const session = await UserSession.findOne({ _id: claims.sid, user: req.user._id, revokedAt: { $exists: false } });
if (!session || session.stepUpRequired) return next(CustomeErrorHandler.forbidden("Step-up authentication required"));
```

---

### SEC-04: Unbounded metrics cardinality (Medium, 5.3)

**Code**
```ts
// src/observability/metrics.ts:24-37
const keyFor = (req, statusCode) => {
  const route = req.route as { path?: string } | undefined;
  return `${req.method} ${route?.path || req.path} ${statusCode}`;   // raw path for unmatched routes
};
metrics.requests[key] = (metrics.requests[key] || 0) + 1;
const stats = (metrics.latency[key] ??= { count: 0, totalMs: 0, maxMs: 0 });
```
For 404s (no `req.route`), the key is the raw request path. Every distinct URL creates a permanent entry in two in-process maps, and nothing ever evicts them.

**Impact:** anonymous memory growth until the process runs out of memory, and a `/metrics` and Prometheus output that grows without bound. The general limiter (300 per 15 minutes per IP) slows this down only while SEC-01 is fixed.

**PoC** (SEC-04):
```
metrics.requests keys 12 -> 1513; 1500 new keys of ~2 KB each from 1500 anonymous requests (also in latency map)
```

**Fix:** never key on raw paths.
```ts
const keyFor = (req, statusCode) => `${req.method} ${(req.route?.path && `${req.baseUrl}${req.route.path}`) || "unmatched"} ${statusCode}`;
```

---

### SEC-07: Users pick their own tenant at registration (Medium, design-dependent)

**Code**
```ts
// src/middlewares/tenantContext.ts:5-8: any client value
const tenant = String(req.get("X-Tenant-Id") || DEFAULT_TENANT).toLowerCase().trim();
// src/controllers/auth/registerControllers.ts:26
tenant: req.tenant,
```
After login, `auth.ts:34` pins `req.tenant` to `user.tenant`, so a user cannot switch tenants later. However, anyone can register *into* any tenant key, including keys that don't exist yet (creating an implicit tenant). Tenants are never checked for existence or `status: "suspended"`.

**Impact:** if tenants are meant to be private stores or B2B tenants, an outsider becomes a member. They can read `GET /tenant`, buy from that tenant, redeem its coupons, and, with a seller or admin role granted later, act in it. If every tenant is meant to be a public storefront, this is acceptable, and only the missing existence and suspension check remains.

**PoC** (SEC-07): `registered with X-Tenant-Id: victim-corp -> user.tenant=victim-corp`.

**Fix:** resolve the tenant against `Tenant` (it must exist and be `active`), and decide whether self-sign-up is allowed per tenant (for example `config.allowSelfSignup`). Otherwise derive the tenant from the hostname or an invitation.

---

### SEC-03: Seller dashboard exposes customer PII and other sellers' line items (Medium, 4.3)

**Code**
```ts
// src/controllers/sellerController.ts:19-21, returned whole at :39
const orders = await Order.find({ tenant: req.tenant, "items.product": { $in: productIds } }).sort("-createdAt").limit(50);
...
recentOrders: orders,
```
Any order containing one of the seller's products is returned in full: customer `user` id, `shippingAddress`, totals, coupon, payment status and history, and **every** line item, including other sellers' products and prices.

**PoC** (SEC-03):
```
seller sees order …: user=…, shippingAddress.line1="alice's home, 1 Private Lane", total=35, foreign item "Admin Lamp"
```

**Fix:** project the response and filter items to the seller's own.
```ts
const orders = await Order.find(filter).select("_id status paymentStatus createdAt items shippingAddress.city shippingAddress.country").lean();
recentOrders: orders.map((o) => ({ ...o, items: o.items.filter((i) => ownIds.has(String(i.product))) })),
```
If sellers need to ship, expose the full address only for orders they are actually fulfilling, through a dedicated endpoint.

---

### SEC-05: Order state machine gaps for refunds and cancellation (Medium, 4.3)

**Code**
```ts
// src/services/OrderService.ts:243-249
if (order.paymentStatus !== "paid") throw CustomeErrorHandler.badRequest("Only paid orders can be refunded");
order.status = "refund_requested";      // overwrites delivered/shipped/cancelled
order.refundStatus = "requested";
await order.save();
```
```ts
// src/services/OrderService.ts:34 + 221-236: a paid "confirmed" order can be cancelled; stock is released,
// but paymentStatus stays "paid" and no refund is requested or recorded.
const CANCELLABLE_STATUSES = ["pending", "confirmed"];
```
`refund_requested` also has no rank in `FULFILMENT_RANK` (`shipmentController.ts:26`) and appears in neither `SHIPPABLE_STATUSES` nor the review-eligibility list. A refund request therefore silently erases the fulfilment state: there is no refund window, no "already refunded" check and no relationship to shipping.

**Impact**
- A customer can move a delivered order to `refund_requested` at any time, which disrupts operations and reporting.
- A paid order that the customer cancels returns its stock while the money stays captured, with nothing to reconcile it.

**PoC** (SEC-05, SEC-05b):
```
status before=delivered; refund -> 200 status=refund_requested
cancel -> 200 status=cancelled paymentStatus=paid refundStatus=none
```

**Fix:** use an explicit transition table for `status`, like the one that already exists for `paymentStatus` (`paymentStateMachine.ts`). Allow `refund_requested` only from `delivered`, within a configured window, and only when `refundStatus === "none"`. Keep the fulfilment status in its own field. When a paid order is cancelled, set `refundStatus = "requested"` and publish `refund.requested` (or block cancellation of paid orders and route the customer to a refund instead).

---

### SEC-06: No limit on concurrent SSE streams (Medium, 4.3)

**Code:** `src/controllers/platformController.ts:173-185` keeps one socket and one interval per request, with no per-user or global cap and no maximum lifetime. Only `auth` guards the route; `sensitiveLimiter` does not apply to it.

**PoC** (SEC-06): `60/60 concurrent streams accepted for one user`.

**Fix:** count open streams per user (for example a `Map<userId, number>`, Redis when multi-instance), reject above a small cap (such as 3) with 429, and close streams after a maximum lifetime.

---

### SEC-09: Account enumeration (Low; CVSS 5.3)

**Code**
- `AuthService.ts:47-50` returns `409 "This email is already taken."`.
- `AuthService.ts:71-75` returns before `bcrypt.compare` when the email is unknown, so a valid email is measurably slower to reject.

**PoC** (SEC-09): `register existing email -> 409`; median login time was 7.3 ms for a known email versus 5.8 ms for an unknown one at `BCRYPT_ROUNDS=4`. At the default of 12 the gap is around 200 ms or more.

**Severity note:** practical risk is Low (common in e-commerce), but enumeration combined with SEC-01 makes credential stuffing cheaper.

**Fix:** compare against a fixed dummy hash when the user is missing (`await bcrypt.compare(password, DUMMY_HASH)`). For register, return a generic 202 ("check your email"), or accept the trade-off and rely on rate limiting.

---

### SEC-10: Unvalidated client request and correlation ids (Low; CVSS 5.3)

**Code:** `src/utils/requestContext.ts:7-8` accepts any `X-Request-Id` and `X-Correlation-Id` (up to Node's 16 KB header limit). They are echoed back, written to `logs/access.log` (`server.ts:124`), and stored in audit records and domain events (`eventBus.ts:25-26`).

**PoC** (SEC-10): a 4 KB `X-Request-Id` was echoed back and used as the request id.

**Severity note:** Node rejects CR/LF in header values, so this is not header or log-line injection. The impact is forged or colliding correlation ids in the audit trail, plus log bloat.

**Fix:**
```ts
const safeId = (v?: string) => (v && /^[A-Za-z0-9._:-]{1,128}$/.test(v) ? v : undefined);
const requestId = safeId(headerValue(req.headers["x-request-id"])) || crypto.randomUUID();
```
Accept client ids only from trusted callers, and always generate an internal id as well.

---

### SEC-11: Webhook dedupe key is outside the signature (Low, 3.7)

**Code:** the signature covers only `${timestamp}.${rawBody}` (`webhook.ts:5-6`). Deduplication uses the unsigned `X-Payment-Provider` and `X-Webhook-Event-Id` headers (`PaymentService.ts:62-71`).

**Impact:** whoever obtains a signed webhook (a proxy log, a misrouted retry) can replay it within the 5-minute window under new event ids. The payment state machine limits the damage: a transition to the same state is a no-op, and `paid→failed` is refused. In this run the replay was accepted (200) and processed again as a new event instead of being reported as a replay. Any side effects that are not idempotent would run twice.

**PoC** (SEC-11): `same signed body with new event id/provider -> 200 processed again`.

**Fix:** include the event id (and provider) in the signed string, or deduplicate on `payloadHash` plus timestamp. Reject events whose body `orderId` belongs to a different tenant than the provider account (multi-tenant).

---

### SEC-13: `DEBUG_MODE` accepted in production (Low, 3.7)

**Code:** `env.schema.ts:39` (`DEBUG_MODE: bool(false)`). No production guard exists alongside the secret checks (`env.schema.ts:91-120`). `errorHandler.ts:68-70` puts `stack` in 5xx response bodies. The `.env.example` comment warns against it, but nothing enforces the warning.

**Fix:** in `parseEnv`, add `if (isProduction && env.DEBUG_MODE) problems.push("DEBUG_MODE: must be false in production")`.

---

### SEC-08: Seller controls a multi-seller order's fulfilment (Low, 2.7)

**Code:** `shipmentController.ts:44-48` only requires that the order contain *some* item from the seller. The seller can then upsert the single shipment for the whole order and move it to `delivered` (`:54-57`), which overwrites another seller's tracking information.

**PoC** (SEC-08): the order containing the admin's "Admin Lamp" became `status=delivered` after the seller's update. In the suite run the response was 409 because of SEC-12, but the change had already been saved.

**Fix:** create one shipment per seller (`{ order, seller }`), and derive the order status from all of its shipments.

---

### DEP-01: multer 2.1.1 DoS advisories (Medium; advisory says High)

`yarn audit` reports 3 High advisories:
- DoS via nested field names (fixed in 2.2.0)
- crafted field names and oversized array index (fixed in 2.3.0)

There is also 1 Moderate (cleanup of aborted uploads) and 1 Low (`fileFilter` size bypass). The parser runs on `POST /products` and `PUT /products/:id` (`productContoller.ts:26-36`). On those routes `auth` and `sellerOrAdmin` run **before** multer (`modules/catalog/routes.ts`), so an attacker needs a seller or admin account. We downgraded this to Medium (`PR:L`). No PoC was run (DoS against the parser). **Fix:** bump to `multer@^2.3.0`.

---

### SEC-14: Mutable GitHub Action tags (Low)

`.github/workflows/ci.yml:11-12` uses `actions/checkout@v4` and `actions/setup-node@v4`. If a tag is moved, CI runs different code. **Fix:** pin to commit SHAs (Dependabot can keep them current).

---

### 4.15 Informational notes (evidence-based, no score)

- **I-1: Rate limits and locks are per process.** `rateLimiters.ts` uses the default in-memory store; `REDIS_URL` only sets a label (`redisClient.ts:6`). `withDistributedLock` is a process-local `Map` (`infra/locks/distributedLock.ts:3`). With more than one instance, every limit multiplies and the per-user checkout lock no longer serializes requests. The coupon `perUserLimit` check (`couponService.ts:36-37`) is a count-then-insert that depends on that lock; within one process it is safe.
- **I-2: `/uploads` is public, and signed URLs are never enforced.** `server.ts:139-146` serves the folder statically. `/platform/signed-url` and `/platform/validate-signed-url` exist, but nothing checks them. This is fine for product images; don't store private files there.
- **I-3: The SSRF guard is incomplete but unreachable.** `utils/ssrf.ts` misses IPv6 private ranges, decimal or octal IPs, and DNS rebinding. However, `trackingUrl` is only stored, and the only outbound `fetch` (`infra/serviceClient.ts:34`) has no callers. Harden the guard before adding any URL fetching.
- **I-4: `GET /openapi.json` is public.** It is useful for clients, but it documents admin and internal routes. Consider limiting it to non-production environments or to admins.
- **I-5: `sanitizeInput` strips `<`/`>` from all strings** (`sanitizeInput.ts:5`). This is not a security boundary (output encoding is), and it silently corrupts data such as product descriptions. Keep it if you like, but don't rely on it.
- **I-6: Logout revokes only the refresh token.** Access tokens stay valid until their 15-minute TTL ends. Account deletion does revoke access immediately, because `auth.ts:20` requires an active user.
- **I-7: `/internal/events` (service JWT) takes its tenant from `X-Tenant-Id`.** Any service holding the `events:read` scope can read any tenant's events. This is acceptable if all services are trusted; otherwise add a tenant claim.

Things we checked that were **not** vulnerable (for the record):
- BOLA on orders, cart and wishlist: all queries are owner- and tenant-scoped.
- Mass assignment on users and products: Zod schemas plus `pickAllowedFields`.
- JWT `alg` confusion: the algorithm is pinned to HS256 and secrets are distinct.
- Refresh-token reuse: tokens are consumed atomically.
- NoSQL operator injection: `$` and dotted keys are rejected, and ids are validated.
- Path traversal on upload names: names are random UUIDs.
- Price and quantity tampering: prices come from the database, quantities are limited to 1–999, and stock decrements are atomic.
- Coupon overuse: the usage claim is compare-and-set.
- Webhook forgery: HMAC with constant-time comparison and a ±300 s window.
- CORS: the origin must be on the allowlist in production.
- Prototype pollution: `__proto__` keys only change the prototype of that single parsed object, and Zod strips them.

## 5. Automated scan triage

### 5.1 Dependencies (`yarn audit`)

| Package (installed) | Advisory | Advisory severity | Fixed in | Reachable here? | Verdict |
|---|---|---|---|---|---|
| proxy-addr 2.0.7 | IPv4-mapped IPv6 address bypasses trust-subnet matching | Critical | 2.0.8 | No. `trust proxy` is a hop count (`1`), not a subnet list, so the subnet matcher is never used. | **False positive** (upgrade anyway via express) |
| multer 2.1.1 | Nested field names cause DoS | High | 2.2.0 | Yes, but only for authenticated sellers and admins | **Confirmed → DEP-01 (Medium)** |
| multer 2.1.1 | Crafted field names / oversized array index (×2) | High | 2.3.0 | Same as above | **Confirmed → DEP-01** |
| multer 2.1.1 | Aborted uploads leave files behind | Moderate | 2.2.0 | Yes, but only for sellers and admins | Confirmed (part of DEP-01) |
| multer 2.1.1 | `fileFilter` size bypass | Low | 2.3.0 | `limits.fileSize` is set, and magic-byte checks follow | Needs-manual-check (low) |
| qs 6.15.1 (via express, body-parser) | `stringify` DoS; `arrayLimit` bypass; `isBuffer` DoS | Moderate ×3 | 6.16.0 | The app never calls `stringify`. `parse` handles query strings; `urlencoded` runs with `extended: false`, which doesn't use qs. `arrayLimit` bypass applies to query parsing (`preventParameterPollution` rejects arrays except `category`). | Needs-manual-check, low impact; upgrade |
| mongoose 8.24.0 | Prototype pollution through `__proto__` dotted paths in updates | Moderate | 8.24.1 | `sanitizeNoSql` rejects every key containing `.` or starting with `$`, and no update path is built from user keys except `tenantController.ts:34`, which uses fixed Zod keys | **False positive (mitigated)**; upgrade |
| body-parser 1.20.5 | An invalid `limit` disables size enforcement | Low | 1.20.6 | `REQUEST_BODY_LIMIT` defaults to `100kb` but isn't format-validated (`env.schema.ts:49`, any non-empty string) | Needs-manual-check: validate the format, and upgrade |

**Totals:** 1 critical, 3 high, 8 moderate and 2 low. After triage: 1 Medium (DEP-01), with the rest mitigated or low. A single upgrade covers all of them: `express@^4.22` (which pulls in proxy-addr 2.0.8, qs 6.16 and body-parser 1.20.6), `multer@^2.3.0` and `mongoose@^8.24.1`.

### 5.2 Semgrep (7 rule packs, 396 files, 0 errors)

| Rule | Location | Verdict |
|---|---|---|
| `github-actions-mutable-action-tag` | `.github/workflows/ci.yml:11` | Confirmed → SEC-14 |
| `github-actions-mutable-action-tag` | `.github/workflows/ci.yml:12` | Confirmed → SEC-14 |

None of the 7 community packs matched anything in `src/`. That is consistent with the manual review: the problems in this code are logic and configuration issues, not sink patterns.

### 5.3 Gitleaks (65 commits plus the working tree)

| Hit | Location | Verdict |
|---|---|---|
| generic-api-key | `tests/integration/auth.test.ts:132` | False positive: an `Idempotency-Key` test string |
| generic-api-key | `tests/integration/idempotency.test.ts:48` | False positive: same kind of string |
| generic-api-key | `frontend/e2e/.seed.json:36` (working tree only) | False positive: a random per-run webhook secret for the in-memory E2E database. The file is git-ignored and was never committed. |

A manual history check found that `.env.example` (commits `ac01b8c` and `9384231`) contained only placeholder values (for example `repl****cret`). These placeholders are now on a denylist in `env.schema.ts:10-21`. **No real secrets were found anywhere in the history.**

### 5.4 eslint-plugin-security (235 files, 32 hits)

| Rule | Location(s) | Verdict and reason |
|---|---|---|
| detect-object-injection | `config/env.schema.ts:96,103,111,117,119` | False positive: keys come from the constant `SECRET_KEYS` |
| detect-object-injection | `controllers/platformController.ts:37` | False positive: index is `mongoose.connection.readyState` (a number) |
| detect-object-injection | `controllers/shipmentController.ts:55` | False positive: `value.status` is a Zod enum, and the table is a constant |
| detect-object-injection | `middlewares/sanitizeInput.ts:15` | False positive: writes back the object's own keys (`Object.entries`); `__proto__` only changes that object's prototype |
| detect-object-injection | `middlewares/validateObjectId.ts:8` | False positive: `paramName` is a route-definition constant |
| detect-object-injection | `observability/metrics.ts:31(×2),32,36(×2),40` | **Confirmed (different issue):** not injection (keys contain spaces and can never equal `__proto__`), but the keys are attacker-controlled and unbounded → SEC-04. Line 40 (`queueLag[queueName]`) is a false positive (internal names). |
| detect-object-injection | `plugins/registry.ts:16,19` | False positive: guarded by `Object.hasOwn(registry, type)` |
| detect-object-injection | `services/PaymentService.ts:85` | False positive: `type` is a Zod enum |
| detect-object-injection | `services/paymentStateMachine.ts:14` | False positive: `from` is the stored enum value, and `?.` handles unknown values |
| detect-object-injection | `services/ProductService.ts:76(×2)` | False positive: keys come from the constant `LIST_QUERY_KEYS` |
| detect-object-injection | `shared/errors/AppError.ts:28` | False positive: numeric status code into a constant table |
| detect-object-injection | `utils/fieldPolicy.ts:17(×2)` | False positive: `resource` is a typed constant; `role` comes from the database enum and falls back to `[]` |
| detect-unsafe-regex | `controllers/platformController.ts:133` `^\/uploads(\/[\w.-]+)*$` | False positive: each repetition must start with `/`, which `[\w.-]` cannot match, so there is no ambiguous backtracking. Checked with 50 KB inputs; time stays linear. |
| detect-non-literal-regexp | `services/ProductService.ts:105` | False positive: input is capped at 100 characters and every regex metacharacter is escaped before `new RegExp` |
| detect-non-literal-fs-filename | `productContoller.ts:40,48` | False positive: paths come from multer (`uploads/<uuid>.<ext>`), never from the request |
| detect-non-literal-fs-filename | `utils/auditLogger.ts:11,12,28` | False positive: `process.cwd()/logs/audit.log` |
| detect-non-literal-fs-filename | `scripts/check-syntax.js:10` | False positive: a developer script that walks the repo |

## 6. Proof-of-concept index (`security-tests/`)

| File | Covers | How to run |
|---|---|---|
| `harness.mjs` | Starts the API on `127.0.0.1:5055` with an in-memory MongoDB replica set and random secrets; seeds admin, seller, alice and bob; cleans up the uploads it created. By default it sets `TRUST_PROXY=loopback`, so each request's `X-Forwarded-For` gets its own rate-limit budget. `startHarness({ trustProxy: false })` tests the default configuration. | imported by the scripts below |
| `trust-proxy-poc.mjs` | SEC-01, 01b (default configuration) | `node security-tests/trust-proxy-poc.mjs` |
| `poc.mjs` | SEC-02, 03, 04, 05, 05b, 06, 07, 08, 09, 10, 11 | `node security-tests/poc.mjs` |
| `sweeper-poc.mjs` | SEC-12 (sweeper stall) | `node security-tests/sweeper-poc.mjs` |

Run at `58ef9d5`: every check printed `CONFIRMED` (SEC-08 was confirmed by its stored state; its 409 response is caused by SEC-12). The scripts are standalone and depend only on the backend's existing dev dependencies (`mongodb-memory-server`, `mongodb`, `tsx`). They change nothing outside the in-memory database, apart from temporary files in `uploads/`, which they remove.

## 7. Hardening recommendations (beyond the findings)

1. **Ship the proxy you assume.** Either add a reverse proxy (nginx or Caddy) to the deployment docs and `docker-compose`, or set `TRUST_PROXY=false` by default (SEC-01). Bind to `APP_IP_ADDRESS`.
2. **Move shared state to Redis when you run more than one instance:** rate-limit store (`rate-limit-redis`), distributed lock (`SET NX PX` with a token), SSE connection counts and metrics (I-1).
3. **Put a real second factor behind step-up.** Today step-up can only block a request, never verify the user. The `mfaEnabled` and `mfaVerifiedAt` fields already exist on `User` (`models/user.ts:14-15`).
4. **Validate all environment strings:** `REQUEST_BODY_LIMIT` (bytes format), `DEBUG_MODE` in production (SEC-13), `CORS_ORIGIN` entries as URLs.
5. **Treat domain events as an outbox.** Write them in the same transaction as the state change, with an idempotency key, and add an index migration test (SEC-12).
6. **Add response DTOs.** Several handlers return whole Mongoose documents (sellers, orders, users). A shared projection layer prevents the next SEC-03.
7. **Add dependency hygiene to CI:** run `yarn audit --groups dependencies` (fail on high), enable Dependabot or Renovate, and pin action SHAs (SEC-14).
8. **Log rotation and size limits** for `logs/access.log` and `logs/audit.log`, which grow unbounded today.

## 8. Prioritized remediation plan

| Priority | Item | Effort | Why first |
|---|---|---|---|
| P1 | SEC-12: fix the domain-event index (partial index plus migration) and make the sweeper loop resilient | S | Breaks real user flows today (the second cancel ever returns 409) and lets stock be held hostage |
| P1 | SEC-01: configurable `trust proxy` (default off), bind address, account-keyed login limiter | S–M | Undermines every IP-based control (rate limits, admin allowlist, risk scoring) |
| P1 | SEC-02: tie step-up to the token's session id and fail closed | S | Authentication-control bypass |
| P2 | SEC-03: project and filter the seller dashboard | S | Customer PII exposure |
| P2 | SEC-04: route-template metric keys | XS | Anonymous memory DoS |
| P2 | DEP-01 and the other dependency upgrades (multer 2.3, mongoose 8.24.1, express 4.22) | XS | Known CVEs, low effort |
| P2 | SEC-05: order status transition table, refund rules, refund on paid cancel | M | Business-logic integrity |
| P3 | SEC-06: SSE caps · SEC-07: tenant existence/sign-up policy (needs a product decision) · SEC-08: per-seller shipments | S–M | Hardening and design |
| P4 | SEC-09, SEC-10, SEC-11, SEC-13, SEC-14, I-1 … I-7 | XS–S | Low risk; batch together |

Each fix should come with a regression test, preferably reusing the matching PoC as a Vitest or Supertest case in `tests/`.

---

## Appendix A: Endpoint inventory

All routes are mounted under both `/api` and `/api/v1` (`src/server.ts:137-138`). Global middleware, in order:
1. requestContext
2. tenantContext
3. metrics
4. helmet
5. preventParameterPollution
6. cors
7. urlencoded/json (`REQUEST_BODY_LIMIT`)
8. sanitizeInput
9. sanitizeNoSql
10. generalLimiter (300 per 15 min)
11. access log

| Method & path | Guards | Notes |
|---|---|---|
| POST `/register`, `/login`, `/refresh` | authLimiter | SEC-01, SEC-07, SEC-09 |
| GET `/users`, `/users/export` | auth | owner-scoped |
| DELETE `/users/me` | auth, sensitiveLimiter, stepUpAuth | SEC-02 |
| POST `/logout` | auth, sensitiveLimiter | I-6 |
| GET/POST/PUT/DELETE `/cart`, `/cart/items[/:productId]` | auth, sensitiveLimiter | owner- and tenant-scoped |
| POST `/products`, PUT `/products/:id` | auth, seller or admin | multipart (DEP-01); seller ownership on update |
| DELETE `/products/:id` | auth, admin | soft delete |
| GET `/products`, `/products/:id`, `/products/:productId/reviews` | public | tenant from header |
| POST `/products/:productId/reviews` | auth, reviewLimiter | verified purchase |
| GET/POST/PUT `/coupons[/:id]` | auth, admin, adminNetworkPolicy | SEC-01b |
| POST `/orders/checkout` | auth, stepUpAuth, checkoutLimiter, idempotency | SEC-02 |
| GET `/orders`, `/orders/:id` | auth | owner-scoped (admin: whole tenant) |
| POST `/orders/:id/cancel`, `/orders/:id/refund` | auth, sensitiveLimiter | SEC-05, SEC-12 |
| PUT `/orders/:orderId/shipment` | auth, seller or admin | SEC-08, SEC-12 |
| POST `/payments/webhook` | HMAC signature | SEC-11 |
| GET `/health`, `/ready`, `/openapi.json`, `/platform/security-headers`, `/platform/validate-signed-url` | public | I-4 |
| GET `/metrics`, `/platform/{services,events,sagas,security-signals,audit-trail}`, `/api-keys` | auth, admin, adminNetworkPolicy | SEC-04 |
| POST `/api-keys` | auth, admin, adminNetworkPolicy, stepUpAuth | SEC-02 |
| GET `/platform/signed-url` | auth, sensitiveLimiter | I-2 |
| GET `/platform/stream` | auth | SEC-06 |
| GET `/internal/events` | serviceAuth(`events:read`) | I-7 |
| GET `/integrations/products` | apiKeyAuth(`products:read`) | tenant from the key |
| GET `/admin/analytics` | auth, admin | tenant-scoped |
| GET `/seller/dashboard` | auth, seller or admin | SEC-03 |
| GET `/tenant` · PUT `/tenant` | auth · auth, admin | own tenant only |
| GET/POST/DELETE `/wishlist[/:productId]` | auth | owner-scoped |
| GET `/uploads/*` | none (static) | I-2 |
