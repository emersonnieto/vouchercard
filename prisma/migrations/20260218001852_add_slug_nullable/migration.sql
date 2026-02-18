/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Agency` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Agency" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");
