# ShopSphere web app (Angular)

Storefront, account area, seller tools and admin console for the e-commerce REST API in the parent folder. It is Angular 22 with standalone components, signals, the `@if`/`@for` control flow, `inject()`, OnPush everywhere and strict TypeScript and templates, plus Angular Material (M3).

## Quick start

```bash
cd frontend
npm ci
npx playwright install chromium   # only needed for E2E

# Terminal 1: the API with seeded data (in-memory MongoDB, nothing to install)
node e2e/support/backend.mjs

# Terminal 2: the app on http://localhost:4200 (proxies /api and /uploads to :5000)
npm start
```

`backend.mjs` runs the backend from `../src` through the backend's own dev dependencies and does not modify it. It seeds three local test accounts (admin, seller and customer), 12 products, a `WELCOME10` coupon and one paid order. The accounts are written to `e2e/.seed.json` (git-ignored) and only exist in that in-memory database.

To use your own backend instead, start it on port 5000 (`cd .. && yarn dev`). Your MongoDB needs data, and your backend's `CORS_ORIGIN` must include `http://localhost:4200`.

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Dev server on :4200 with the API proxy (`proxy.conf.json`) |
| `npm run build` | Production build into `dist/ecommerce-admin-ui/browser` (hashed CSP included) |
| `npm run build:dev` | Unoptimized build using `environment.development.ts` |
| `npm test` | Unit and component tests (Vitest via `@angular/build:unit-test`) |
| `npm run test:watch` | The same, in watch mode |
| `npm run lint` | angular-eslint + typescript-eslint (no `any` or `$any`, OnPush, control flow, a11y) |
| `npm run e2e` | Playwright: starts the seeded backend and `ng serve`, then runs `e2e/*.e2e.ts` |
| `npm run e2e:prod` | Builds for production and runs the same E2E suite against `dist/`, served behind a proxy (`e2e/support/serve-dist.mjs`) |
| `npm run format` / `format:check` | Prettier |

## Configuration

Everything in `src/environments/*.ts` ships to browsers. **Never put secrets there.** The app needs no secrets or API keys.

| Setting | Default | Meaning |
|---|---|---|
| `apiBaseUrl` | `/api/v1` | Relative, so the app expects to be served on the same origin as the API: a reverse proxy routes `/api` and `/uploads` to the backend, as `proxy.conf.json` does in development. |
| `tenantId` | `default` | Sent as `X-Tenant-Id` on public requests. Signed-in users always act in their own tenant (enforced by the backend). |
| `currency` | `USD` | Display currency for the `money` pipe |

**Production checklist**
- Serve `dist/ecommerce-admin-ui/browser` with an SPA fallback to `index.html`, and proxy `/api` and `/uploads` to the backend.
- **Add the site's origin to the backend's `CORS_ORIGIN`, even though the app is same-origin.** Browsers send `Origin` on POST requests and the backend checks it, so unlisted origins get `403 CORS origin denied`. (The E2E suite against the production build caught this.)
- Set the backend's `APP_URL` to the public origin so product image URLs point at it.
- Send this CSP as an HTTP header (a meta tag cannot carry `frame-ancestors`). The build already injects a hash-based `script-src` via `autoCsp`.
  ```
  default-src 'self'; script-src 'self' 'strict-dynamic' <hashes from dist/index.html>; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self';
  form-action 'self'; frame-ancestors 'none'
  ```
  `style-src 'unsafe-inline'` is needed for Angular component styles. Fonts come from Google Fonts (see TODOs).

## Folder structure

```text
src/app/
  core/                 app-wide singletons
    api/                one typed service per resource (auth, products, cart, orders, reviews/wishlist, account, admin/seller)
    auth/               AuthService (signal store), TokenStorage
    cart/  wishlist/    signal stores; CartActions (guest -> sign in -> back)
    config/             app settings token, validation rules mirrored from the backend's Zod schemas, catalog config
    guards/             authGuard, guestGuard, roleGuard (adminGuard, sellerGuard)
    http/               ApiError (normalized errors), HttpContext flags
    interceptors/       loading -> error -> auth (refresh + retry)
    layout/             Material app shell
    models/             API types mirrored from the backend (envelope, error codes, domain, requests)
    routing/            title + meta strategy
  shared/
    components/         async/empty states, product card, rating, stock badge, status chip, dialogs
    forms/              validators (password rule, https URL, safe returnUrl) and error helpers
    pipes/              money
  features/             lazy-loaded pages: products (home, list, detail, wishlist), auth, cart,
                        checkout (+ confirmation), orders, profile, seller, admin, errors (404/403)
src/testing/            test helpers and builders (excluded from the app build)
e2e/                    Playwright specs and support (seeded backend, prod server, fixtures)
```

## Tests

- **Unit and component (60 tests):** API client, error mapping, auth service (single-flight refresh, token placement, session restore), auth and error interceptors, guards, cart store, validators, product query parsing, upload checks, idempotency key lifecycle, plus component tests for login, cart and checkout.
- **E2E (8 tests, Playwright and Chromium, against the real API):**
  - register → filter → product → add 2 to cart → checkout with `WELCOME10` → the confirmation shows the server's discount and total → order history;
  - a returning customer sees their paid order;
  - wrong credentials show a generic error;
  - an admin creates a product with an image and it appears in the shop;
  - the client rejects SVG uploads;
  - a normal user is blocked from `/admin`;
  - anonymous visitors are redirected to sign in and back;
  - unknown URLs show a 404 page.

  `npm run e2e:prod` runs the same suite against the production build.

## Security notes

- **Tokens.** The backend returns tokens in JSON (no HttpOnly cookies). The access token is kept in memory only. The refresh token is kept in `sessionStorage`, scoped to the tab, so a page reload stays signed in. Refresh is single-flight, because the backend rotates refresh tokens and parallel 401s would otherwise race and log the user out. No CSRF handling is needed, since no cookies are used.
- **Roles.** The UI reads the role from `GET /users` and only *hides* features. Every protected endpoint is authorized by the backend.
- **Prices.** Only product ids, quantities, the address and the coupon code are sent. Totals, discounts and payment state are displayed from server responses. The cart page shows a clearly labelled *estimate*, because the cart API returns no totals.
- **Sanitization.** The app uses Angular's built-in sanitization only: no `innerHTML`, `bypassSecurityTrust*`, `localStorage` or `eval`. The post-login `returnUrl` only accepts in-app paths (open-redirect guard).
- **Uploads.** Files are checked client-side (JPG/PNG/WebP, 5 MB or less) as UX only. The backend re-validates type, magic bytes and size.

## What was built and what was reused

The previous untracked Angular 21 project was committed first as a baseline. I then upgraded it with `ng update` to Angular 22, which also fixed six npm-audit advisories (XSS and cache poisoning) in 21.2.13.

- **Reused:** the project scaffold, tsconfig strictness, the Vitest builder, the angular-eslint setup, the envelope-unwrapping `ApiClientService` (extended), and the endpoint map (re-typed into per-resource services).
- **Replaced:**
  - Auth: tokens were in `sessionStorage` and refresh could race.
  - Interceptor: there was no error or loading handling.
  - Cart and checkout: they computed subtotals client-side, showed an invented "10% discount" and offered a Razorpay option the backend doesn't support.
  - Product cards: they showed fabricated "% off" and list prices.
  - All pages: rewritten with Material, OnPush, and loading/empty/error states.
- **Removed (with approval):** the legacy services (one called `inject()` at runtime and crashed), the notifications page (the backend has no endpoint for it), and the old CSS and the Lucide icon library.

## Backend gaps (not worked around, flagged)

1. No forgot/reset password, password change or profile update endpoints. The profile page is read-only.
2. No HttpOnly cookie auth, so the refresh token sits in `sessionStorage`.
3. No guest cart, so guests are sent to sign in when they add to cart.
4. The cart returns no totals, and there's no coupon preview or quote endpoint. The discount and total are only known after the order is placed.
5. No categories endpoint, so categories are configured in `core/config/catalog.ts`.
6. Payment has no payment-intent or redirect endpoint. Orders are created unpaid and confirmed only by the provider webhook. No payment SDK was added.
7. No admin endpoint to set order status arbitrarily or to approve refunds. Admins can ship, cancel and request refunds only.
8. No user management. `GET /products` can't list inactive products or filter by seller, so deactivated products don't appear in admin lists.
9. Single image per product, and variant selection isn't supported at checkout.
10. `X-Device-Id` isn't in the backend's CORS allowed headers (irrelevant when same-origin).
11. **`X-Forwarded-For` is only trusted when the backend sets `TRUST_PROXY`** (off by default since SEC-01). The E2E harness sets `TRUST_PROXY=loopback`, because the specs use `X-Forwarded-For` to give each test its own rate-limit budget. In production, set it to your reverse proxy.
12. Unpaid orders are auto-cancelled after the reservation window, with no "pay now" flow the frontend could offer.

## Remaining TODOs

- Self-host Roboto and Material Symbols instead of loading them from Google Fonts (privacy, and a tighter CSP).
- The initial bundle is 754 kB raw / 171 kB transferred (warning budget raised to 800 kB). The Material shell could be trimmed further.
- No i18n, and no dark theme toggle (the M3 theme supports one).
- The E2E suite runs Chromium only. Add Firefox and WebKit if needed.
