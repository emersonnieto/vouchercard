/*
  Warnings:

  - A unique constraint covering the columns `[reservationCode]` on the table `Voucher` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Voucher_agencyId_reservationCode_key";

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_reservationCode_key" ON "Voucher"("reservationCode");
