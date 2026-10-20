import { expect, seed, signIn, test } from './support/fixtures';

test.describe('AeroScript storefront', () => {
  test('home page shows the hero, categories and real product rails', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AeroScript/);
    await expect(page.getByRole('heading', { level: 1, name: /one search away/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New arrivals' })).toBeVisible();
    // The seed has a "Trail Water Bottle"; rails show real catalogue data.
    await expect(page.getByRole('region', { name: 'New arrivals' }).getByRole('listitem').first()).toBeVisible();

    await page.getByRole('region', { name: 'Shop by category' }).getByRole('link', { name: 'Kitchen' }).click();
    await expect(page).toHaveURL(/category=kitchen/);
    await expect(page.getByRole('heading', { name: 'Kitchen', level: 1 })).toBeVisible();
  });

  test('header search suggests real products and opens the one picked', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Search products').fill('lant');
    const option = page.getByRole('option', { name: /Camping Lantern/ });
    await expect(option).toBeVisible();
    await option.click();
    await expect(page).toHaveTitle(/Camping Lantern/);
    await expect(page.getByRole('heading', { level: 1, name: 'Camping Lantern' })).toBeVisible();
  });

  test('submitting a search lists matching products with a removable filter chip', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Search products').fill('mug');
    await page.getByLabel('Search products').press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: /Results for “mug”/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Stoneware Mug' })).toBeVisible();

    await page.getByRole('button', { name: 'Remove filter “mug”' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'All products' })).toBeVisible();
  });

  test('product page shows related products and Buy now goes to checkout', async ({ page }) => {
    await signIn(page, seed().accounts.customer);
    await page.goto('/products?category=outdoors');
    await page.getByRole('link', { name: 'Hammock' }).click();
    await expect(page.getByRole('heading', { name: 'More in this category' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'More in this category' }).getByRole('link', { name: 'Hammock' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Buy now' }).click();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test('private pages are not indexed, public pages are', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/products$/);
    await page.goto('/login');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });
});

test.describe('AeroScript on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const path of ['/', '/products', '/products?category=outdoors']) {
    test(`no horizontal scrolling on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('search, cart and the navigation drawer stay reachable', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Search products')).toBeVisible();
    await expect(page.getByRole('link', { name: /^Cart, \d+ items?$/ })).toBeVisible();

    await page.getByRole('button', { name: 'Open navigation' }).click();
    const drawer = page.getByRole('navigation', { name: 'Site navigation' }).or(page.locator('mat-sidenav'));
    await drawer.getByRole('link', { name: 'Outdoors' }).click();
    await expect(page.getByRole('heading', { name: 'Outdoors', level: 1 })).toBeVisible();
  });

  test('filters open from a button on small screens', async ({ page }) => {
    await page.goto('/products');
    const filters = page.getByRole('complementary', { name: 'Filters' });
    await expect(filters).toBeHidden();
    await page.getByRole('button', { name: /Filters/ }).click();
    await expect(filters).toBeVisible();
    await filters.getByRole('link', { name: 'Kitchen' }).click();
    await expect(page.getByRole('heading', { name: 'Kitchen', level: 1 })).toBeVisible();
  });
});
