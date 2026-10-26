import type { PrismaClient } from '@stellar-health/db';
import { resolveNetworkConfig } from '@stellar-health/db';
import type { Network } from '@stellar-health/shared-types';
import { StellarRpcClient, type StellarClient } from '@stellar-health/stellar-client';
import { HttpError } from './errors';

export type StellarClientFactory = (network: Network) => Promise<StellarClient>;

/** Builds RPC clients from the current network configuration, caching one per RPC URL. */
export function createStellarClientFactory(prisma: PrismaClient): StellarClientFactory {
  const cache = new Map<string, StellarRpcClient>();
  return async (network) => {
    const cfg = await resolveNetworkConfig(prisma, network);
    if (!cfg.rpcUrl || !cfg.enabled) {
      throw new HttpError(
        422,
        'NETWORK_NOT_CONFIGURED',
        `No RPC provider is configured for ${network}. Add one in Settings.`,
      );
    }
    let client = cache.get(cfg.rpcUrl);
    if (!client) {
      client = new StellarRpcClient({ rpcUrl: cfg.rpcUrl, retries: 2, timeoutMs: 10_000 });
      cache.set(cfg.rpcUrl, client);
    }
    return client;
  };
}
