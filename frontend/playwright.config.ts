import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the real API: e2e/support/backend.mjs starts the backend from ../src on an
 * in-memory MongoDB and seeds it, then `ng serve` proxies /api to it.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  globalTeardown: './e2e/support/teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    // E2E_BASE_URL runs the suite against another server, e.g. the production build (see README).
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/support/backend.mjs',
      // E2E_API_PORT moves the seeded API off 5000 (backend.mjs and serve-dist.mjs read it too).
      url: `http://127.0.0.1:${process.env['E2E_API_PORT'] ?? '5000'}/api/v1/ready`,
      timeout: 180_000,
      reuseExistingServer: !process.env['CI'],
      stdout: 'pipe',
    },
    {
      command: process.env['E2E_BASE_URL'] ? 'node e2e/support/serve-dist.mjs' : 'npx ng serve --port 4200',
      url: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
      timeout: 180_000,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
