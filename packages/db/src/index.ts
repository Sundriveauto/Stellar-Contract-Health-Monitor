import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

const globalForPrisma = globalThis as unknown as { __schmPrisma?: PrismaClient };

/**
 * Returns a process-wide Prisma client. Reusing one instance avoids exhausting
 * database connections during dev hot reloads.
 */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__schmPrisma) {
    globalForPrisma.__schmPrisma = new PrismaClient({
      log:
        process.env.PRISMA_LOG_QUERIES === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return globalForPrisma.__schmPrisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (globalForPrisma.__schmPrisma) {
    await globalForPrisma.__schmPrisma.$disconnect();
    globalForPrisma.__schmPrisma = undefined;
  }
}

export * from './network-config';
