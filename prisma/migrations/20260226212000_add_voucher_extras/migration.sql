-- CreateTable
CREATE TABLE "Stopover" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "location" TEXT,
    "duration" TEXT,
    "additionalNotes" TEXT,

    CONSTRAINT "Stopover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tour" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateTime" TEXT,
    "meetingPoint" TEXT,
    "additionalNotes" TEXT,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TravelInsurance" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerPhone" TEXT,
    "additionalNotes" TEXT,

    CONSTRAINT "TravelInsurance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Stopover_voucherId_key" ON "Stopover"("voucherId");

-- CreateIndex
CREATE INDEX "Tour_voucherId_idx" ON "Tour"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "TravelInsurance_voucherId_key" ON "TravelInsurance"("voucherId");

-- AddForeignKey
ALTER TABLE "Stopover" ADD CONSTRAINT "Stopover_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tour" ADD CONSTRAINT "Tour_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelInsurance" ADD CONSTRAINT "TravelInsurance_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
