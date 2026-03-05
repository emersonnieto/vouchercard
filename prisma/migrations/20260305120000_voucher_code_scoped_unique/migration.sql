-- DropIndex
DROP INDEX "Voucher_reservationCode_key";

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_agencyId_reservationCode_key" ON "Voucher"("agencyId", "reservationCode");
