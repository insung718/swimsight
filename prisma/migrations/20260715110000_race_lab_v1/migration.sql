-- SwimSight Race Lab v1 is expand-only. Existing results, predictions, and goals remain unchanged.
CREATE TYPE "RaceSplitSource" AS ENUM ('OFFICIAL', 'MANUAL', 'ESTIMATED');
CREATE TYPE "RaceSplitPrecision" AS ENUM ('HUNDREDTH', 'TENTH', 'WHOLE_SECOND');
CREATE TYPE "RaceLabScenarioKind" AS ENUM ('SIMULATION', 'GOAL_RACE');
CREATE TYPE "RacePacingStrategy" AS ENUM ('AGGRESSIVE', 'BALANCED', 'CONSERVATIVE');

CREATE TABLE "RaceSplit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "swimResultId" TEXT NOT NULL,
  "segmentIndex" INTEGER NOT NULL,
  "segmentDistance" DOUBLE PRECISION NOT NULL,
  "cumulativeDistance" DOUBLE PRECISION NOT NULL,
  "segmentTime" DOUBLE PRECISION NOT NULL,
  "cumulativeTime" DOUBLE PRECISION NOT NULL,
  "source" "RaceSplitSource" NOT NULL,
  "precision" "RaceSplitPrecision" NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RaceSplit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaceLabScenario" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "baseResultId" TEXT,
  "kind" "RaceLabScenarioKind" NOT NULL,
  "event" "SwimEvent" NOT NULL,
  "course" "Course" NOT NULL,
  "name" TEXT NOT NULL,
  "strategy" "RacePacingStrategy",
  "targetTime" DOUBLE PRECISION,
  "projectedTime" DOUBLE PRECISION NOT NULL,
  "settings" JSONB NOT NULL,
  "segments" JSONB NOT NULL,
  "engineVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RaceLabScenario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaceSplit_swimResultId_segmentIndex_source_key" ON "RaceSplit"("swimResultId", "segmentIndex", "source");
CREATE INDEX "RaceSplit_userId_swimResultId_source_idx" ON "RaceSplit"("userId", "swimResultId", "source");
CREATE INDEX "RaceLabScenario_userId_createdAt_idx" ON "RaceLabScenario"("userId", "createdAt");
CREATE INDEX "RaceLabScenario_userId_event_course_idx" ON "RaceLabScenario"("userId", "event", "course");
CREATE INDEX "RaceLabScenario_baseResultId_idx" ON "RaceLabScenario"("baseResultId");

ALTER TABLE "RaceSplit" ADD CONSTRAINT "RaceSplit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceSplit" ADD CONSTRAINT "RaceSplit_swimResultId_fkey" FOREIGN KEY ("swimResultId") REFERENCES "SwimResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceLabScenario" ADD CONSTRAINT "RaceLabScenario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceLabScenario" ADD CONSTRAINT "RaceLabScenario_baseResultId_fkey" FOREIGN KEY ("baseResultId") REFERENCES "SwimResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Official source rows cannot be edited, and a manual or estimated row cannot be promoted to official.
CREATE FUNCTION "enforce_race_split_source_immutability"() RETURNS trigger AS $$
BEGIN
  IF OLD."source" = 'OFFICIAL' THEN
    RAISE EXCEPTION 'Official race splits are immutable';
  END IF;
  IF NEW."source" IS DISTINCT FROM OLD."source" THEN
    RAISE EXCEPTION 'Race split provenance cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RaceSplit_source_immutable"
BEFORE UPDATE ON "RaceSplit"
FOR EACH ROW EXECUTE FUNCTION "enforce_race_split_source_immutability"();

-- Saved scenarios are snapshots. Editing creates a new scenario instead of rewriting history.
CREATE FUNCTION "enforce_race_lab_scenario_immutability"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Race Lab scenarios are immutable; save a new scenario instead';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "RaceLabScenario_immutable_update"
BEFORE UPDATE ON "RaceLabScenario"
FOR EACH ROW EXECUTE FUNCTION "enforce_race_lab_scenario_immutability"();
