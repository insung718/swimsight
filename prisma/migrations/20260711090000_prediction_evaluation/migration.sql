CREATE TYPE "SwimRaceType" AS ENUM ('INDIVIDUAL', 'RELAY_SPLIT', 'TIME_TRIAL', 'CONVERTED');

ALTER TABLE "SwimResult"
ADD COLUMN "raceType" "SwimRaceType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "SwimResult_dedupeKey_key" ON "SwimResult"("dedupeKey");

CREATE TABLE "PredictionSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "event" "SwimEvent" NOT NULL,
  "course" "Course" NOT NULL,
  "targetType" TEXT NOT NULL,
  "horizonDays" INTEGER NOT NULL,
  "predictedTime" DOUBLE PRECISION NOT NULL,
  "lowerBound" DOUBLE PRECISION NOT NULL,
  "upperBound" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "predictionTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "targetRaceDate" TIMESTAMP(3) NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "modelSource" TEXT NOT NULL,
  "validationMae" DOUBLE PRECISION,
  "trainingDate" TIMESTAMP(3),
  "trainingDatasetSize" INTEGER,
  "featureSnapshot" JSONB NOT NULL,
  "featuresUsed" JSONB NOT NULL,
  "eligibilityRules" JSONB NOT NULL,
  "topFactors" JSONB NOT NULL,
  "dataSufficiency" TEXT NOT NULL,
  "athleteAge" INTEGER,
  "outOfDistribution" BOOLEAN NOT NULL DEFAULT false,
  "outOfDistributionReasons" JSONB NOT NULL,
  "lastRaceBaseline" DOUBLE PRECISION NOT NULL,
  "lastThreeBaseline" DOUBLE PRECISION NOT NULL,
  "linearTrendBaseline" DOUBLE PRECISION NOT NULL,
  "goalTime" DOUBLE PRECISION,
  "inputFingerprint" TEXT NOT NULL,
  "actualResultId" TEXT,
  "actualTime" DOUBLE PRECISION,
  "absoluteError" DOUBLE PRECISION,
  "signedError" DOUBLE PRECISION,
  "percentageError" DOUBLE PRECISION,
  "withinInterval" BOOLEAN,
  "achievedPb" BOOLEAN,
  "achievedGoal" BOOLEAN,
  "evaluatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PredictionSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PredictionSnapshot"
ADD CONSTRAINT "PredictionSnapshot_positive_times_check"
CHECK ("predictedTime" > 0 AND "lowerBound" > 0 AND "upperBound" > 0),
ADD CONSTRAINT "PredictionSnapshot_bounds_check"
CHECK ("lowerBound" <= "predictedTime" AND "predictedTime" <= "upperBound"),
ADD CONSTRAINT "PredictionSnapshot_confidence_check"
CHECK ("confidence" >= 0 AND "confidence" <= 100),
ADD CONSTRAINT "PredictionSnapshot_target_type_check"
CHECK ("targetType" IN ('HORIZON', 'UPCOMING_MEET')),
ADD CONSTRAINT "PredictionSnapshot_model_source_check"
CHECK ("modelSource" IN ('XGBOOST', 'CONSERVATIVE_ENSEMBLE')),
ADD CONSTRAINT "PredictionSnapshot_data_sufficiency_check"
CHECK ("dataSufficiency" IN ('Low', 'Moderate', 'High')),
ADD CONSTRAINT "PredictionSnapshot_error_check"
CHECK ("absoluteError" IS NULL OR "absoluteError" >= 0),
ADD CONSTRAINT "PredictionSnapshot_target_after_prediction_check"
CHECK ("targetRaceDate" > "predictionTimestamp");

CREATE UNIQUE INDEX "PredictionSnapshot_userId_inputFingerprint_key" ON "PredictionSnapshot"("userId", "inputFingerprint");
CREATE INDEX "PredictionSnapshot_userId_evaluatedAt_targetRaceDate_idx" ON "PredictionSnapshot"("userId", "evaluatedAt", "targetRaceDate");
CREATE INDEX "PredictionSnapshot_userId_event_course_targetRaceDate_idx" ON "PredictionSnapshot"("userId", "event", "course", "targetRaceDate");
CREATE INDEX "PredictionSnapshot_modelVersion_evaluatedAt_idx" ON "PredictionSnapshot"("modelVersion", "evaluatedAt");
CREATE INDEX "PredictionSnapshot_actualResultId_idx" ON "PredictionSnapshot"("actualResultId");

ALTER TABLE "PredictionSnapshot"
ADD CONSTRAINT "PredictionSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PredictionSnapshot"
ADD CONSTRAINT "PredictionSnapshot_actualResultId_fkey" FOREIGN KEY ("actualResultId") REFERENCES "SwimResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;
