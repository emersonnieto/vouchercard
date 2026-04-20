ALTER TABLE "AgencySubscription" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

CREATE INDEX "AgencySubscription_status_trialEndsAt_idx" ON "AgencySubscription"("status", "trialEndsAt");
