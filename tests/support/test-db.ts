import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Integration tests run against their own database so they never touch dev data.
 * Override with TEST_DATABASE_URL (CI points this at its Postgres service).
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://schm:schm@localhost:5432/schm_test?schema=public';

const dbPackage = resolve(dirname(fileURLToPath(import.meta.url)), '../../packages/db');

/** Vitest globalSetup: creates (if needed) and migrates the test database once per run. */
export function migrateTestDatabase(url: string = TEST_DATABASE_URL): void {
  execFileSync(resolve(dbPackage, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: dbPackage,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}

interface RawClient {
  $queryRawUnsafe<T>(sql: string): Promise<T>;
  $executeRawUnsafe(sql: string): Promise<number>;
}

/** Empties every application table, keeping the migrations table. */
export async function resetDatabase(prisma: RawClient): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (rows.length === 0) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${rows.map((r) => `"public"."${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
