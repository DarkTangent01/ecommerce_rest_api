import { expect, seed, signIn, test, uniqueEmail } from './support/fixtures';

test.describe('customer journey', () => {
  test('register → browse → add to cart → checkout with coupon → view the order', async ({ page }) => {
    const password = 'ShopTest123';

    // Register (signs in automatically).
    await page.goto('/register');
    await page.getByLabel('Full name').fill('E2E Shopper');
    await page.getByLabel('Email').fill(uniqueEmail('shopper'));
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Repeat password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();

    // Browse: filter by category, open a product.
    await page.goto('/products?category=outdoors');
    await expect(page.getByRole('heading', { name: 'Outdoors', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Trail Water Bottle' }).click();
    await expect(page).toHaveTitle(/Trail Water Bottle/);
    await expect(page.getByText('$22.00')).toBeVisible();

    // Add two to the cart.
    await page.getByLabel('Quantity').click();
    await page.getByRole('option', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();

    // Cart shows an estimate only.
    await page.getByRole('link', { name: 'Cart, 2 items' }).click();
    await expect(page.getByText('Estimated subtotal')).toBeVisible();
    await expect(page.getByText('$44.00')).toBeVisible();
    await page.getByRole('link', { name: 'Go to checkout' }).click();

    // Checkout.
    await page.getByLabel('Address line 1').fill('10 Downing Street');
    await page.getByLabel('City').fill('London');
    await page.getByLabel('State / region').fill('London');
    await page.getByLabel('Postal code').fill('SW1A 2AA');
    await page.getByLabel('Country').fill('UK');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Coupon code (optional)').fill(seed().coupon);
    await page.getByRole('button', { name: 'Place order', exact: true }).click();

    // Confirmation shows the server-computed totals (10% of $44.00).
    await expect(page.getByRole('heading', { name: 'Thank you, your order is placed' })).toBeVisible();
    await expect(page.getByText('−$4.40')).toBeVisible();
    await expect(page.locator('.summary-row.total')).toContainText('$39.60');

    // The order appears in the history and its detail page.
    await page.getByRole('link', { name: 'View order' }).click();
    await expect(page.getByRole('heading', { name: /Placed/ })).toBeVisible();
    await expect(page.getByText('Trail Water Bottle')).toBeVisible();
    await page.getByRole('link', { name: 'All orders' }).click();
    await expect(page.getByRole('heading', { name: 'Order history' })).toBeVisible();
    await expect(page.locator('.order')).toHaveCount(1);

    // The cart was emptied by the server.
    await expect(page.getByRole('link', { name: 'Cart, 0 items' })).toBeVisible();
  });

  test('a returning customer signs in and sees their paid order', async ({ page }) => {
    const { accounts, paidOrderId } = seed();
    await signIn(page, accounts.customer, '/account/orders');
    await expect(page).toHaveURL(/\/account\/orders$/);
    await page.locator(`a[href="/account/orders/${paidOrderId}"]`).click();
    await expect(page.locator('app-status-chip').filter({ hasText: 'paid' }).first()).toBeVisible();
  });

  test('wrong credentials show one generic error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(seed().accounts.customer.email);
    await page.getByLabel('Password', { exact: true }).fill('WrongPass123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');
  });
});
