import type { PrismaClient } from '@stellar-health/db';
import { resolveNetworkConfig } from '@stellar-health/db';
import type { Network } from '@stellar-health/shared-types';
import { StellarRpcClient, type StellarClient } from '@stellar-health/stellar-client';
import type { WorkerMetrics } from './metrics';

export class NetworkNotConfiguredError extends Error {
  constructor(network: Network) {
    super(`No RPC provider configured for ${network}`);
  }
}

const CONFIG_TTL_MS = 30_000;

/**
 * Returns RPC clients per network. Network config is re-read every 30s so RPC provider
 * changes made in Settings take effect without restarting the worker.
 */
export function createClientFactory(prisma: PrismaClient, metrics: WorkerMetrics) {
  const clients = new Map<string, StellarRpcClient>();
  const resolved = new Map<Network, { rpcUrl: string; enabled: boolean; at: number }>();

  return async function getClient(network: Network): Promise<StellarClient> {
    let cfg = resolved.get(network);
    if (!cfg || Date.now() - cfg.at > CONFIG_TTL_MS) {
      const r = await resolveNetworkConfig(prisma, network);
      cfg = { rpcUrl: r.rpcUrl, enabled: r.enabled, at: Date.now() };
      resolved.set(network, cfg);
    }
    if (!cfg.rpcUrl || !cfg.enabled) throw new NetworkNotConfiguredError(network);
    let client = clients.get(cfg.rpcUrl);
    if (!client) {
      client = new StellarRpcClient({
        rpcUrl: cfg.rpcUrl,
        retries: 3,
        timeoutMs: 20_000,
        onRetry: (err) => metrics.rpcRetries.labels(err.kind).inc(),
        onCall: (method, ms, ok) => {
          metrics.rpcCalls.labels(method, ok ? 'ok' : 'error').inc();
          metrics.rpcDuration.labels(method).observe(ms / 1000);
        },
      });
      clients.set(cfg.rpcUrl, client);
    }
    return client;
  };
}
