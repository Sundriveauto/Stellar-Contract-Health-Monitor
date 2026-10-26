import { describe, expect, it } from 'vitest';
import { planIngestJobs, type PlannableContract } from '../../src/plan';

const c = (id: string, over: Partial<PlannableContract> = {}): PlannableContract => ({
  id,
  network: 'TESTNET',
  cursor: 'cur',
  lastIngestedLedger: 1000,
  ...over,
});
const latest = new Map([
  ['TESTNET', 1010],
  ['MAINNET', 5000],
]);

describe('planIngestJobs', () => {
  it('batches caught-up contracts per network and polls the rest individually', () => {
    const jobs = planIngestJobs(
      [
        c('a'),
        c('b'),
        c('c', { network: 'MAINNET', lastIngestedLedger: 4990 }),
        c('d', { network: 'MAINNET', lastIngestedLedger: 4995 }),
        c('new', { cursor: null, lastIngestedLedger: null }),
        c('behind', { lastIngestedLedger: 1 }),
        c('unknown-net', { network: 'FUTURENET' }),
      ],
      latest,
      { batchSize: 25, maxLagLedgers: 100 },
    );
    const batches = jobs.filter((j) => j.kind === 'batch').map((j) => j.contractRefIds);
    const singles = jobs.filter((j) => j.kind === 'single').map((j) => j.contractRefId);
    expect(batches).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(singles.sort()).toEqual(['behind', 'new', 'unknown-net']);
  });

  it('splits large groups by batch size with stable job IDs', () => {
    const many = Array.from({ length: 7 }, (_, i) => c(`k${i}`));
    const first = planIngestJobs(many, latest, { batchSize: 3, maxLagLedgers: 100 });
    const second = planIngestJobs([...many].reverse(), latest, {
      batchSize: 3,
      maxLagLedgers: 100,
    });
    expect(first.map((j) => j.kind)).toEqual(['batch', 'batch', 'single']);
    expect(first.map((j) => j.jobId)).toEqual(second.map((j) => j.jobId));
  });

  it('disables batching when the batch size is 1', () => {
    const jobs = planIngestJobs([c('a'), c('b')], latest, { batchSize: 1, maxLagLedgers: 100 });
    expect(jobs.every((j) => j.kind === 'single')).toBe(true);
  });
});
