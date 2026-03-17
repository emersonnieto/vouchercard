ALTER TABLE "Voucher"
ADD COLUMN "tripDestination" TEXT,
ADD COLUMN "itinerarySuggestion" TEXT,
ADD COLUMN "itineraryGeneratedAt" TIMESTAMP(3),
ADD COLUMN "itineraryModel" TEXT;
