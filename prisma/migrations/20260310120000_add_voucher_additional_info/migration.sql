ALTER TABLE "Voucher"
ADD COLUMN "insuranceProvider" TEXT,
ADD COLUMN "insurancePhone" TEXT,
ADD COLUMN "insuranceEmail" TEXT,
ADD COLUMN "additionalNotes" TEXT;

CREATE TABLE "Tour" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "tourDate" TEXT,
    "departureTime" TEXT,
    "location" TEXT,
    "receptiveName" TEXT,

    CONSTRAINT "Tour_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Tour_voucherId_idx" ON "Tour"("voucherId");
CREATE INDEX "Tour_voucherId_sortOrder_idx" ON "Tour"("voucherId", "sortOrder");

ALTER TABLE "Tour"
ADD CONSTRAINT "Tour_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
