// Dev-server proxy: /api and /uploads go to the backend. E2E_API_PORT moves it off 5000 (the
// seeded E2E backend, serve-dist.mjs and playwright.config.ts read the same variable).
const target = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 5000}`;

const route = { target, secure: false, changeOrigin: true, logLevel: 'warn' };

export default {
  '/api': route,
  '/uploads': route,
};
