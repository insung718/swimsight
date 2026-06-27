-- CreateEnum
CREATE TYPE "GymWorkoutType" AS ENUM ('STRENGTH', 'CORE', 'MOBILITY', 'DRYLAND', 'CARDIO', 'RECOVERY');

-- CreateTable
CREATE TABLE "GymWorkout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "workoutType" "GymWorkoutType" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "intensity" INTEGER NOT NULL,
    "focus" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GymWorkout_userId_date_idx" ON "GymWorkout"("userId", "date");

-- AddForeignKey
ALTER TABLE "GymWorkout" ADD CONSTRAINT "GymWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
