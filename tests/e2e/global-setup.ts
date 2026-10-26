import { PrismaClient } from '../../packages/db/src/index';
import { E2E_DATABASE_URL } from '../../playwright.config';
import { migrateTestDatabase, resetDatabase } from '../support/test-db';
import { SEED } from './seed-data';

/** Creates a known dataset so the dashboard can be exercised without depending on a live network. */
export default async function globalSetup() {
  migrateTestDatabase(E2E_DATABASE_URL);
  const prisma = new PrismaClient({ datasourceUrl: E2E_DATABASE_URL });
  try {
    await resetDatabase(prisma);
    const now = Date.now();
    await prisma.networkState.create({
      data: {
        network: 'TESTNET',
        latestLedger: 100_000,
        oldestLedger: 80_000,
        lastCheckedAt: new Date(),
      },
    });
    const contract = await prisma.contract.create({
      data: {
        contractId: SEED.contractId,
        network: 'TESTNET',
        label: SEED.contractLabel,
        executableType: 'stellar_asset',
        startLedger: 90_000,
        lastIngestedLedger: 100_000,
        lastPolledAt: new Date(),
        lastEventAt: new Date(now - 60_000),
        eventCount: 30,
        storageEntries: {
          create: {
            kind: 'INSTANCE',
            label: 'Contract instance',
            ledgerKeyXdr: 'seed-instance',
            liveUntilLedger: 400_000,
          },
        },
      },
    });
    await prisma.event.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        contractRefId: contract.id,
        eventId: `${String(99_970 + i).padStart(19, '0')}-0000000001`,
        network: 'TESTNET' as const,
        type: 'contract',
        ledger: 99_970 + i,
        ledgerClosedAt: new Date(now - (30 - i) * 60_000),
        txHash: i === 7 ? SEED.txHash : (i % 10).toString(16).repeat(64),
        topics: [i % 3 === 0 ? 'mint' : 'transfer', 'GAAAA', 'GBBBB'],
        topicsXdr: [],
        value: String(i * 100),
        valueXdr: '',
        inSuccessfulContractCall: true,
      })),
    });
    const destination = await prisma.notificationDestination.create({
      data: {
        name: SEED.destinationName,
        type: 'WEBHOOK',
        config: { url: 'https://example.com/hook', secret: 'whsec_seed_secret_0123456789' },
      },
    });
    const rule = await prisma.alertRule.create({
      data: {
        name: SEED.ruleName,
        type: 'EVENT_MATCH',
        config: { topics: ['mint'] },
        destinations: { connect: { id: destination.id } },
      },
    });
    await prisma.alert.create({
      data: {
        ruleId: rule.id,
        contractRefId: contract.id,
        severity: 'CRITICAL',
        title: SEED.alertTitle,
        message: 'Seeded alert for end-to-end tests',
        context: {},
        deliveries: {
          create: {
            destinationId: destination.id,
            kind: 'alert.triggered',
            status: 'FAILED',
            attempts: 6,
            lastError: 'Webhook responded 500',
          },
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
