import type { Logger } from 'pino';
import type { PrismaClient, SecretBox } from '@stellar-health/db';
import type { Network } from '@stellar-health/shared-types';
import type { StellarClient } from '@stellar-health/stellar-client';
import type { WorkerConfig } from './config';
import type { WorkerMetrics } from './metrics';

/** Everything the job handlers need. Kept as an interface so tests can supply fakes. */
export interface WorkerDeps {
  config: WorkerConfig;
  prisma: PrismaClient;
  logger: Logger;
  metrics: WorkerMetrics;
  getClient(network: Network): Promise<StellarClient>;
  enqueueDelivery(deliveryId: string): Promise<void>;
  now(): Date;
  /** Decrypts webhook secrets stored by the API. */
  secrets: SecretBox;
}
