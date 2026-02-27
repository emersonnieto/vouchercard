-- Add segment order to support connections (escalas) per direction.
ALTER TABLE "Flight"
ADD COLUMN "segmentOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Flight_voucherId_direction_segmentOrder_idx"
ON "Flight"("voucherId", "direction", "segmentOrder");
