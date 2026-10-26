import { expect, test } from '@playwright/test';

test('redirects to sign-in and rejects a wrong token', async ({ page }) => {
  await page.goto('/events');
  await expect(page).toHaveURL(/\/login\?next=%2Fevents/);
  await page.locator('#token').fill('definitely-not-valid');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByText(/invalid|revoked/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
