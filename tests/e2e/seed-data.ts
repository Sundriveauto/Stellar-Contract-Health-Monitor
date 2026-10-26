export const SEED = {
  // Native XLM Stellar Asset Contract on testnet (a valid, checksummed contract ID).
  contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  contractLabel: 'E2E Token',
  txHash: 'c0ffee'.repeat(10) + 'c0ff',
  destinationName: 'Seed webhook',
  ruleName: 'Seed mint rule',
  alertTitle: 'Seeded mint alert on E2E Token',
} as const;
