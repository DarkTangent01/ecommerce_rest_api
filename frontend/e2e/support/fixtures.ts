import { expect, test as base, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export interface Seed {
  apiBaseUrl: string;
  accounts: Record<'admin' | 'seller' | 'customer', { email: string; password: string; role: string }>;
  productIds: string[];
  paidOrderId: string;
  coupon: string;
}

/**
 * The backend rate-limits auth to 10 attempts per 15 minutes per client IP. backend.mjs starts it with
 * TRUST_PROXY=loopback, so through the local dev proxy the X-Forwarded-For value is the client IP.
 * Giving every test its own address keeps the suite from exhausting one shared budget.
 */
export const test = base.extend({
  extraHTTPHeaders: async ({}, use, testInfo) => {
    await use({ 'X-Forwarded-For': `10.77.${testInfo.workerIndex % 250}.${(testInfo.testId.charCodeAt(0) + Date.now()) % 250}` });
  },
});
export { expect };

/** Written by e2e/support/backend.mjs once the backend is seeded. */
export const seed = (): Seed => JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.seed.json'), 'utf8')) as Seed;

export const signIn = async (page: Page, account: { email: string; password: string }, returnUrl?: string) => {
  await page.goto(returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
};

export const uniqueEmail = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;

/** A valid 1x1 PNG (passes the backend's magic-byte check). */
export const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
