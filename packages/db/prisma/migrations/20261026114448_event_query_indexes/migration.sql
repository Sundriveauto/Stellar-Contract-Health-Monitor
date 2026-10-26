-- CreateIndex
CREATE INDEX "Event_contractRefId_ledgerClosedAt_idx" ON "Event"("contractRefId", "ledgerClosedAt");

-- CreateIndex
CREATE INDEX "Event_topics_idx" ON "Event" USING GIN ("topics");
