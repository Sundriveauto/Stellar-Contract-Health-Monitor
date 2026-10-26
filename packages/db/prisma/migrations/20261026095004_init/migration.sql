-- CreateEnum
CREATE TYPE "Network" AS ENUM ('TESTNET', 'MAINNET', 'FUTURENET', 'LOCAL');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "StorageEntryKind" AS ENUM ('INSTANCE', 'CODE', 'PERSISTENT', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "AlertRuleType" AS ENUM ('EVENT_MATCH', 'TTL_EXPIRY', 'INACTIVITY');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DestinationType" AS ENUM ('WEBHOOK', 'EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "NetworkConfig" (
    "network" "Network" NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "networkPassphrase" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkConfig_pkey" PRIMARY KEY ("network")
);

-- CreateTable
CREATE TABLE "NetworkState" (
    "network" "Network" NOT NULL,
    "latestLedger" INTEGER,
    "oldestLedger" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkState_pkey" PRIMARY KEY ("network")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "label" TEXT,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "executableType" TEXT,
    "wasmHash" TEXT,
    "cursor" TEXT,
    "startLedger" INTEGER NOT NULL,
    "lastIngestedLedger" INTEGER,
    "lastEventAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "gapDetectedAt" TIMESTAMP(3),
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "contractRefId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "type" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "ledgerClosedAt" TIMESTAMP(3) NOT NULL,
    "txHash" TEXT NOT NULL,
    "topics" TEXT[],
    "topicsXdr" TEXT[],
    "value" JSONB NOT NULL,
    "valueXdr" TEXT NOT NULL,
    "inSuccessfulContractCall" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageEntry" (
    "id" TEXT NOT NULL,
    "contractRefId" TEXT NOT NULL,
    "kind" "StorageEntryKind" NOT NULL,
    "label" TEXT NOT NULL,
    "ledgerKeyXdr" TEXT NOT NULL,
    "exists" BOOLEAN NOT NULL DEFAULT true,
    "liveUntilLedger" INTEGER,
    "lastCheckedLedger" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AlertRuleType" NOT NULL,
    "contractRefId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "config" JSONB NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 300,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRuleState" (
    "ruleId" TEXT NOT NULL,
    "contractRefId" TEXT NOT NULL,
    "lastTriggeredAt" TIMESTAMP(3),
    "openAlertId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRuleState_pkey" PRIMARY KEY ("ruleId","contractRefId")
);

-- CreateTable
CREATE TABLE "NotificationDestination" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DestinationType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "contractRefId" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'TRIGGERED',
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "alertId" TEXT,
    "destinationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'alert.triggered',
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 6,
    "responseStatus" INTEGER,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiToken" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WorkerHeartbeat" (
    "name" TEXT NOT NULL,
    "lastBeatAt" TIMESTAMP(3) NOT NULL,
    "info" JSONB NOT NULL,

    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "_AlertRuleToNotificationDestination" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AlertRuleToNotificationDestination_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_network_contractId_key" ON "Contract"("network", "contractId");

-- CreateIndex
CREATE INDEX "Event_contractRefId_ledger_eventId_idx" ON "Event"("contractRefId", "ledger" DESC, "eventId" DESC);

-- CreateIndex
CREATE INDEX "Event_ledger_eventId_idx" ON "Event"("ledger" DESC, "eventId" DESC);

-- CreateIndex
CREATE INDEX "Event_txHash_idx" ON "Event"("txHash");

-- CreateIndex
CREATE INDEX "Event_ledgerClosedAt_idx" ON "Event"("ledgerClosedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_contractRefId_eventId_key" ON "Event"("contractRefId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageEntry_contractRefId_ledgerKeyXdr_key" ON "StorageEntry"("contractRefId", "ledgerKeyXdr");

-- CreateIndex
CREATE INDEX "AlertRule_contractRefId_idx" ON "AlertRule"("contractRefId");

-- CreateIndex
CREATE INDEX "Alert_triggeredAt_idx" ON "Alert"("triggeredAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_contractRefId_idx" ON "Alert"("contractRefId");

-- CreateIndex
CREATE INDEX "Alert_ruleId_idx" ON "Alert"("ruleId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_alertId_idx" ON "NotificationDelivery"("alertId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_destinationId_idx" ON "NotificationDelivery"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "_AlertRuleToNotificationDestination_B_index" ON "_AlertRuleToNotificationDestination"("B");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_contractRefId_fkey" FOREIGN KEY ("contractRefId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageEntry" ADD CONSTRAINT "StorageEntry_contractRefId_fkey" FOREIGN KEY ("contractRefId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_contractRefId_fkey" FOREIGN KEY ("contractRefId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRuleState" ADD CONSTRAINT "AlertRuleState_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_contractRefId_fkey" FOREIGN KEY ("contractRefId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "NotificationDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlertRuleToNotificationDestination" ADD CONSTRAINT "_AlertRuleToNotificationDestination_A_fkey" FOREIGN KEY ("A") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AlertRuleToNotificationDestination" ADD CONSTRAINT "_AlertRuleToNotificationDestination_B_fkey" FOREIGN KEY ("B") REFERENCES "NotificationDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
