CREATE INDEX "AgencySubscription_status_agencyId_activatedAt_createdAt_idx"
ON public."AgencySubscription"("status", "agencyId", "activatedAt", "createdAt");
