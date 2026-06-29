-- CreateEnum
CREATE TYPE "SwimResultKind" AS ENUM ('OFFICIAL', 'TRAINING');

-- AlterTable
ALTER TABLE "SwimResult" ADD COLUMN "resultKind" "SwimResultKind" NOT NULL DEFAULT 'OFFICIAL';

-- CreateIndex
CREATE INDEX "SwimResult_userId_resultKind_date_idx" ON "SwimResult"("userId", "resultKind", "date");
