/**
 * Seeds a local database with a webhook destination and starter alert rules.
 * Safe to run repeatedly. Contracts are not seeded because registration validates on-chain.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const webhookUrl = process.env.SEED_WEBHOOK_URL ?? 'http://localhost:4100/webhook';
  let destination = await prisma.notificationDestination.findFirst({
    where: { name: 'Local webhook receiver' },
  });
  if (!destination) {
    destination = await prisma.notificationDestination.create({
      data: {
        name: 'Local webhook receiver',
        type: 'WEBHOOK',
        config: { url: webhookUrl, secret: 'dev-secret-change-me-please' },
      },
    });
  }

  const existing = await prisma.alertRule.findFirst({
    where: { name: 'Any event (all contracts)' },
  });
  if (!existing) {
    await prisma.alertRule.create({
      data: {
        name: 'Any event (all contracts)',
        type: 'EVENT_MATCH',
        severity: 'INFO',
        config: { topics: [], threshold: 1, windowSeconds: 60, includeFailedCalls: false },
        cooldownSeconds: 60,
        destinations: { connect: [{ id: destination.id }] },
      },
    });
  }

  const ttl = await prisma.alertRule.findFirst({
    where: { name: 'Storage expiring within 7 days' },
  });
  if (!ttl) {
    await prisma.alertRule.create({
      data: {
        name: 'Storage expiring within 7 days',
        type: 'TTL_EXPIRY',
        severity: 'WARNING',
        config: { ledgersThreshold: 120960 },
        cooldownSeconds: 3600,
        destinations: { connect: [{ id: destination.id }] },
      },
    });
  }
  console.log('Seed complete');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
