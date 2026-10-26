import { Redis } from 'ioredis';
import { createSecretBox, disconnectPrisma, getPrisma } from '@stellar-health/db';
import { buildApp } from './app';
import { loadConfig } from './config';
import { createJobBus } from './lib/jobs';
import { createMetrics } from './lib/metrics';
import { createStellarClientFactory } from './lib/stellar';

async function main() {
  const config = loadConfig();
  const prisma = getPrisma();
  const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  const jobs = createJobBus(redis);
  const app = await buildApp({
    config,
    prisma,
    redis,
    jobs,
    stellar: createStellarClientFactory(prisma),
    metrics: createMetrics(),
    secrets: createSecretBox(config.SECRETS_ENCRYPTION_KEY),
    rateLimitRedis: redis,
  });
  if (!config.SECRETS_ENCRYPTION_KEY) {
    app.log.warn('SECRETS_ENCRYPTION_KEY is not set: webhook secrets are stored unencrypted');
  }

  if (!config.ADMIN_API_TOKEN) {
    const tokens = await prisma.apiToken.count({ where: { revokedAt: null } });
    if (tokens === 0) {
      app.log.warn(
        'No ADMIN_API_TOKEN set and no API tokens exist: nobody can sign in. Set ADMIN_API_TOKEN.',
      );
    }
  }

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 15_000);
    force.unref();
    try {
      await app.close();
      await jobs.close();
      redis.disconnect();
      await disconnectPrisma();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.API_PORT, host: config.API_HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
