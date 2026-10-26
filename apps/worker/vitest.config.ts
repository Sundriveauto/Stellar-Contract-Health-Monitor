import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from '../../tests/support/test-db';

const integration = process.argv.some((a) => a.includes('test/integration'));

export default defineConfig({
  test: {
    ...(integration
      ? {
          globalSetup: ['../../tests/support/global-setup.ts'],
          env: { DATABASE_URL: TEST_DATABASE_URL, LOG_LEVEL: 'silent' },
          testTimeout: 20_000,
          hookTimeout: 60_000,
        }
      : {}),
  },
});
