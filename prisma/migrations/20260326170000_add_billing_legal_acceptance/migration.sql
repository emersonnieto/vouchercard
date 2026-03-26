CREATE TABLE public."BillingLegalAcceptance" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "agencyId" TEXT,
    "subscriptionId" TEXT,
    "publicToken" TEXT,
    "statementText" TEXT NOT NULL,
    "statementHash" TEXT NOT NULL,
    "termsTitle" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "termsHash" TEXT NOT NULL,
    "termsText" TEXT NOT NULL,
    "privacyTitle" TEXT NOT NULL,
    "privacyVersion" TEXT NOT NULL,
    "privacyHash" TEXT NOT NULL,
    "privacyText" TEXT NOT NULL,
    "bundleHash" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptLanguage" TEXT,
    "requestPath" TEXT,
    "origin" TEXT,
    "referer" TEXT,

    CONSTRAINT "BillingLegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingLegalAcceptance_email_acceptedAt_idx"
ON public."BillingLegalAcceptance"("email", "acceptedAt");

CREATE INDEX "BillingLegalAcceptance_agencyId_acceptedAt_idx"
ON public."BillingLegalAcceptance"("agencyId", "acceptedAt");

CREATE INDEX "BillingLegalAcceptance_subscriptionId_idx"
ON public."BillingLegalAcceptance"("subscriptionId");

CREATE INDEX "BillingLegalAcceptance_publicToken_idx"
ON public."BillingLegalAcceptance"("publicToken");

CREATE INDEX "BillingLegalAcceptance_kind_acceptedAt_idx"
ON public."BillingLegalAcceptance"("kind", "acceptedAt");

ALTER TABLE public."BillingLegalAcceptance" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_legal_acceptance_system_policy
ON public."BillingLegalAcceptance";

CREATE POLICY billing_legal_acceptance_system_policy
ON public."BillingLegalAcceptance"
FOR ALL
USING (public.rls_is_system())
WITH CHECK (public.rls_is_system());
