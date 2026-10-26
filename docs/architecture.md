# Architecture

```
            ┌──────────────┐  same-origin proxy   ┌──────────────┐
 Browser ──▶│  web (Next)  │ ───────────────────▶ │  api         │──┐
            └──────────────┘  (token in httpOnly  │  (Fastify)   │  │
                               session cookie)    └──────┬───────┘  │ validate contracts,
                                                         │          │ read TTLs
                                         enqueue jobs    │          ▼
            ┌──────────────┐◀──── Redis (BullMQ) ◀───────┘     Stellar RPC
            │  worker      │──────────────────────────────────▶ (getEvents,
            │  ingestion   │                                     getLedgerEntries)
            │  TTL checks  │──── webhooks / SMTP ──▶ your systems
            │  inactivity  │
            │  delivery    │
            └──────┬───────┘
                   ▼
              PostgreSQL  ◀── api reads/writes contracts, events, rules, alerts
```

## Components

| Component                 | Responsibility                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`                | Dashboard. Every browser request goes through `/api/proxy/*`, which adds the API token from an httpOnly cookie, so the token never reaches client-side JavaScript.             |
| `apps/api`                | REST API: contract registry and validation, events, alert rules, destinations, alert history, settings, health and metrics. Stateless; scale horizontally.                     |
| `apps/worker`             | Background jobs on BullMQ queues. Safe to run several replicas: schedules are idempotent and per-contract jobs are de-duplicated by job ID.                                    |
| `packages/stellar-client` | Thin wrapper over `@stellar/stellar-sdk`'s RPC server with timeouts, retries with backoff and jitter, and classified errors (`network`, `rate_limited`, `invalid_request`, …). |
| `packages/alert-engine`   | Pure functions: topic matching, rule evaluation, cooldowns, alert text, webhook signing. No I/O, fully unit-tested.                                                            |
| `packages/db`             | Prisma schema and migrations.                                                                                                                                                  |

## Event ingestion and retention

Stellar RPC only keeps a limited window of events (about 7 days on public providers), so the
monitor **stores events and the RPC cursor** instead of assuming history can be re-read:

1. On registration the API sets a start ledger (`INITIAL_LOOKBACK_LEDGERS` back, clamped to the
   oldest ledger the RPC still has) and queues an ingestion job.
2. Every `INGEST_INTERVAL_MS` the worker fans out one ingestion job per active contract. Each job
   pages through `getEvents` from the saved cursor, stores new events (de-duplicated by event ID),
   and saves the new cursor.
3. If the saved cursor has fallen out of the RPC's retention window (for example after a long
   outage), ingestion restarts from the oldest available ledger and records `gapDetectedAt` on the
   contract, which the dashboard shows. `schm_ingestion_gaps_total` counts these.
4. Events older than `EVENT_RETENTION_DAYS` are pruned every 6 hours (`0` keeps them forever).

Events that were backfilled when a contract or rule was created never trigger alerts.

## Alert rules

| Type          | Fires when                                                                                                                      | Kind                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `EVENT_MATCH` | New events match a positional topic filter (`*` = any one topic, `**` = any rest), optionally at least _N_ within a time window | Edge: one alert per match, limited by the rule cooldown         |
| `TTL_EXPIRY`  | A monitored storage entry has fewer than _N_ ledgers left before it is archived, or is already gone                             | Level: stays open until the TTL is extended, then auto-resolves |
| `INACTIVITY`  | A contract has emitted no events for a period                                                                                   | Level: auto-resolves when events resume                         |

Rules can target one contract or all contracts. Each alert creates one delivery per destination
(the rule's own, or the default destinations from Settings).

## Notification delivery

Deliveries are BullMQ jobs with exponential backoff (10 s base, `WEBHOOK_MAX_ATTEMPTS` attempts).
Timeouts, network errors, `408`, `429` and `5xx` are retried; other `4xx` responses, invalid
configuration and disabled destinations fail immediately. Every attempt is recorded and failed
deliveries can be retried from Alert history. See [webhooks.md](webhooks.md).

## Data model

`Contract` → `Event`, `StorageEntry`, `Alert`. `AlertRule` (optionally scoped to a contract) →
`AlertRuleState` (per contract: last trigger, open alert) → `Alert` → `NotificationDelivery` →
`NotificationDestination`. `NetworkConfig` overrides the RPC URL from the environment;
`NetworkState` caches the latest/oldest ledger per network. See
[`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma).
