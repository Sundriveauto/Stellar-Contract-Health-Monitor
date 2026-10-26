/** BullMQ queue names shared by the API (producer) and worker (consumer). */
export const QUEUES = {
  scheduler: 'scheduler',
  ingest: 'ingest',
  storage: 'storage',
  notifications: 'notifications',
} as const;

export interface IngestJobData {
  contractRefId: string;
}

export interface StorageJobData {
  contractRefId: string;
}

export interface NotificationJobData {
  deliveryId: string;
}

export type SchedulerJobName = 'tick-ingest' | 'tick-storage' | 'tick-inactivity' | 'prune-events';
