# Security

The Clean Architecture migration preserves the existing security controls and exposes them through module policies.

## Request Security

- Helmet security headers
- CORS allowlist support
- Request body size limits
- Duplicate query parameter protection
- Input sanitization
- NoSQL operator sanitization
- Structured request IDs and correlation IDs

## Authentication and Authorization

- JWT access tokens
- Refresh token persistence
- RBAC middleware for user, seller, and admin roles
- Step-up authentication middleware for sensitive operations
- API key authentication for third-party integration routes
- Service JWT authentication for internal routes
- Admin IP allow/deny policy support

## Business Logic Protection

- Tenant context on tenant-aware resources
- BOLA/IDOR checks through user/tenant-scoped queries
- Field-level write filtering for product updates
- Checkout idempotency keys
- Distributed lock abstraction for checkout
- Inventory reservation and stock decrement checks
- Coupon redemption limits
- Review rate limiting

## Payment Security

Payment webhook handling is routed through the payment module and service layer. It verifies signed payloads, enforces replay protection through provider event IDs, uses a payment state machine, and never trusts frontend payment success.

## Upload Security

Product image upload uses MIME and extension allowlists plus magic-byte validation. Unsafe executable, script, HTML/PHP, shell, and ZIP/polyglot markers are rejected and uploaded files are removed on validation failure.

## Audit and Observability

Admin, seller, order, payment, and catalog actions write audit records. Request logging includes request IDs and correlation IDs. Metrics and tracing hooks remain available through platform and observability modules.

## Validation Commands

```bash
yarn validate
yarn test
yarn test:e2e:mongo
yarn audit
yarn scan:security
```
