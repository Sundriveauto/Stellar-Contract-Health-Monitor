import type { WorkerDeps } from './deps';

/** Deletes events older than the retention period in batches, and stale worker heartbeats. */
export async function pruneOldData(deps: WorkerDeps) {
  const { prisma, config } = deps;
  let deleted = 0;
  if (config.EVENT_RETENTION_DAYS > 0) {
    const cutoff = new Date(deps.now().getTime() - config.EVENT_RETENTION_DAYS * 86400_000);
    for (;;) {
      const n = await prisma.$executeRaw`
        DELETE FROM "Event" WHERE id IN (
          SELECT id FROM "Event" WHERE "ledgerClosedAt" < ${cutoff} LIMIT 5000
        )`;
      deleted += n;
      if (n < 5000) break;
    }
  }
  await prisma.workerHeartbeat.deleteMany({
    where: { lastBeatAt: { lt: new Date(deps.now().getTime() - 86400_000) } },
  });
  return { deleted };
}
