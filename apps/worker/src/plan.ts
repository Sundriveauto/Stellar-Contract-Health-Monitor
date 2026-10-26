import { createHash } from 'node:crypto';

export interface PlannableContract {
  id: string;
  network: string;
  cursor: string | null;
  lastIngestedLedger: number | null;
}

export type IngestPlanJob =
  | { kind: 'single'; jobId: string; contractRefId: string }
  | { kind: 'batch'; jobId: string; contractRefIds: string[] };

/**
 * Decides how to poll active contracts on each ingestion tick.
 *
 * Contracts that are caught up (have a cursor and lag at most `maxLagLedgers`) are grouped per
 * network into batches of `batchSize`, so one RPC call covers the whole group. Contracts still
 * backfilling, recovering from a gap or without a cursor are polled on their own so they never
 * slow a batch down.
 */
export function planIngestJobs(
  contracts: PlannableContract[],
  latestLedgerByNetwork: Map<string, number>,
  opts: { batchSize: number; maxLagLedgers: number },
): IngestPlanJob[] {
  const jobs: IngestPlanJob[] = [];
  const groups = new Map<string, PlannableContract[]>();
  for (const c of contracts) {
    const latest = latestLedgerByNetwork.get(c.network);
    const caughtUp =
      opts.batchSize > 1 &&
      c.cursor !== null &&
      c.lastIngestedLedger !== null &&
      latest !== undefined &&
      latest - c.lastIngestedLedger <= opts.maxLagLedgers;
    if (!caughtUp) {
      jobs.push({ kind: 'single', jobId: `ingest-${c.id}`, contractRefId: c.id });
      continue;
    }
    const group = groups.get(c.network) ?? [];
    group.push(c);
    groups.set(c.network, group);
  }
  for (const group of groups.values()) {
    // Stable ordering keeps batch membership (and so job IDs) steady between ticks.
    group.sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < group.length; i += opts.batchSize) {
      const ids = group.slice(i, i + opts.batchSize).map((c) => c.id);
      if (ids.length === 1) {
        jobs.push({ kind: 'single', jobId: `ingest-${ids[0]}`, contractRefId: ids[0]! });
      } else {
        const hash = createHash('sha1').update(ids.join(',')).digest('hex').slice(0, 16);
        jobs.push({ kind: 'batch', jobId: `ingest-batch-${hash}`, contractRefIds: ids });
      }
    }
  }
  return jobs;
}
