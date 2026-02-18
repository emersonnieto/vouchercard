/*
  Warnings:

  - Made the column `slug` on table `Agency` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Agency" ALTER COLUMN "slug" SET NOT NULL;
