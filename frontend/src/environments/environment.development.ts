// `ng serve` settings. Requests to /api and /uploads are proxied to the local backend
// (see proxy.conf.json), so the browser never makes a cross-origin call during development.
export const environment = {
  production: false,
  apiBaseUrl: '/api/v1',
  tenantId: 'default',
  currency: 'USD',
};
