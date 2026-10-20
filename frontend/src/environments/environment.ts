// Production build settings. Never put secrets here: everything in this file ships to browsers.
export const environment = {
  production: true,
  /**
   * Base URL of the REST API. Relative by default, so the SPA is served behind the same origin
   * as the API (e.g. a reverse proxy routing /api and /uploads to the backend). Set an absolute
   * URL only if the API lives on another origin, and add that origin to the backend's CORS_ORIGIN.
   */
  apiBaseUrl: '/api/v1',
  /** Tenant sent as X-Tenant-Id on public requests; signed-in users always act in their own tenant. */
  tenantId: 'default',
  currency: 'USD',
};
