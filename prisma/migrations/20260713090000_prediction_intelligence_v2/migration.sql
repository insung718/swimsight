ALTER TABLE "Goal"
ADD COLUMN "course" "Course" NOT NULL DEFAULT 'LCM',
ADD COLUMN "qualifyingTime" DOUBLE PRECISION;

UPDATE "Goal" AS goal
SET "course" = COALESCE((
  SELECT swim."course"
  FROM "SwimResult" AS swim
  WHERE swim."userId" = goal."userId"
    AND swim."event" = goal."event"
    AND swim."resultKind" = 'OFFICIAL'
    AND swim."raceType" = 'INDIVIDUAL'
  ORDER BY swim."date" DESC, swim."createdAt" DESC
  LIMIT 1
), 'LCM'::"Course");

ALTER TABLE "PredictionSnapshot"
ADD COLUMN "explanationMethod" TEXT,
ADD COLUMN "explanationBaseTime" DOUBLE PRECISION,
ADD COLUMN "explanationContributions" JSONB,
ADD COLUMN "calibrationMetadata" JSONB,
ADD COLUMN "qualifyingTime" DOUBLE PRECISION,
ADD COLUMN "pbProbability" DOUBLE PRECISION,
ADD COLUMN "goalProbability" DOUBLE PRECISION,
ADD COLUMN "qualifyingProbability" DOUBLE PRECISION,
ADD COLUMN "probabilityMethod" TEXT,
ADD COLUMN "achievedQualification" BOOLEAN;

ALTER TABLE "Goal"
ADD CONSTRAINT "Goal_qualifying_time_check"
CHECK ("qualifyingTime" IS NULL OR "qualifyingTime" > 0);

ALTER TABLE "PredictionSnapshot"
ADD CONSTRAINT "PredictionSnapshot_explanation_method_check"
CHECK ("explanationMethod" IS NULL OR "explanationMethod" IN ('TREE_SHAP', 'DETERMINISTIC_DECOMPOSITION')),
ADD CONSTRAINT "PredictionSnapshot_probability_method_check"
CHECK ("probabilityMethod" IS NULL OR "probabilityMethod" IN ('EMPIRICAL_RESIDUAL', 'ESTIMATED_RANGE')),
ADD CONSTRAINT "PredictionSnapshot_pb_probability_check"
CHECK ("pbProbability" IS NULL OR ("pbProbability" >= 0 AND "pbProbability" <= 100)),
ADD CONSTRAINT "PredictionSnapshot_goal_probability_check"
CHECK ("goalProbability" IS NULL OR ("goalProbability" >= 0 AND "goalProbability" <= 100)),
ADD CONSTRAINT "PredictionSnapshot_qualifying_probability_check"
CHECK ("qualifyingProbability" IS NULL OR ("qualifyingProbability" >= 0 AND "qualifyingProbability" <= 100)),
ADD CONSTRAINT "PredictionSnapshot_qualifying_time_check"
CHECK ("qualifyingTime" IS NULL OR "qualifyingTime" > 0);

ALTER TABLE "PredictionSnapshot"
ADD CONSTRAINT "PredictionSnapshot_explanation_base_time_check"
CHECK ("explanationBaseTime" IS NULL OR "explanationBaseTime" > 0);

DROP INDEX IF EXISTS "Goal_userId_event_idx";
CREATE INDEX "Goal_userId_event_course_idx" ON "Goal"("userId", "event", "course");
