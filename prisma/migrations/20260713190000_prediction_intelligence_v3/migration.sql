-- Prediction Intelligence v3 is expand-only. Existing columns and tables remain unchanged.
CREATE TYPE "ModelReleaseStatus" AS ENUM ('CHALLENGER', 'CHAMPION', 'REJECTED', 'RETIRED');
CREATE TYPE "ModelDecisionAction" AS ENUM ('REGISTERED', 'EVALUATED', 'PROMOTED', 'REJECTED', 'OVERRIDDEN', 'RETIRED');
CREATE TYPE "ConsentPurpose" AS ENUM ('PERSONAL_ANALYTICS', 'MODEL_TRAINING', 'PUBLIC_RESEARCH', 'GUARDIAN');
CREATE TYPE "ConsentAction" AS ENUM ('GRANTED', 'WITHDRAWN');
CREATE TYPE "TaperStatus" AS ENUM ('UNKNOWN', 'TAPERED', 'UNTAPERED');
CREATE TYPE "RaceEffort" AS ENUM ('UNKNOWN', 'MAXIMUM', 'SUBMAXIMAL', 'TRAINING_PACE');
CREATE TYPE "FeedbackChangeType" AS ENUM ('CREATED', 'UPDATED', 'DELETED');

ALTER TABLE "User"
  ADD COLUMN "personalAnalyticsConsentVersion" TEXT,
  ADD COLUMN "personalAnalyticsConsentedAt" TIMESTAMP(3),
  ADD COLUMN "personalAnalyticsWithdrawnAt" TIMESTAMP(3),
  ADD COLUMN "trainingConsentVersion" TEXT,
  ADD COLUMN "trainingConsentedAt" TIMESTAMP(3),
  ADD COLUMN "trainingConsentWithdrawnAt" TIMESTAMP(3),
  ADD COLUMN "researchConsentVersion" TEXT,
  ADD COLUMN "researchConsentedAt" TIMESTAMP(3),
  ADD COLUMN "researchConsentWithdrawnAt" TIMESTAMP(3),
  ADD COLUMN "guardianConsentVersion" TEXT,
  ADD COLUMN "guardianConsentedAt" TIMESTAMP(3),
  ADD COLUMN "guardianConsentWithdrawnAt" TIMESTAMP(3),
  ADD COLUMN "trainingDataExcludedAt" TIMESTAMP(3),
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3);

ALTER TABLE "PredictionSnapshot"
  ADD COLUMN "dataQualityScore" INTEGER,
  ADD COLUMN "dataQualityLevel" TEXT,
  ADD COLUMN "dataQualityReasons" JSONB,
  ADD COLUMN "eligibilityDecision" TEXT,
  ADD COLUMN "athleteSex" "AthleteSex",
  ADD COLUMN "conservativeBaseline" DOUBLE PRECISION;

ALTER TABLE "SwimResult" ADD COLUMN "provenance" JSONB;

UPDATE "SwimResult"
SET "provenance" = jsonb_build_object(
  'method', "source"::text,
  'legacyBackfill', true,
  'recordedAt', "createdAt"
)
WHERE "provenance" IS NULL;

CREATE TABLE "PredictionAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "event" "SwimEvent" NOT NULL,
  "course" "Course" NOT NULL,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assessmentVersion" TEXT NOT NULL,
  "qualityScore" INTEGER NOT NULL,
  "qualityLevel" TEXT NOT NULL,
  "eligibilityDecision" TEXT NOT NULL,
  "reasons" JSONB NOT NULL,
  "inputFingerprint" TEXT NOT NULL,
  CONSTRAINT "PredictionAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelRegistryEntry" (
  "id" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "event" "SwimEvent" NOT NULL,
  "course" "Course" NOT NULL,
  "status" "ModelReleaseStatus" NOT NULL DEFAULT 'CHALLENGER',
  "artifactHash" TEXT NOT NULL,
  "datasetVersion" TEXT NOT NULL,
  "featureSchemaVersion" TEXT NOT NULL,
  "trainingCodeVersion" TEXT NOT NULL,
  "evaluationVersion" TEXT NOT NULL,
  "metrics" JSONB NOT NULL,
  "subgroupMetrics" JSONB NOT NULL,
  "sampleSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelRegistryEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelReleaseDecision" (
  "id" TEXT NOT NULL,
  "registryId" TEXT NOT NULL,
  "action" "ModelDecisionAction" NOT NULL,
  "reason" TEXT NOT NULL,
  "metricsSnapshot" JSONB NOT NULL,
  "actorPseudonym" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelReleaseDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelMonitoringSnapshot" (
  "id" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "event" "SwimEvent" NOT NULL,
  "course" "Course" NOT NULL,
  "horizonBand" TEXT NOT NULL,
  "ageBand" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "sampleSize" INTEGER NOT NULL,
  "baselineSize" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "featureDrift" JSONB NOT NULL,
  "predictionDrift" DOUBLE PRECISION,
  "residualDrift" DOUBLE PRECISION,
  "coverageDrift" DOUBLE PRECISION,
  "calibrationDrift" DOUBLE PRECISION,
  "unsupportedRateDrift" DOUBLE PRECISION,
  "recommendation" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelMonitoringSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsentEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "purpose" "ConsentPurpose" NOT NULL,
  "action" "ConsentAction" NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaceFeedback" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "swimResultId" TEXT NOT NULL,
  "taperStatus" "TaperStatus" NOT NULL DEFAULT 'UNKNOWN',
  "illness" BOOLEAN NOT NULL DEFAULT false,
  "injury" BOOLEAN NOT NULL DEFAULT false,
  "effort" "RaceEffort" NOT NULL DEFAULT 'UNKNOWN',
  "courseInformationCorrect" BOOLEAN,
  "unusualCircumstances" TEXT,
  "predictionUseful" BOOLEAN,
  "source" TEXT NOT NULL DEFAULT 'SELF_REPORTED',
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RaceFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaceFeedbackRevision" (
  "id" TEXT NOT NULL,
  "feedbackId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "changeType" "FeedbackChangeType" NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RaceFeedbackRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PredictionAttempt_userId_inputFingerprint_key" ON "PredictionAttempt"("userId", "inputFingerprint");
CREATE INDEX "PredictionAttempt_userId_event_course_attemptedAt_idx" ON "PredictionAttempt"("userId", "event", "course", "attemptedAt");
CREATE INDEX "PredictionAttempt_eligibilityDecision_attemptedAt_idx" ON "PredictionAttempt"("eligibilityDecision", "attemptedAt");
CREATE UNIQUE INDEX "ModelRegistryEntry_modelVersion_event_course_evaluationVersion_key" ON "ModelRegistryEntry"("modelVersion", "event", "course", "evaluationVersion");
CREATE INDEX "ModelRegistryEntry_event_course_status_idx" ON "ModelRegistryEntry"("event", "course", "status");
CREATE INDEX "ModelRegistryEntry_createdAt_idx" ON "ModelRegistryEntry"("createdAt");
CREATE UNIQUE INDEX "ModelRegistryEntry_one_champion_per_event_course" ON "ModelRegistryEntry"("event", "course") WHERE "status" = 'CHAMPION';
CREATE INDEX "ModelReleaseDecision_registryId_createdAt_idx" ON "ModelReleaseDecision"("registryId", "createdAt");
CREATE INDEX "ModelMonitoringSnapshot_modelVersion_event_course_createdAt_idx" ON "ModelMonitoringSnapshot"("modelVersion", "event", "course", "createdAt");
CREATE INDEX "ModelMonitoringSnapshot_status_createdAt_idx" ON "ModelMonitoringSnapshot"("status", "createdAt");
CREATE INDEX "ConsentEvent_userId_purpose_occurredAt_idx" ON "ConsentEvent"("userId", "purpose", "occurredAt");
CREATE UNIQUE INDEX "RaceFeedback_swimResultId_key" ON "RaceFeedback"("swimResultId");
CREATE INDEX "RaceFeedback_userId_createdAt_idx" ON "RaceFeedback"("userId", "createdAt");
CREATE UNIQUE INDEX "RaceFeedbackRevision_feedbackId_version_key" ON "RaceFeedbackRevision"("feedbackId", "version");
CREATE INDEX "RaceFeedbackRevision_userId_createdAt_idx" ON "RaceFeedbackRevision"("userId", "createdAt");

ALTER TABLE "PredictionAttempt" ADD CONSTRAINT "PredictionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModelReleaseDecision" ADD CONSTRAINT "ModelReleaseDecision_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "ModelRegistryEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsentEvent" ADD CONSTRAINT "ConsentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceFeedback" ADD CONSTRAINT "RaceFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceFeedback" ADD CONSTRAINT "RaceFeedback_swimResultId_fkey" FOREIGN KEY ("swimResultId") REFERENCES "SwimResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceFeedbackRevision" ADD CONSTRAINT "RaceFeedbackRevision_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "RaceFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceFeedbackRevision" ADD CONSTRAINT "RaceFeedbackRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Register the current deterministic production forecast as champion without
-- fabricating validation. Zero samples force all learned challengers to remain
-- blocked until real champion and baseline evaluation evidence is available.
INSERT INTO "ModelRegistryEntry" (
  "id", "modelVersion", "event", "course", "status", "artifactHash",
  "datasetVersion", "featureSchemaVersion", "trainingCodeVersion",
  "evaluationVersion", "metrics", "subgroupMetrics", "sampleSize"
) VALUES
  ('registry-conservative-lcm-v3', 'conservative-ensemble-2026-07-13', 'ONE_HUNDRED_FREESTYLE', 'LCM', 'CHAMPION', 'a2f324d973355a0b8d9055f0768f423ed70777fef67dff871c726af4f71c5fc3', 'production-snapshots-pending', 'deterministic-v3', 'git-required-at-release', 'insufficient-data-v1', '{"validationStatus":"INSUFFICIENT_DATA","mae":0,"medianAbsoluteError":0,"rmse":0,"brierScore":0,"calibrationError":0,"intervalCoverage":0,"sampleSize":0}', '[]', 0),
  ('registry-conservative-scm-v3', 'conservative-ensemble-2026-07-13', 'ONE_HUNDRED_FREESTYLE', 'SCM', 'CHAMPION', 'eb0501646d60413e15e2e8ee814a104da0cfb6ab0f3efc29334698703f4d1525', 'production-snapshots-pending', 'deterministic-v3', 'git-required-at-release', 'insufficient-data-v1', '{"validationStatus":"INSUFFICIENT_DATA","mae":0,"medianAbsoluteError":0,"rmse":0,"brierScore":0,"calibrationError":0,"intervalCoverage":0,"sampleSize":0}', '[]', 0),
  ('registry-conservative-scy-v3', 'conservative-ensemble-2026-07-13', 'ONE_HUNDRED_FREESTYLE', 'SCY', 'CHAMPION', 'be7adbba4f86f8bc45c0967a9adba7731fa655b7e12afdd1ed03bfda2c53aa76', 'production-snapshots-pending', 'deterministic-v3', 'git-required-at-release', 'insufficient-data-v1', '{"validationStatus":"INSUFFICIENT_DATA","mae":0,"medianAbsoluteError":0,"rmse":0,"brierScore":0,"calibrationError":0,"intervalCoverage":0,"sampleSize":0}', '[]', 0);

INSERT INTO "ModelReleaseDecision" (
  "id", "registryId", "action", "reason", "metricsSnapshot"
) VALUES
  ('decision-conservative-lcm-v3', 'registry-conservative-lcm-v3', 'REGISTERED', 'Existing production deterministic forecast registered as champion with insufficient validation evidence. Promotion of a challenger remains blocked until real evaluation exists.', '{"validationStatus":"INSUFFICIENT_DATA","sampleSize":0}'),
  ('decision-conservative-scm-v3', 'registry-conservative-scm-v3', 'REGISTERED', 'Existing production deterministic forecast registered as champion with insufficient validation evidence. Promotion of a challenger remains blocked until real evaluation exists.', '{"validationStatus":"INSUFFICIENT_DATA","sampleSize":0}'),
  ('decision-conservative-scy-v3', 'registry-conservative-scy-v3', 'REGISTERED', 'Existing production deterministic forecast registered as champion with insufficient validation evidence. Promotion of a challenger remains blocked until real evaluation exists.', '{"validationStatus":"INSUFFICIENT_DATA","sampleSize":0}');

CREATE FUNCTION "reject_model_decision_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Model release decisions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ModelReleaseDecision_immutable"
BEFORE UPDATE OR DELETE ON "ModelReleaseDecision"
FOR EACH ROW EXECUTE FUNCTION "reject_model_decision_mutation"();

CREATE FUNCTION "enforce_model_registry_immutability"() RETURNS trigger AS $$
BEGIN
  IF NEW."modelVersion" IS DISTINCT FROM OLD."modelVersion"
    OR NEW."event" IS DISTINCT FROM OLD."event"
    OR NEW."course" IS DISTINCT FROM OLD."course"
    OR NEW."artifactHash" IS DISTINCT FROM OLD."artifactHash"
    OR NEW."datasetVersion" IS DISTINCT FROM OLD."datasetVersion"
    OR NEW."featureSchemaVersion" IS DISTINCT FROM OLD."featureSchemaVersion"
    OR NEW."trainingCodeVersion" IS DISTINCT FROM OLD."trainingCodeVersion"
    OR NEW."evaluationVersion" IS DISTINCT FROM OLD."evaluationVersion"
    OR NEW."metrics" IS DISTINCT FROM OLD."metrics"
    OR NEW."subgroupMetrics" IS DISTINCT FROM OLD."subgroupMetrics"
    OR NEW."sampleSize" IS DISTINCT FROM OLD."sampleSize" THEN
    RAISE EXCEPTION 'Model registry metadata is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ModelRegistryEntry_immutable_metadata"
BEFORE UPDATE ON "ModelRegistryEntry"
FOR EACH ROW EXECUTE FUNCTION "enforce_model_registry_immutability"();

CREATE FUNCTION "enforce_model_registry_status_audit"() RETURNS trigger AS $$
DECLARE
  required_actions "ModelDecisionAction"[];
BEGIN
  IF NEW."status" IS NOT DISTINCT FROM OLD."status" THEN
    RETURN NEW;
  END IF;

  IF OLD."status" = 'CHALLENGER' AND NEW."status" = 'REJECTED' THEN
    required_actions := ARRAY['REJECTED'::"ModelDecisionAction"];
  ELSIF OLD."status" = 'CHALLENGER' AND NEW."status" = 'CHAMPION' THEN
    required_actions := ARRAY['PROMOTED'::"ModelDecisionAction", 'OVERRIDDEN'::"ModelDecisionAction"];
  ELSIF OLD."status" = 'CHAMPION' AND NEW."status" = 'RETIRED' THEN
    required_actions := ARRAY['RETIRED'::"ModelDecisionAction"];
  ELSE
    RAISE EXCEPTION 'Invalid model registry status transition from % to %', OLD."status", NEW."status";
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "ModelReleaseDecision"
    WHERE "registryId" = OLD."id" AND "action" = ANY(required_actions)
  ) THEN
    RAISE EXCEPTION 'Model registry status transition requires a matching immutable release decision';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ModelRegistryEntry_status_requires_audit"
BEFORE UPDATE ON "ModelRegistryEntry"
FOR EACH ROW EXECUTE FUNCTION "enforce_model_registry_status_audit"();

CREATE FUNCTION "reject_audit_update"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit records cannot be updated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ConsentEvent_immutable_update"
BEFORE UPDATE ON "ConsentEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_audit_update"();

CREATE TRIGGER "RaceFeedbackRevision_immutable_update"
BEFORE UPDATE ON "RaceFeedbackRevision"
FOR EACH ROW EXECUTE FUNCTION "reject_audit_update"();
