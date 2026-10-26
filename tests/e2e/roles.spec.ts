import { expect, test } from '@playwright/test';
import { SEED } from './seed-data';

test('a viewer token can browse but not change anything', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#token').fill(SEED.viewerToken);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId('signed-in-as')).toHaveText('E2E viewer · viewer');

  await page.goto('/settings');
  await expect(page.getByText('Signed in with a viewer token')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'API tokens' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Audit log' })).toHaveCount(0);

  await page.goto('/alerts/rules');
  await page.getByRole('button', { name: 'New rule' }).click();
  await page.locator('#r-name').fill('Viewer rule');
  await page.getByRole('button', { name: 'Create rule' }).click();
  await expect(page.getByText(/needs the editor role/)).toBeVisible();
});
