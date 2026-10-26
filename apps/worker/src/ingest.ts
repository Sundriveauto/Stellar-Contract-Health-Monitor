import type { Contract, Prisma } from '@stellar-health/db';
import {
  describeEventMatch,
  evaluateEventMatch,
  isCoolingDown,
  type EventLike,
} from '@stellar-health/alert-engine';
import { eventMatchConfigSchema, type Network } from '@stellar-health/shared-types';
import {
  isOutOfRetentionError,
  RpcError,
  type EventsPage,
  type NormalizedEvent,
} from '@stellar-health/stellar-client';
import { activeRulesFor, triggerAlert } from './alerts';
import type { WorkerDeps } from './deps';

export interface IngestResult {
  skipped?: 'not_found' | 'not_active';
  pages: number;
  fetched: number;
  inserted: number;
  latestLedger: number | null;
  gap: boolean;
}

/** Events older than this, relative to when a rule/contract was created, never trigger alerts (backfill). */
const BACKFILL_GRACE_MS = 60_000;

/**
 * Pulls new events for one contract, persisting them and the RPC cursor.
 *
 * RPC only retains a limited window of events (~7 days on public providers), so:
 *  - a missing cursor starts from `startLedger`, clamped to the oldest retained ledger;
 *  - a cursor that has fallen out of retention is reset to the oldest ledger and the gap is recorded.
 */
export async function ingestContract(
  deps: WorkerDeps,
  contractRefId: string,
): Promise<IngestResult> {
  const { prisma, config, metrics, logger } = deps;
  const contract = await prisma.contract.findUnique({ where: { id: contractRefId } });
  if (!contract)
    return {
      skipped: 'not_found',
      pages: 0,
      fetched: 0,
      inserted: 0,
      latestLedger: null,
      gap: false,
    };
  if (contract.status !== 'ACTIVE') {
    return {
      skipped: 'not_active',
      pages: 0,
      fetched: 0,
      inserted: 0,
      latestLedger: null,
      gap: false,
    };
  }
  const network = contract.network as Network;
  const timer = metrics.ingestDuration.labels(network).startTimer();

  try {
    const client = await deps.getClient(network);
    let cursor = contract.cursor;
    let startLedger = contract.startLedger;
    let gap = false;
    let oldestLedger: number | null = null;

    if (!cursor) {
      const health = await client.getHealth();
      oldestLedger = health.oldestLedger;
      if (startLedger <= health.oldestLedger) {
        if (contract.lastIngestedLedger !== null) gap = true;
        startLedger = health.oldestLedger + 1;
      }
    }

    const newEvents: NormalizedEvent[] = [];
    let latestLedger: number | null = null;
    let pages = 0;
    let fetched = 0;
    let resetOnce = false;

    while (pages < config.INGEST_MAX_PAGES) {
      let page: EventsPage;
      try {
        page = cursor
          ? await client.getEvents({
              contractIds: [contract.contractId],
              cursor,
              limit: config.INGEST_PAGE_LIMIT,
            })
          : await client.getEvents({
              contractIds: [contract.contractId],
              startLedger,
              limit: config.INGEST_PAGE_LIMIT,
            });
      } catch (err) {
        const retention =
          isOutOfRetentionError(err) || (err instanceof RpcError && err.kind === 'invalid_request');
        if (!retention || resetOnce) throw err;
        // Our cursor/start ledger is no longer available: restart from the oldest retained ledger.
        resetOnce = true;
        const health = await client.getHealth();
        oldestLedger = health.oldestLedger;
        logger.warn(
          { contractRefId, err: (err as Error).message, oldest: health.oldestLedger },
          'ingestion position out of retention, resetting',
        );
        cursor = null;
        startLedger = health.oldestLedger + 1;
        gap = true;
        continue;
      }
      pages++;
      fetched += page.events.length;
      latestLedger = page.latestLedger;
      oldestLedger = page.oldestLedger;
      cursor = page.cursor || cursor;
      newEvents.push(...(await storeEvents(deps, contract, page.events)));
      if (page.events.length < config.INGEST_PAGE_LIMIT) break;
    }

    const lastEventAt = newEvents.reduce<Date | null>(
      (max, e) => (!max || e.ledgerClosedAt > max ? e.ledgerClosedAt : max),
      contract.lastEventAt,
    );
    // Older RPC versions may not return a cursor; then advance the start ledger instead of rescanning.
    if (!cursor && latestLedger !== null) startLedger = Math.max(startLedger, latestLedger);
    const now = deps.now();
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        cursor,
        startLedger,
        lastIngestedLedger: latestLedger ?? contract.lastIngestedLedger,
        lastPolledAt: now,
        lastEventAt,
        lastError: null,
        consecutiveFailures: 0,
        eventCount: { increment: newEvents.length },
        ...(gap ? { gapDetectedAt: now } : {}),
      },
    });
    if (latestLedger !== null) {
      await prisma.networkState.upsert({
        where: { network },
        create: { network, latestLedger, oldestLedger, lastCheckedAt: now },
        update: {
          latestLedger,
          oldestLedger: oldestLedger ?? undefined,
          lastCheckedAt: now,
          lastError: null,
        },
      });
    }

    metrics.eventsIngested.labels(network).inc(newEvents.length);
    metrics.ingestRuns.labels(network, 'ok').inc();
    if (gap) metrics.ingestionGaps.labels(network).inc();

    if (newEvents.length > 0) await evaluateEventRules(deps, contract, newEvents);

    return { pages, fetched, inserted: newEvents.length, latestLedger, gap };
  } catch (err) {
    metrics.ingestRuns.labels(network, 'error').inc();
    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        lastPolledAt: deps.now(),
        lastError: (err as Error).message.slice(0, 1000),
        consecutiveFailures: { increment: 1 },
      },
    });
    throw err;
  } finally {
    timer();
  }
}

/** Inserts events, returning only those that were not already stored. */
async function storeEvents(
  deps: WorkerDeps,
  contract: Contract,
  events: NormalizedEvent[],
): Promise<NormalizedEvent[]> {
  const relevant = events.filter(
    (e) => e.contractId === null || e.contractId === contract.contractId,
  );
  if (relevant.length === 0) return [];
  const existing = await deps.prisma.event.findMany({
    where: { contractRefId: contract.id, eventId: { in: relevant.map((e) => e.id) } },
    select: { eventId: true },
  });
  const seen = new Set(existing.map((e) => e.eventId));
  const fresh = relevant.filter((e) => !seen.has(e.id));
  if (fresh.length === 0) return [];
  await deps.prisma.event.createMany({
    data: fresh.map((e) => ({
      contractRefId: contract.id,
      eventId: e.id,
      network: contract.network,
      type: e.type,
      ledger: e.ledger,
      ledgerClosedAt: e.ledgerClosedAt,
      txHash: e.txHash,
      topics: e.topics,
      topicsXdr: e.topicsXdr,
      value: (e.value ?? null) as Prisma.InputJsonValue,
      valueXdr: e.valueXdr,
      inSuccessfulContractCall: e.inSuccessfulContractCall,
    })),
    skipDuplicates: true,
  });
  return fresh;
}

function toEventLike(e: NormalizedEvent): EventLike {
  return {
    eventId: e.id,
    topics: e.topics,
    ledger: e.ledger,
    ledgerClosedAt: e.ledgerClosedAt,
    txHash: e.txHash,
    inSuccessfulContractCall: e.inSuccessfulContractCall,
  };
}

export async function evaluateEventRules(
  deps: WorkerDeps,
  contract: Contract,
  newEvents: NormalizedEvent[],
) {
  const rules = await activeRulesFor(deps, contract.id, 'EVENT_MATCH');
  const now = deps.now();
  for (const rule of rules) {
    try {
      const config = eventMatchConfigSchema.parse(rule.config);
      // Don't alert on history that was backfilled when the contract or rule was created.
      const since =
        Math.max(contract.createdAt.getTime(), rule.createdAt.getTime()) - BACKFILL_GRACE_MS;
      const candidates = newEvents
        .filter((e) => e.ledgerClosedAt.getTime() >= since)
        .map(toEventLike);
      if (candidates.length === 0) continue;

      let windowEvents: EventLike[] = [];
      if (config.threshold > 1) {
        const rows = await deps.prisma.event.findMany({
          where: {
            contractRefId: contract.id,
            ledgerClosedAt: { gte: new Date(now.getTime() - config.windowSeconds * 1000) },
          },
          select: {
            eventId: true,
            topics: true,
            ledger: true,
            ledgerClosedAt: true,
            txHash: true,
            inSuccessfulContractCall: true,
          },
          orderBy: { ledger: 'desc' },
          take: 10_000,
        });
        windowEvents = rows;
      }

      const result = evaluateEventMatch({ config, newEvents: candidates, windowEvents, now });
      if (!result.triggered) continue;

      const state = await deps.prisma.alertRuleState.findUnique({
        where: { ruleId_contractRefId: { ruleId: rule.id, contractRefId: contract.id } },
      });
      if (isCoolingDown(state?.lastTriggeredAt ?? null, rule.cooldownSeconds, now)) {
        deps.logger.debug(
          { ruleId: rule.id, contractRefId: contract.id },
          'event rule matched during cooldown',
        );
        continue;
      }
      await triggerAlert(deps, {
        rule,
        contract,
        severity: rule.severity,
        level: false,
        description: describeEventMatch({
          ruleName: rule.name,
          contract,
          matched: result.matched,
          windowCount: result.windowCount,
          threshold: config.threshold,
          windowSeconds: config.windowSeconds,
        }),
      });
    } catch (err) {
      deps.logger.error(
        { err, ruleId: rule.id, contractRefId: contract.id },
        'failed to evaluate event rule',
      );
    }
  }
}
