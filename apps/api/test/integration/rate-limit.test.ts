import { Redis } from 'ioredis';
import { afterAll, describe, expect, it } from 'vitest';
import { disconnectPrisma } from '@stellar-health/db';
import { createTestApp } from './helpers';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 1,
});

afterAll(async () => {
  redis.disconnect();
  await disconnectPrisma();
});

describe('rate limiting', () => {
  it('shares one budget across API replicas through Redis', async () => {
    const keys = await redis.keys('schm-ratelimit:*');
    if (keys.length) await redis.del(...keys);
    const a = await createTestApp({ rateLimit: 4, rateLimitRedis: redis });
    const b = await createTestApp({ rateLimit: 4, rateLimitRedis: redis });
    try {
      const codes: number[] = [];
      for (let i = 0; i < 6; i++) {
        const app = i % 2 === 0 ? a.app : b.app;
        codes.push((await app.inject({ url: '/auth/me' })).statusCode);
      }
      // 4 requests are allowed in total (401: no token), the rest are limited on both replicas.
      expect(codes).toEqual([401, 401, 401, 401, 429, 429]);
      // Health checks are never limited.
      expect((await a.app.inject({ url: '/health' })).statusCode).toBe(200);
    } finally {
      await a.app.close();
      await b.app.close();
    }
  });
});
