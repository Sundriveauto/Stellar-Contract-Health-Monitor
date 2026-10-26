import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the real API and dashboard against a dedicated, seeded database.
 * Build the dashboard first (`pnpm --filter @stellar-health/web build`). Postgres must be running.
 * Set E2E_TESTNET=1 to also register a real contract on Stellar testnet.
 */
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://schm:schm@localhost:5432/schm_e2e?schema=public';
export const E2E_ADMIN_TOKEN = 'e2e-admin-token-0123456789abcdef';
const API_PORT = 4010;
const WEB_PORT = 3010;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --dir apps/api exec tsx src/index.ts',
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
        API_PORT: String(API_PORT),
        ADMIN_API_TOKEN: E2E_ADMIN_TOKEN,
        LOG_LEVEL: 'warn',
        NODE_ENV: 'test',
      },
    },
    {
      command: `pnpm --dir apps/web exec next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
