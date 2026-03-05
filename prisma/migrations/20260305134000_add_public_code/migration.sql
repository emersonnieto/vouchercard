ALTER TABLE "Voucher" ADD COLUMN "publicCode" TEXT;

UPDATE "Voucher"
SET "publicCode" = generated.code
FROM (
  SELECT
    id,
    CONCAT('VC', LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt", id)::text, 8, '0')) AS code
  FROM "Voucher"
) AS generated
WHERE generated.id = "Voucher"."id";

ALTER TABLE "Voucher" ALTER COLUMN "publicCode" SET NOT NULL;

CREATE UNIQUE INDEX "Voucher_publicCode_key" ON "Voucher"("publicCode");
