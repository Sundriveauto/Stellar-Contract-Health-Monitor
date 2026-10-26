import { test as base, expect } from '@playwright/test';
import { E2E_ADMIN_TOKEN } from '../../playwright.config';

/** A page that is already signed in to the dashboard. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/login');
    await page.locator('#token').fill(E2E_ADMIN_TOKEN);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await use(page);
  },
});
export { expect };
