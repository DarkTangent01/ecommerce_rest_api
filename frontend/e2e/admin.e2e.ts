import { expect, seed, signIn, test, tinyPng } from './support/fixtures';

test.describe('admin and access control', () => {
  test('an admin creates a product that then appears in the shop', async ({ page }) => {
    const name = `E2E Lamp ${Date.now()}`;
    await signIn(page, seed().accounts.admin, '/admin/products');

    await page.getByRole('button', { name: 'New product' }).click();
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Price').fill('19.99');
    await page.getByLabel('Stock').fill('7');
    await page.getByLabel('Description').fill('Created by the E2E suite.');
    await page.locator('input[type=file]').setInputFiles({ name: 'lamp.png', mimeType: 'image/png', buffer: tinyPng });
    await page.getByRole('button', { name: 'Create product' }).click();
    await expect(page.getByText(`Saved “${name}”.`)).toBeVisible();

    await page.goto(`/products?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole('link', { name })).toBeVisible();
    await expect(page.getByText('$19.99')).toBeVisible();
  });

  test('the client rejects unsupported image types before uploading', async ({ page }) => {
    await signIn(page, seed().accounts.admin, '/admin/products');
    await page.getByRole('button', { name: 'New product' }).click();
    await page.locator('input[type=file]').setInputFiles({ name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    await expect(page.getByRole('alert')).toContainText('Use a JPG, PNG or WebP image.');
  });

  test('a normal user is blocked from admin routes and does not see admin navigation', async ({ page }) => {
    await signIn(page, seed().accounts.customer);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/unauthorized$/);
    await expect(page.getByRole('heading', { name: "You can't open this page" })).toBeVisible();

    await page.goto('/admin/orders');
    await expect(page).toHaveURL(/\/unauthorized$/);
  });

  test('anonymous visitors are sent to sign in and returned afterwards', async ({ page }) => {
    await page.goto('/account/orders');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Faccount%2Forders/);
    await page.getByLabel('Email').fill(seed().accounts.customer.email);
    await page.getByLabel('Password', { exact: true }).fill(seed().accounts.customer.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/account\/orders$/);
  });

  test('unknown URLs show the 404 page', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveTitle(/Page not found/);
  });
});
