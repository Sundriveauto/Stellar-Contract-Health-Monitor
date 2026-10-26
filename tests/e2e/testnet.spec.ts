import { expect, test } from './fixtures';

/**
 * The project's success criterion against a live network: register a real testnet contract
 * and see it monitored. Opt-in because it depends on the public testnet RPC.
 *   E2E_TESTNET=1 pnpm test:e2e
 */
test.skip(!process.env.E2E_TESTNET, 'set E2E_TESTNET=1 to run against Stellar testnet');

// USDC Stellar Asset Contract on testnet.
const TESTNET_CONTRACT =
  process.env.E2E_TESTNET_CONTRACT ?? 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

test('registers a real testnet contract', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/contracts/new');
  await page.getByLabel('Contract ID').fill(TESTNET_CONTRACT);
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByRole('button', { name: 'Start monitoring' })).toBeEnabled({
    timeout: 30_000,
  });
  await page.getByLabel('Label (optional)').fill('Testnet E2E');
  await page.getByRole('button', { name: 'Start monitoring' }).click();
  await expect(page.getByRole('heading', { name: 'Testnet E2E' })).toBeVisible({ timeout: 30_000 });
});
