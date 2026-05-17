# Architecture

This project is a modular monolith with Clean Architecture boundaries. It remains one deployable Node.js/Express application, but feature code is organized under `src/modules` so domains can be extracted later without changing public APIs.

## Dependency Direction

```text
server.js
  -> src/config
  -> src/shared
  -> src/infrastructure
  -> src/modules/*/routes
       -> controller
       -> service
       -> repository
       -> Mongoose models
```

Controllers own HTTP details only: request parsing, validation calls, and response formatting.

Services own business workflows: authentication, catalog writes, cart operations, checkout, payment state transitions, notifications, audit events, and domain events.

Repositories own database access and isolate Mongoose queries from service logic where the flow has been fully migrated.

Policies own authorization and ownership rules. Existing middleware remains active and is surfaced through module policies to avoid weakening security during migration.

DTO modules are currently compatibility mappers. They intentionally preserve existing response bodies and can become stricter mappers over time.

## Module Layout

Each feature module is shaped as:

```text
src/modules/{feature}/
  controller.js
  service.js
  repository.js
  routes.js
  validator.js
  policy.js
  dto.js
```

Current modules include auth, catalog, cart, order, payment, wishlist, review, coupon, shipment, platform, tenant, analytics, and seller.

## Compatibility Strategy

Legacy top-level folders remain as compatibility shims while the application moves to `src`. Public routes, schemas, environment variables, response shapes, and database collections are unchanged.

The root router is now composed from module route registrars in `src/modules/routes.js`, then mounted at both `/api` and `/api/v1`.

## Infrastructure

Infrastructure adapters live under `src/infrastructure`:

- `database` for Mongoose connection setup
- `cache` for cache/Redis-ready adapters
- `queue` for queue abstraction
- `events` for domain event publishing
- `locks` for checkout locking
- `saga` for order saga orchestration
- `providers` for plugin/provider registry
- `models` for Mongoose model exports

## Testing Layout

Tests are grouped by purpose:

- `tests/unit`
- `tests/integration`
- `tests/e2e`
- `tests/security`

The package scripts use the categorized paths while legacy test files remain as stable compatibility entrypoints.
