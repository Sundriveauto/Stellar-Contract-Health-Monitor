export const NETWORKS = ['TESTNET', 'MAINNET', 'FUTURENET', 'LOCAL'] as const;
export type Network = (typeof NETWORKS)[number];

export interface NetworkDefaults {
  rpcUrl: string;
  networkPassphrase: string;
}

/**
 * Defaults used when no RPC provider has been configured for a network.
 * Mainnet has no free public RPC endpoint run by SDF, so it must be configured
 * explicitly (env MAINNET_RPC_URL or the Settings screen).
 */
export const NETWORK_DEFAULTS: Record<Network, NetworkDefaults> = {
  TESTNET: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
  },
  MAINNET: {
    rpcUrl: '',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
  },
  FUTURENET: {
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    networkPassphrase: 'Test SDF Future Network ; October 2022',
  },
  LOCAL: {
    rpcUrl: 'http://localhost:8000/rpc',
    networkPassphrase: 'Standalone Network ; February 2017',
  },
};

/** Average ledger close time on Stellar, used to estimate wall-clock time from ledger counts. */
export const AVG_LEDGER_SECONDS = 5;
