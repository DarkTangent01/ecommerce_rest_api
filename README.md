# E-Commerce REST API

An enterprise-oriented eCommerce REST API built with Node.js, Express, MongoDB, and Mongoose. The project started as a simple auth/product API and has been upgraded into a modular-monolith backend with clear service boundaries, security hardening, order/payment workflows, observability hooks, and production deployment scaffolding.

The codebase is intentionally still one deployable application, but it is organized so the domains can later be extracted into independent services.

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Core Domains](#core-domains)
- [Request Lifecycle](#request-lifecycle)
- [Setup](#setup)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Auth Flow](#auth-flow)
- [Checkout and Payment Flow](#checkout-and-payment-flow)
- [Security Model](#security-model)
- [Multi-Tenancy](#multi-tenancy)
- [Observability and Operations](#observability-and-operations)
- [Testing and Validation](#testing-and-validation)
- [Docker](#docker)
- [Production Notes](#production-notes)

## Architecture

```text
Clients / Admin UI / Seller UI / Partner Integrations
  |
  v
Express API Gateway
  - Request ID and correlation ID
  - Tenant context
  - CORS, Helmet, body limits
  - Input sanitization and validation
  - Rate limiting
  - Auth, RBAC, step-up auth, API-key auth
  |
  +--> Auth Domain
  |     Users, refresh tokens, sessions, device tracking, API keys
  |
  +--> Catalog Domain
  |     Products, variants, image uploads, reviews, ratings, wishlist, search/cache hooks
  |
  +--> Cart and Order Domain
  |     Cart, coupons, checkout, inventory reservation, cancellation, refunds, sagas
  |
  +--> Payment Domain
  |     Payment state machine, signed webhooks, replay protection, payment events
  |
  +--> Fulfillment Domain
  |     Shipments, carrier tracking URLs, seller shipment updates
  |
  +--> Notification Domain
  |     Notification records, queue foundation, provider plugin hooks
  |
  +--> Platform Domain
        Health/readiness, metrics, domain events, audit logs, tenants, service catalog

Cross-cutting infrastructure:
  MongoDB + Mongoose
  Domain event outbox -> queue abstraction -> worker foundation
  Redis-ready cache, lock, and rate-limit abstractions
  Structured logs + metrics + OpenTelemetry-ready tracing hooks
  Tamper-evident audit log chain
```

## Tech Stack

- Node.js with native ES modules
- Express.js
- MongoDB and Mongoose
- JWT access tokens and rotating refresh tokens
- bcrypt password hashing
- Joi request validation
- Multer file uploads
- Helmet secure headers
- Express rate limiting
- Docker production image
- Memory-backed Redis/BullMQ-ready cache and queue abstractions

## Project Structure

```text
architecture/              Service boundary map
config/                    Environment config and defaults
controllers/               HTTP controllers by feature/domain
docs/                      Operational docs, DR plan
fraud/                     Fraud detection hooks
infra/                     Service client, event bus, locks, Redis adapter, saga orchestrator
middlewares/               Auth, RBAC, sanitization, rate limits, tenant context, metrics
models/                    Mongoose schemas
observability/             Metrics and tracing hooks
plugins/                   Payment/shipping/notification plugin registry
recommendations/           Recommendation hooks
routes/                    API route registration
scripts/                   Validation, load test, chaos plan
search/                    Search abstraction
services/                  Domain services
tests/                     Security, runtime, and Mongo E2E tests
utils/                     Shared helpers
validators/                Joi schemas
workers/                   Background worker entrypoint
```

## Core Domains

### Auth Domain

Handles registration, login, refresh-token rotation, logout, profile lookup, GDPR export, and soft deletion.

Important models:

- `User`
- `RefreshToken`
- `UserSession`
- `ApiKey`
- `SecuritySignal`

### Catalog Domain

Handles product creation, update, soft deletion, listing, search/filter/sort/pagination, variants, image uploads, reviews, ratings, and wishlist.

Important models:

- `Product`
- `Review`
- `Wishlist`

### Cart and Order Domain

Handles cart mutation, coupon validation, checkout, inventory reservation, order cancellation, refund requests, and saga visibility.

Important models:

- `Cart`
- `Order`
- `Coupon`
- `CouponRedemption`
- `InventoryReservation`
- `SagaInstance`

### Payment Domain

Handles signed payment webhooks, event replay protection, and payment state transitions. The API never trusts frontend payment success.

Important models:

- `PaymentEvent`
- `Order`

### Platform Domain

Handles tenants, metrics, service catalog, audit logs, domain events, readiness, signed URL utilities, API keys, and integration endpoints.

Important models:

- `Tenant`
- `DomainEvent`
- `AuditLog`
- `DocumentVersion`

## Request Lifecycle

Most requests pass through this flow:

```text
request
  -> requestContext: X-Request-Id and X-Correlation-Id
  -> tenantContext: X-Tenant-Id
  -> metricsMiddleware
  -> Helmet / CORS / body parser
  -> duplicate query parameter guard
  -> input sanitizer
  -> NoSQL key guard
  -> rate limiter
  -> route middleware: auth, RBAC, admin IP policy, idempotency, validation
  -> controller
  -> centralized success/error response
```

Response format:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "meta": {}
}
```

Error format:

```json
{
  "success": false,
  "message": "Validation failed",
  "details": []
}
```

## Setup

Install dependencies:

```bash
yarn install
```

Create environment file:

```bash
cp .env.example .env
```

Start in development mode:

```bash
yarn dev
```

Start normally:

```bash
yarn start
```

Default API URL:

```text
http://127.0.0.1:5000/api
```

Versioned alias:

```text
http://127.0.0.1:5000/api/v1
```

## Environment Variables

All secrets must come from environment variables. Use `.env.example` as the template.

Key variables:

```text
NODE_ENV=development
APP_PORT=5000
APP_IP_ADDRESS=127.0.0.1
APP_URL=http://localhost:5000
DB_URL=mongodb://127.0.0.1:27017/ecommerce_rest_api

JWT_SECRET=replace-with-a-long-random-access-token-secret
REFRESH_SECRET=replace-with-a-different-long-random-refresh-token-secret
SERVICE_JWT_SECRET=replace-with-a-long-random-service-auth-secret
WEBHOOK_SECRET=replace-with-a-long-random-webhook-signing-secret
SIGNED_URL_SECRET=replace-with-a-long-random-signed-url-secret

CORS_ORIGIN=http://localhost:3000,http://localhost:5173
REQUEST_BODY_LIMIT=100kb
UPLOAD_MAX_BYTES=5242880
BCRYPT_ROUNDS=12

IDEMPOTENCY_TTL_HOURS=24
INVENTORY_RESERVATION_MINUTES=15
CACHE_TTL_SECONDS=60
REDIS_URL=
QUEUE_BACKEND=memory

ADMIN_IP_ALLOWLIST=
ADMIN_IP_DENYLIST=
DEFAULT_TENANT=default
ENABLE_QUERY_PROFILING=false
SEARCH_BACKEND=mongodb-text
```

Production rules:

- Set `NODE_ENV=production`.
- Use long, random, different secrets for JWT, refresh, service, webhook, and signed URL secrets.
- Set `CORS_ORIGIN` to trusted frontend origins.
- Use MongoDB replica set mode for transaction guarantees.
- Never commit `.env`, logs, uploaded private files, or real secrets.

## API Overview

Public base paths:

```text
/api
/api/v1
```

### Health and Docs

```text
GET /api/health
GET /api/ready
GET /api/openapi.json
```

### Auth

```text
POST   /api/register
POST   /api/login
POST   /api/refresh
POST   /api/logout
GET    /api/users
GET    /api/users/export
DELETE /api/users/me
```

### Products

```text
GET    /api/products
GET    /api/products/:id
POST   /api/products       admin, seller
PUT    /api/products/:id   admin, seller
DELETE /api/products/:id   admin
```

Product list supports:

```text
q
category
minPrice
maxPrice
page
limit
sortBy
order
cursor
```

Product writes use field-level authorization. Sellers can write catalog fields for their own products; admin-only fields remain restricted.

### Cart

```text
GET    /api/cart
POST   /api/cart/items
PUT    /api/cart/items
DELETE /api/cart/items/:productId
DELETE /api/cart
```

### Wishlist

```text
GET    /api/wishlist
POST   /api/wishlist/:productId
DELETE /api/wishlist/:productId
```

### Reviews

```text
GET  /api/products/:productId/reviews
POST /api/products/:productId/reviews
```

Reviews require a verified purchase and one review per user/product/tenant.

### Coupons

```text
GET  /api/coupons       admin
POST /api/coupons       admin
PUT  /api/coupons/:id   admin
```

Coupons support global usage limits, per-user limits, active windows, and minimum order totals.

### Orders

```text
POST /api/orders/checkout   auth, Idempotency-Key required
GET  /api/orders
GET  /api/orders/:id
POST /api/orders/:id/cancel
POST /api/orders/:id/refund
```

Checkout request:

```json
{
  "shippingAddress": {
    "line1": "221B Baker Street",
    "city": "London",
    "state": "London",
    "postalCode": "NW1",
    "country": "UK"
  },
  "paymentProvider": "manual",
  "couponCode": "WELCOME10"
}
```

Required checkout header:

```text
Idempotency-Key: unique-client-generated-key
```

### Payments

```text
POST /api/payments/webhook
```

Webhook headers:

```text
X-Payment-Provider: provider-name
X-Webhook-Event-Id: unique-provider-event-id
X-Webhook-Timestamp: unix-seconds
X-Webhook-Signature: hmac-sha256(timestamp.rawBody, WEBHOOK_SECRET)
```

Supported webhook event types:

```text
payment.succeeded
payment.failed
payment.refunded
```

### Shipments

```text
PUT /api/orders/:orderId/shipment   admin, seller
```

Tracking URLs are protected by SSRF checks and must use HTTPS.

### Dashboards

```text
GET /api/admin/analytics     admin
GET /api/seller/dashboard    seller, admin
```

### Platform and Integrations

```text
GET  /api/metrics                         admin
GET  /api/platform/services               admin
GET  /api/platform/events                 admin
GET  /api/platform/sagas                  admin
GET  /api/platform/security-signals       admin
GET  /api/platform/audit-trail            admin
GET  /api/platform/security-headers
GET  /api/platform/signed-url             auth
GET  /api/platform/validate-signed-url
GET  /api/platform/stream                 auth, SSE-ready
GET  /api/tenant                          auth
PUT  /api/tenant                          admin
GET  /api/internal/events                 service JWT
GET  /api/integrations/products           scoped API key
GET  /api/api-keys                        admin
POST /api/api-keys                        admin + step-up
```

## Auth Flow

Register:

```bash
curl -X POST http://127.0.0.1:5000/api/register \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: default" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "Password123",
    "repeat_password": "Password123"
  }'
```

Login:

```bash
curl -X POST http://127.0.0.1:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "password": "Password123"
  }'
```

Use access token:

```text
Authorization: Bearer <access_token>
```

Refresh tokens are stored server-side, rotated, and revoked on logout.

## Checkout and Payment Flow

```text
1. User adds products to cart.
2. User calls checkout with Idempotency-Key.
3. API validates cart, stock, coupon, tenant, and ownership.
4. API reserves inventory and creates an unpaid pending order.
5. API emits order.created and inventory.reserved events.
6. Payment provider processes payment outside this API.
7. Provider calls signed webhook.
8. API verifies signature, timestamp, event ID, and payment state transition.
9. API updates order payment status and emits payment.completed/payment.failed/payment.refunded.
10. Seller/admin updates shipment and emits shipment.updated.
```

Important:

- Frontend payment success is never trusted.
- Card data must never be sent to or stored by this API.
- Use a PCI-compliant provider such as Stripe, Razorpay, PayPal, etc.
- MongoDB standalone mode works for local validation with fallback logic.
- MongoDB replica set mode is required in production for true transaction guarantees.

## Security Model

Implemented controls:

- Strong password policy and bcrypt hashing.
- JWT issuer/audience checks.
- JWT `jti` for unique token rotation.
- Rotating refresh-token whitelist with expiry.
- Role-based access control for `user`, `seller`, and `admin`.
- Field-level authorization for product writes.
- BOLA/IDOR protection on owned resources.
- Tenant isolation with `X-Tenant-Id`.
- Scoped API keys for third-party integrations.
- Service-to-service JWT foundation.
- Step-up authentication readiness.
- Device/session tracking.
- Failed-login and anomaly signal hooks.
- Admin IP allow/deny lists.
- Request body and parameter limits.
- Duplicate query parameter protection.
- NoSQL injection key guard.
- XSS-oriented string sanitization without mutating JWT/password fields.
- Secure headers via Helmet.
- CORS allowlist.
- Upload MIME, extension, and magic-byte validation.
- Executable/polyglot upload marker rejection.
- SSRF protection for URL inputs.
- Checkout idempotency keys.
- Signed webhook verification and replay protection.
- Coupon abuse controls.
- Review spam controls.
- Tamper-evident audit log hash chain.
- Signed URL generation and validation.
- GDPR-ready user export and soft deletion.
- PCI-DSS awareness: no card data storage.

## Multi-Tenancy

Tenant context is read from:

```text
X-Tenant-Id
```

If omitted, the API uses:

```text
DEFAULT_TENANT=default
```

Tenant-scoped data includes users, products, carts, wishlist, reviews, coupons, orders, shipments, notifications, events, and audit logs.

## Observability and Operations

### Request IDs

Every response includes:

```text
X-Request-Id
X-Correlation-Id
```

### Metrics

```text
GET /api/metrics
```

Supports JSON and Prometheus-style text output.

### Events and Sagas

Domain events include:

```text
order.created
inventory.reserved
payment.completed
payment.failed
payment.refunded
shipment.updated
order.cancelled
refund.requested
```

Admin visibility:

```text
GET /api/platform/events
GET /api/platform/sagas
```

### Workers

Start worker foundation:

```bash
yarn workers
```

Current queue backend is memory by default. The abstractions are Redis/BullMQ-ready.

### Disaster Recovery

See:

```text
docs/DISASTER_RECOVERY.md
```

## Testing and Validation

Run syntax/import validation:

```bash
yarn validate
```

Run unit/runtime security tests:

```bash
yarn test
```

Run dependency audit:

```bash
yarn audit
```

Run all security checks:

```bash
yarn scan:security
```

Run MongoDB E2E test:

```bash
yarn test:e2e:mongo
```

The Mongo E2E test expects MongoDB on `DB_URL`. Example:

```bash
DB_URL=mongodb://127.0.0.1:27017/ecommerce_rest_api_validation_runtime yarn test:e2e:mongo
```

On PowerShell:

```powershell
$env:DB_URL="mongodb://127.0.0.1:27017/ecommerce_rest_api_validation_runtime"
yarn test:e2e:mongo
```

Run load test:

```bash
yarn load:test
```

Run chaos test plan:

```bash
yarn chaos:plan
```

## Docker

Build:

```bash
docker build -t ecommerce-rest-api .
```

Run:

```bash
docker run --env-file .env -p 5000:5000 ecommerce-rest-api
```

Dockerfile properties:

- Uses `node:18-alpine`.
- Installs production dependencies.
- Runs as non-root `appuser`.
- Includes API healthcheck.
- Does not bake secrets into the image.

## OpenAPI

OpenAPI document:

```text
GET /api/openapi.json
```

This is SDK-generation ready at a structural level and includes security schemes, core schemas, and major route coverage. It can be extended further for full request/response examples for every endpoint.

## Production Notes

- Use MongoDB replica set mode for production checkout transaction guarantees.
- Use a real Redis instance for cache, distributed locks, queue backend, and rate limiting at scale.
- Replace memory queue adapters with BullMQ workers for production async processing.
- Integrate a real PCI-compliant payment provider.
- Configure `ADMIN_IP_ALLOWLIST` for production admin APIs.
- Store logs centrally.
- Export metrics to Prometheus/OpenTelemetry in production.
- Run backup and restore drills according to `docs/DISASTER_RECOVERY.md`.
- Keep `yarn audit` in CI.

## Useful Commands

```bash
yarn install
yarn dev
yarn start
yarn validate
yarn test
yarn test:e2e:mongo
yarn audit
yarn scan:security
yarn workers
yarn load:test
yarn chaos:plan
```

## Current Status

Validated locally with:

- `yarn validate`
- `yarn test`
- `yarn audit`
- `yarn scan:security`
- `yarn test:e2e:mongo`
- Live startup probes for `/api/health`, `/api/ready`, `/api/openapi.json`, and `/api/v1/health`

The API is ready for local development and staging validation. Production deployment should provide real secrets, MongoDB replica set mode, Redis, centralized logs, and a real payment provider.
