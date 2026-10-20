# AeroScript web app (Angular)

AeroScript is the storefront, account area, seller hub and admin console for the e-commerce REST API in the parent folder. It uses:

- Angular 22 with standalone components and signals;
- the `@if`/`@for` control flow, `inject()` and OnPush change detection everywhere;
- strict TypeScript and templates;
- Angular Material (M3), re-skinned with the AeroScript design tokens.

## Quick start

```bash
cd frontend
npm ci
npx playwright install chromium   # only needed for E2E

# Terminal 1: the API with seeded data (in-memory MongoDB, nothing to install)
node e2e/support/backend.mjs

# Terminal 2: the app on http://localhost:4200 (proxies /api and /uploads to :5000, or $E2E_API_PORT)
npm start
```

`backend.mjs` runs the backend from `../src` through the backend's own dev dependencies and does not modify it. It seeds:

- three local test accounts (admin, seller and customer);
- 12 products;
- a `WELCOME10` coupon;
- one paid order.

The accounts are written to `e2e/.seed.json` (git-ignored) and exist only in that in-memory database.

To use your own backend instead, start it on port 5000 (`cd .. && yarn dev`). Your MongoDB needs data, and your backend's `CORS_ORIGIN` must include `http://localhost:4200`.

If port 5000 is already taken on your machine, set `E2E_API_PORT=5100`. `backend.mjs`, `serve-dist.mjs` and the Playwright config all read it. The dev server proxy (`proxy.conf.mjs`) follows it too.

## Scripts

| Script | What it does |
|---|---|
| `npm start` | Dev server on :4200 with the API proxy (`proxy.conf.mjs`) |
| `npm run build` | Production build into `dist/ecommerce-admin-ui/browser` (hashed CSP included) |
| `npm run build:dev` | Unoptimized build using `environment.development.ts` |
| `npm test` | Unit and component tests (Vitest via `@angular/build:unit-test`) |
| `npm run test:watch` | The same, in watch mode |
| `npm run lint` | angular-eslint + typescript-eslint (no `any` or `$any`, OnPush, control flow, a11y) |
| `npm run e2e` | Playwright: starts the seeded backend and `ng serve`, then runs `e2e/*.e2e.ts` |
| `npm run e2e:prod` | Builds for production and runs the same E2E suite against `dist/`, served behind a proxy (`e2e/support/serve-dist.mjs`) |
| `npm run format` / `format:check` | Prettier |

## Design system

**Tokens.** All design tokens live in `src/styles/_tokens.scss` as CSS custom properties (`--as-*`):

- brand ink, Aero blue and the warm "flare" used for buy actions;
- semantic colours, a type scale (Inter for text, Sora for headings) and a 4 px spacing scale;
- radii, shadows, motion and breakpoint mixins.

**Theme.** `styles.scss` maps the Material M3 theme onto those tokens (`mat.theme-overrides`). Material components and AeroScript components therefore share one palette; there is no second styling system.

**Shared UI:**
- `app-logo`: the delta-wing mark and wordmark.
- `app-product-card`: real stock badges, wishlist toggle and an image fallback.
- `app-product-rail`: scroll-snap shelf with previous/next buttons.
- `app-product-skeleton`: loading placeholders.
- `app-async-state`: loading, error and retry states, with an optional skeleton slot.
- `app-empty-state`, `app-status-chip`, `app-rating-stars`, dialogs and toasts.

The `.as-buy` class marks the flare "buy" button. `.as-skeleton` provides shimmer placeholders.

**Accessibility:**
- a skip link, and visible focus rings;
- `prefers-reduced-motion` support;
- 44 px touch targets in the header;
- labelled search and scope controls, and a Material autocomplete (ARIA combobox) for suggestions;
- descriptive button names (for example "Add Trail Water Bottle to cart");
- focus moves to the new page after each navigation.

## What's where

| Area | Highlights |
|---|---|
| Header (`core/layout`) | Sticky dark masthead with a scoped search and debounced suggestions. Older lookups are cancelled with `switchMap`, and Enter submits in-app. It also has the account menu, orders, wishlist, the live cart count and a scrollable category bar, plus a mobile drawer. |
| Home | Hero with real product photos, category tiles, and rails for New arrivals, Under $30, three category shelves and Recently viewed. |
| Catalogue | URL-driven search, category and price filters, sort and paging (`rxResource`, so stale requests are cancelled). Also active-filter chips with clear-all, a sidebar that becomes a toggle panel on small screens, and skeleton loading. |
| Product | Gallery with image fallback, reviews, variants, quantity, Add to cart, Buy now (straight to checkout), and a related-products rail. Recently viewed is recorded in `sessionStorage`, ids only. |
| Cart | Quantity changes, remove, "Move to wishlist" (saves first, then removes), and an estimated subtotal. Final totals always come from the server. |
| Checkout and orders | Server totals; an honest unpaid state until the payment provider confirms; cancel and refund rules that match the backend. |
| Seller and admin | The seller dashboard shows only the seller's own lines and subtotal. Admin has products, orders, coupons and store settings. |
| SEO (`core/routing/title.strategy.ts`) | Page titles, descriptions, canonical URLs (listings keep only `category`), Open Graph and Twitter tags, product metadata from product data, and `noindex` for sign-in, cart, checkout, account, seller and admin. |

## Configuration

Everything in `src/environments/*.ts` ships to browsers. **Never put secrets there.** The app needs no secrets or API keys.

| Setting | Default | Meaning |
|---|---|---|
| `apiBaseUrl` | `/api/v1` | Relative, so the app expects to be served on the same origin as the API: a reverse proxy routes `/api` and `/uploads` to the backend (nginx in production, `proxy.conf.mjs` in development). |
| `tenantId` | `default` | Sent as `X-Tenant-Id` on public requests. Signed-in users always act in their own tenant (enforced by the backend). |
| `currency` | `USD` | Display currency for the `money` pipe |

## Deployment

**Docker.** `frontend/Dockerfile` builds the production bundle with `node:24-alpine` and serves it with `nginxinc/nginx-unprivileged` (non-root, port 8080). The nginx config is `frontend/nginx/default.conf.template`, rendered at start-up. It provides:

- SPA fallback to `index.html`;
- a year of immutable caching for hashed assets, and `no-cache` for `index.html`;
- security headers (`frame-ancestors 'none'`, `nosniff` and others), alongside the build's hash-based `script-src` CSP;
- gzip;
- `GET /healthz`.

`/api` and `/uploads` are proxied to `API_UPSTREAM`, the API as the **container network** sees it, never `localhost`. Nginx replaces `X-Forwarded-For` with the real client address, so the backend should run with `TRUST_PROXY=1`.

```bash
docker build -t aeroscript-web frontend
docker run -p 8080:8080 -e API_UPSTREAM=http://api:5000 aeroscript-web
```

**Whole stack.** The root `docker-compose.yml` runs MongoDB, the API and the web app. Only the web container is published.

```bash
cp .env.example .env   # set the five secrets first
docker compose up --build
# open http://localhost:8080
```

**Production checklist:**
- **Add the site's origin to the backend's `CORS_ORIGIN`, even though the app is same-origin.** Browsers send `Origin` on POST requests and the backend checks it. The compose file sets this from `PUBLIC_URL`.
- Set the backend's `APP_URL` to the public origin, so product image URLs point at it.
- Terminate TLS in front of the web container. Keep the API unreachable except through it.

## Tests

- **Unit and component (90 tests):**
  - API client, error mapping, auth service, interceptors and guards;
  - cart store, validators, query parsing, upload checks and the idempotency key lifecycle;
  - search box: debounce, minimum length, stale-request cancellation, category scope, failure handling, in-app submit;
  - product card: badges, events that don't navigate, saved state, image fallback;
  - app shell: cart label and role-aware navigation;
  - product list: filter chips, removal, skeleton and empty states, price-range validation;
  - recently viewed store, and SEO metadata;
  - component tests for login, cart (including move-to-wishlist) and checkout.
- **E2E (18 tests, Playwright and Chromium, against the real API):**
  - the customer journey from registration to order history;
  - admin product creation, SVG rejection and access control;
  - home rails and categories;
  - header suggestions and search;
  - removable filter chips;
  - Buy now and related products;
  - robots and canonical tags;
  - on a 390 px phone: no horizontal overflow on three pages, the drawer and cart, and the filter panel.

  `npm run e2e:prod` runs the same suite against the production build.

## Security notes

- **Tokens.** The backend returns tokens in JSON (no HttpOnly cookies). The access token is kept in memory only. The refresh token lives in `sessionStorage`, scoped to the tab. Refresh is single-flight, because the backend rotates refresh tokens. No CSRF handling is needed, since no cookies are used.
- **Roles.** The UI reads the role from `GET /users` and only *hides* features. Every protected endpoint is authorized by the backend.
- **Prices.** Only product ids, quantities, the address and the coupon code are sent. Totals, discounts and payment state are displayed from server responses. The cart page shows a clearly labelled *estimate*.
- **Sanitization.** The app uses Angular's built-in escaping only: no `innerHTML`, `bypassSecurityTrust*`, `localStorage` or `eval`. The post-login `returnUrl` only accepts in-app paths.
- **Uploads.** Files are checked client-side (JPG/PNG/WebP, 5 MB or less) as UX only. The backend re-validates type, magic bytes and size.

## Backend gaps (not worked around, flagged)

1. No forgot/reset password, password change, profile update or address book endpoints. The profile page is read-only, and checkout asks for the address each time.
2. No HttpOnly cookie auth, so the refresh token sits in `sessionStorage`.
3. No guest cart, so guests are sent to sign in when they add to cart.
4. The cart returns no totals, and there's no coupon preview or quote endpoint. The discount and total are known only after the order is placed.
5. No categories endpoint, so categories are configured in `core/config/catalog.ts`.
6. No merchandising data: no best-seller or trending ranking, list prices, discounts, deals or banners. The home page shows only real catalogue queries, and there are no "Best sellers", "Trending" or "Deals" rows.
7. `GET /products` cannot filter by rating or availability, or sort by rating. Those filters are deliberately absent rather than faked on one page of results.
8. No delivery-estimate or location endpoint, so there's no "deliver to" selector or delivery dates. Shipping is confirmed at checkout.
9. Payment has no payment-intent or redirect endpoint. Orders are created unpaid and confirmed only by the provider webhook. No payment SDK was added.
10. No admin endpoint to approve or reject refunds or to set order status arbitrarily. No user management.
11. Single image per product, and variant selection isn't supported at checkout.
12. `X-Forwarded-For` is only trusted when the backend sets `TRUST_PROXY` (off by default). The E2E harness sets `TRUST_PROXY=loopback`, because the specs use `X-Forwarded-For` to give each test its own rate-limit budget. In production, set it to your reverse proxy (`1` behind the bundled nginx).

## Remaining TODOs

- Self-host Inter, Sora and Material Symbols instead of loading them from Google Fonts (privacy, a tighter CSP, and no flash of icon ligature text while the font loads).
- Initial bundle: 800.9 kB raw / 180.9 kB transferred (warning budget 850 kB). The Material autocomplete in the header accounts for most of the growth over the previous 754 kB / 171 kB.
- No i18n, and no dark theme toggle (the tokens are ready for one).
- The E2E suite runs Chromium only. Add Firefox and WebKit if needed.
- The nginx template and both Docker images have not been run here (Docker isn't installed on this machine).
