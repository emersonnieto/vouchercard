CREATE TABLE public."PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key"
ON public."PasswordResetToken"("tokenHash");

CREATE INDEX "PasswordResetToken_userId_createdAt_idx"
ON public."PasswordResetToken"("userId", "createdAt");

CREATE INDEX "PasswordResetToken_expiresAt_idx"
ON public."PasswordResetToken"("expiresAt");

ALTER TABLE public."PasswordResetToken"
ADD CONSTRAINT "PasswordResetToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES public."User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE public."PasswordResetToken" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS password_reset_token_system_policy
ON public."PasswordResetToken";

CREATE POLICY password_reset_token_system_policy
ON public."PasswordResetToken"
FOR ALL
USING (public.rls_is_system())
WITH CHECK (public.rls_is_system());
