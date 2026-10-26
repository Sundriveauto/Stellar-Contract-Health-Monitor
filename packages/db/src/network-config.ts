import type { PrismaClient } from '@prisma/client';
import { NETWORK_DEFAULTS, NETWORKS, type Network } from '@stellar-health/shared-types';

export interface ResolvedNetworkConfig {
  network: Network;
  rpcUrl: string;
  networkPassphrase: string;
  enabled: boolean;
  source: 'database' | 'environment' | 'default' | 'unconfigured';
}

function envRpcUrl(network: Network, env: NodeJS.ProcessEnv): string | undefined {
  const value = env[`${network}_RPC_URL`]?.trim();
  return value ? value : undefined;
}

/** Resolves the RPC provider for a network: database override → env var → built-in default. */
export async function resolveNetworkConfig(
  prisma: PrismaClient,
  network: Network,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResolvedNetworkConfig> {
  const row = await prisma.networkConfig.findUnique({ where: { network } });
  if (row) {
    return {
      network,
      rpcUrl: row.rpcUrl,
      networkPassphrase: row.networkPassphrase,
      enabled: row.enabled,
      source: 'database',
    };
  }
  const defaults = NETWORK_DEFAULTS[network];
  const fromEnv = envRpcUrl(network, env);
  if (fromEnv) {
    return {
      network,
      rpcUrl: fromEnv,
      networkPassphrase: defaults.networkPassphrase,
      enabled: true,
      source: 'environment',
    };
  }
  if (defaults.rpcUrl) {
    return {
      network,
      rpcUrl: defaults.rpcUrl,
      networkPassphrase: defaults.networkPassphrase,
      enabled: true,
      source: 'default',
    };
  }
  return {
    network,
    rpcUrl: '',
    networkPassphrase: defaults.networkPassphrase,
    enabled: false,
    source: 'unconfigured',
  };
}

export async function resolveAllNetworkConfigs(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResolvedNetworkConfig[]> {
  return Promise.all(NETWORKS.map((n) => resolveNetworkConfig(prisma, n, env)));
}
