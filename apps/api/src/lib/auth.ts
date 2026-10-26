import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { PrismaClient } from '@stellar-health/db';
import { HttpError } from './errors';
import { hashToken, safeEqual } from './tokens';

export interface Principal {
  type: 'admin' | 'token';
  id: string;
  name: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    principal?: Principal;
  }
  interface FastifyContextConfig {
    /** Set to true on routes that do not require an API token. */
    public?: boolean;
  }
}

export interface AuthOptions {
  prisma: PrismaClient;
  adminToken?: string;
}

function extractToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  const alt = req.headers['x-api-key'];
  if (typeof alt === 'string' && alt.trim()) return alt.trim();
  return null;
}

/**
 * Bearer-token authentication. Tokens are stored hashed; the bootstrap admin token comes from env.
 * Routes opt out with `config: { public: true }`.
 */
export const authPlugin = fp<AuthOptions>(async (app: FastifyInstance, opts) => {
  const lastUsedWrites = new Map<string, number>();

  app.addHook('onRequest', async (req) => {
    if (req.routeOptions.config?.public) return;
    if (req.method === 'OPTIONS') return;
    const token = extractToken(req);
    if (!token) throw new HttpError(401, 'UNAUTHORIZED', 'Missing API token');

    if (opts.adminToken && safeEqual(token, opts.adminToken)) {
      req.principal = { type: 'admin', id: 'admin', name: 'Admin (bootstrap token)' };
      return;
    }
    const row = await opts.prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.revokedAt)
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or revoked API token');
    req.principal = { type: 'token', id: row.id, name: row.name };

    // Throttle lastUsedAt writes to once a minute per token.
    const now = Date.now();
    if ((lastUsedWrites.get(row.id) ?? 0) < now - 60_000) {
      lastUsedWrites.set(row.id, now);
      opts.prisma.apiToken
        .update({ where: { id: row.id }, data: { lastUsedAt: new Date(now) } })
        .catch((err) => req.log.warn({ err }, 'failed to update token lastUsedAt'));
    }
  });
});
