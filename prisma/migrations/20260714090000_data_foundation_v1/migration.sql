-- SwimSight Data Foundation and Pilot Platform v1 is expand-only.
-- Existing race, account, consent, and prediction records remain unchanged.
CREATE TYPE "ImportAdapter" AS ENUM ('SWIMSIGHT_CANONICAL', 'GENERIC_RACE_CSV', 'SWIMCLOUD_EXPORT');
CREATE TYPE "ImportBatchStatus" AS ENUM ('PREVIEWED', 'PARTIALLY_COMMITTED', 'COMMITTED', 'ROLLED_BACK', 'FAILED');
CREATE TYPE "ImportRowStatus" AS ENUM ('VALID', 'INVALID', 'DUPLICATE', 'REVIEW_REQUIRED', 'IMPORTED', 'SKIPPED', 'ROLLED_BACK');
CREATE TYPE "IdentityConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "IdentityMatchStatus" AS ENUM ('AUTO_MATCHED', 'REVIEW_REQUIRED', 'CONFIRMED', 'REJECTED', 'UNMERGED');
CREATE TYPE "ImportAction" AS ENUM ('PREVIEWED', 'ROW_CORRECTED', 'IDENTITY_CONFIRMED', 'IDENTITY_REJECTED', 'COMMITTED', 'ROLLED_BACK');
CREATE TYPE "PilotAudience" AS ENUM ('INDIVIDUAL', 'SCHOOL', 'CLUB');
CREATE TYPE "PilotEnrollmentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'COMPLETED');
CREATE TYPE "ShareGrantStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');
CREATE TYPE "CohortStatus" AS ENUM ('SEALED', 'INVALIDATED');

ALTER TABLE "User"
  ADD COLUMN "countryCode" TEXT,
  ADD COLUMN "region" TEXT,
  ADD COLUMN "preferredCourse" "Course",
  ADD COLUMN "mainEvents" "SwimEvent"[] NOT NULL DEFAULT ARRAY[]::"SwimEvent"[],
  ADD COLUMN "onboardingStartedAt" TIMESTAMP(3),
  ADD COLUMN "firstInsightAt" TIMESTAMP(3);

ALTER TABLE "SwimResult"
  ADD COLUMN "importBatchId" TEXT,
  ADD COLUMN "importRowId" TEXT,
  ADD COLUMN "externalResultId" TEXT,
  ADD COLUMN "externalAthleteId" TEXT,
  ADD COLUMN "externalMeetId" TEXT,
  ADD COLUMN "sourceStatus" TEXT,
  ADD COLUMN "originalRowHash" TEXT;

ALTER TABLE "PredictionSnapshot"
  ADD COLUMN "evaluationPolicyVersion" TEXT,
  ADD COLUMN "evaluationMatchMetadata" JSONB;

CREATE TABLE "ImportBatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teamId" TEXT,
  "adapter" "ImportAdapter" NOT NULL,
  "adapterVersion" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sourceFileHash" TEXT NOT NULL,
  "importDefinitionHash" TEXT NOT NULL,
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'PREVIEWED',
  "detectedFormat" TEXT NOT NULL,
  "columnMapping" JSONB NOT NULL,
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "invalidRows" INTEGER NOT NULL,
  "duplicateRows" INTEGER NOT NULL DEFAULT 0,
  "reviewRows" INTEGER NOT NULL DEFAULT 0,
  "importedRows" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "committedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportIdentityCandidate" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "matchedUserId" TEXT,
  "externalAthleteId" TEXT,
  "sourceName" TEXT,
  "sourceBirthYear" INTEGER,
  "confidence" "IdentityConfidence" NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "status" "IdentityMatchStatus" NOT NULL,
  "reasonCodes" JSONB NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportIdentityCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportRow" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "originalRowHash" TEXT NOT NULL,
  "status" "ImportRowStatus" NOT NULL,
  "normalizedData" JSONB,
  "sourceProvenance" JSONB NOT NULL,
  "errors" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "duplicateResultId" TEXT,
  "duplicateConfidence" "IdentityConfidence",
  "identityCandidateId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdentityResolutionEvent" (
  "id" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousStatus" TEXT NOT NULL,
  "nextStatus" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityResolutionEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportActionLog" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" "ImportAction" NOT NULL,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "integrityHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportActionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PilotCohort" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PilotCohort_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PilotInvitation" (
  "id" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "teamId" TEXT,
  "createdById" TEXT,
  "createdByPseudonym" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "audience" "PilotAudience" NOT NULL,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PilotInvitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PilotEnrollment" (
  "id" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "invitationId" TEXT,
  "userId" TEXT NOT NULL,
  "teamId" TEXT,
  "status" "PilotEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "PilotEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AthleteShareGrant" (
  "id" TEXT NOT NULL,
  "athleteId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "status" "ShareGrantStatus" NOT NULL DEFAULT 'ACTIVE',
  "scopes" JSONB NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AthleteShareGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CoachNote" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "subjectUserId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CoachNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccessAuditLog" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "subjectUserId" TEXT,
  "teamId" TEXT,
  "actorPseudonym" TEXT,
  "subjectPseudonym" TEXT,
  "teamPseudonym" TEXT,
  "action" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT,
  "purpose" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "metadata" JSONB,
  "previousHash" TEXT,
  "integrityHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductAnalyticsEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "eventName" TEXT NOT NULL,
  "sessionId" TEXT,
  "properties" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchCohortManifest" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "createdById" TEXT,
  "createdByPseudonym" TEXT NOT NULL,
  "status" "CohortStatus" NOT NULL DEFAULT 'SEALED',
  "extractionCutoff" TIMESTAMP(3) NOT NULL,
  "inclusionRules" JSONB NOT NULL,
  "exclusionRules" JSONB NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "featureSchemaVersion" TEXT NOT NULL,
  "splitPolicyVersion" TEXT NOT NULL,
  "importerVersions" JSONB NOT NULL,
  "distributions" JSONB NOT NULL,
  "exclusionCounts" JSONB NOT NULL,
  "sourceSummary" JSONB NOT NULL,
  "datasetHash" TEXT NOT NULL,
  "manifestHash" TEXT NOT NULL,
  "recordCount" INTEGER NOT NULL,
  "athleteCount" INTEGER NOT NULL,
  "invalidatedAt" TIMESTAMP(3),
  "invalidationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchCohortManifest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ResearchCohortRecord" (
  "id" TEXT NOT NULL,
  "manifestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "swimResultId" TEXT NOT NULL,
  "athletePseudonym" TEXT NOT NULL,
  "splitAssignment" TEXT NOT NULL,
  "sourceRecordHash" TEXT NOT NULL,
  "featureSnapshot" JSONB NOT NULL,
  "predictionCutoff" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResearchCohortRecord_pkey" PRIMARY KEY ("id")
);

-- A minimal external-identity tombstone prevents a failed Clerk deletion from
-- recreating application data through an authenticated session.
CREATE TABLE "AccountDeletionTombstone" (
  "id" TEXT NOT NULL,
  "clerkId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttemptAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "retainedUntil" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountDeletionTombstone_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SwimResult_importRowId_key" ON "SwimResult"("importRowId");
CREATE INDEX "SwimResult_userId_externalResultId_idx" ON "SwimResult"("userId", "externalResultId");
CREATE INDEX "SwimResult_importBatchId_idx" ON "SwimResult"("importBatchId");
CREATE UNIQUE INDEX "ImportBatch_userId_importDefinitionHash_key" ON "ImportBatch"("userId", "importDefinitionHash");
CREATE INDEX "ImportBatch_userId_createdAt_idx" ON "ImportBatch"("userId", "createdAt");
CREATE INDEX "ImportBatch_userId_sourceFileHash_idx" ON "ImportBatch"("userId", "sourceFileHash");
CREATE INDEX "ImportBatch_teamId_createdAt_idx" ON "ImportBatch"("teamId", "createdAt");
CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt");
CREATE UNIQUE INDEX "ImportRow_batchId_rowNumber_key" ON "ImportRow"("batchId", "rowNumber");
CREATE INDEX "ImportRow_batchId_originalRowHash_idx" ON "ImportRow"("batchId", "originalRowHash");
CREATE INDEX "ImportRow_batchId_status_idx" ON "ImportRow"("batchId", "status");
CREATE INDEX "ImportRow_duplicateResultId_idx" ON "ImportRow"("duplicateResultId");
CREATE UNIQUE INDEX "ImportIdentityCandidate_batchId_externalAthleteId_sourceName_key" ON "ImportIdentityCandidate"("batchId", "externalAthleteId", "sourceName");
CREATE INDEX "ImportIdentityCandidate_ownerUserId_status_idx" ON "ImportIdentityCandidate"("ownerUserId", "status");
CREATE INDEX "ImportIdentityCandidate_matchedUserId_idx" ON "ImportIdentityCandidate"("matchedUserId");
CREATE INDEX "IdentityResolutionEvent_candidateId_createdAt_idx" ON "IdentityResolutionEvent"("candidateId", "createdAt");
CREATE INDEX "IdentityResolutionEvent_actorUserId_createdAt_idx" ON "IdentityResolutionEvent"("actorUserId", "createdAt");
CREATE INDEX "ImportActionLog_batchId_createdAt_idx" ON "ImportActionLog"("batchId", "createdAt");
CREATE INDEX "ImportActionLog_actorUserId_createdAt_idx" ON "ImportActionLog"("actorUserId", "createdAt");
CREATE UNIQUE INDEX "PilotCohort_label_key" ON "PilotCohort"("label");
CREATE INDEX "PilotCohort_active_createdAt_idx" ON "PilotCohort"("active", "createdAt");
CREATE UNIQUE INDEX "PilotInvitation_tokenHash_key" ON "PilotInvitation"("tokenHash");
CREATE INDEX "PilotInvitation_cohortId_expiresAt_idx" ON "PilotInvitation"("cohortId", "expiresAt");
CREATE INDEX "PilotInvitation_teamId_idx" ON "PilotInvitation"("teamId");
CREATE INDEX "PilotInvitation_createdById_createdAt_idx" ON "PilotInvitation"("createdById", "createdAt");
CREATE UNIQUE INDEX "PilotEnrollment_cohortId_userId_key" ON "PilotEnrollment"("cohortId", "userId");
CREATE INDEX "PilotEnrollment_userId_status_idx" ON "PilotEnrollment"("userId", "status");
CREATE INDEX "PilotEnrollment_teamId_status_idx" ON "PilotEnrollment"("teamId", "status");
CREATE UNIQUE INDEX "AthleteShareGrant_athleteId_teamId_key" ON "AthleteShareGrant"("athleteId", "teamId");
CREATE INDEX "AthleteShareGrant_teamId_status_idx" ON "AthleteShareGrant"("teamId", "status");
CREATE INDEX "AthleteShareGrant_athleteId_status_idx" ON "AthleteShareGrant"("athleteId", "status");
CREATE INDEX "CoachNote_teamId_subjectUserId_createdAt_idx" ON "CoachNote"("teamId", "subjectUserId", "createdAt");
CREATE INDEX "CoachNote_authorId_createdAt_idx" ON "CoachNote"("authorId", "createdAt");
CREATE INDEX "AccessAuditLog_actorId_createdAt_idx" ON "AccessAuditLog"("actorId", "createdAt");
CREATE INDEX "AccessAuditLog_subjectUserId_createdAt_idx" ON "AccessAuditLog"("subjectUserId", "createdAt");
CREATE INDEX "AccessAuditLog_teamId_createdAt_idx" ON "AccessAuditLog"("teamId", "createdAt");
CREATE INDEX "ProductAnalyticsEvent_eventName_occurredAt_idx" ON "ProductAnalyticsEvent"("eventName", "occurredAt");
CREATE INDEX "ProductAnalyticsEvent_userId_occurredAt_idx" ON "ProductAnalyticsEvent"("userId", "occurredAt");
CREATE INDEX "ProductAnalyticsEvent_expiresAt_idx" ON "ProductAnalyticsEvent"("expiresAt");
CREATE UNIQUE INDEX "ResearchCohortManifest_version_key" ON "ResearchCohortManifest"("version");
CREATE UNIQUE INDEX "ResearchCohortManifest_manifestHash_key" ON "ResearchCohortManifest"("manifestHash");
CREATE INDEX "ResearchCohortManifest_status_createdAt_idx" ON "ResearchCohortManifest"("status", "createdAt");
CREATE INDEX "ResearchCohortManifest_extractionCutoff_idx" ON "ResearchCohortManifest"("extractionCutoff");
CREATE UNIQUE INDEX "ResearchCohortRecord_manifestId_swimResultId_key" ON "ResearchCohortRecord"("manifestId", "swimResultId");
CREATE INDEX "ResearchCohortRecord_manifestId_splitAssignment_idx" ON "ResearchCohortRecord"("manifestId", "splitAssignment");
CREATE INDEX "ResearchCohortRecord_userId_idx" ON "ResearchCohortRecord"("userId");
CREATE INDEX "ResearchCohortRecord_swimResultId_idx" ON "ResearchCohortRecord"("swimResultId");
CREATE UNIQUE INDEX "AccountDeletionTombstone_clerkId_key" ON "AccountDeletionTombstone"("clerkId");
CREATE INDEX "AccountDeletionTombstone_completedAt_lastAttemptAt_idx" ON "AccountDeletionTombstone"("completedAt", "lastAttemptAt");
CREATE INDEX "AccountDeletionTombstone_retainedUntil_idx" ON "AccountDeletionTombstone"("retainedUntil");

ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportIdentityCandidate" ADD CONSTRAINT "ImportIdentityCandidate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportIdentityCandidate" ADD CONSTRAINT "ImportIdentityCandidate_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportIdentityCandidate" ADD CONSTRAINT "ImportIdentityCandidate_matchedUserId_fkey" FOREIGN KEY ("matchedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_identityCandidateId_fkey" FOREIGN KEY ("identityCandidateId") REFERENCES "ImportIdentityCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IdentityResolutionEvent" ADD CONSTRAINT "IdentityResolutionEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ImportIdentityCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportActionLog" ADD CONSTRAINT "ImportActionLog_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SwimResult" ADD CONSTRAINT "SwimResult_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SwimResult" ADD CONSTRAINT "SwimResult_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ImportRow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PilotInvitation" ADD CONSTRAINT "PilotInvitation_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "PilotCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PilotInvitation" ADD CONSTRAINT "PilotInvitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PilotInvitation" ADD CONSTRAINT "PilotInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PilotEnrollment" ADD CONSTRAINT "PilotEnrollment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "PilotCohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PilotEnrollment" ADD CONSTRAINT "PilotEnrollment_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "PilotInvitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PilotEnrollment" ADD CONSTRAINT "PilotEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PilotEnrollment" ADD CONSTRAINT "PilotEnrollment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AthleteShareGrant" ADD CONSTRAINT "AthleteShareGrant_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteShareGrant" ADD CONSTRAINT "AthleteShareGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AthleteShareGrant" ADD CONSTRAINT "AthleteShareGrant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachNote" ADD CONSTRAINT "CoachNote_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccessAuditLog" ADD CONSTRAINT "AccessAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessAuditLog" ADD CONSTRAINT "AccessAuditLog_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccessAuditLog" ADD CONSTRAINT "AccessAuditLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductAnalyticsEvent" ADD CONSTRAINT "ProductAnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchCohortManifest" ADD CONSTRAINT "ResearchCohortManifest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchCohortRecord" ADD CONSTRAINT "ResearchCohortRecord_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "ResearchCohortManifest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchCohortRecord" ADD CONSTRAINT "ResearchCohortRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchCohortRecord" ADD CONSTRAINT "ResearchCohortRecord_swimResultId_fkey" FOREIGN KEY ("swimResultId") REFERENCES "SwimResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Append-only ledgers protect provenance and access history from silent edits.
CREATE TRIGGER "ImportActionLog_immutable_update"
BEFORE UPDATE ON "ImportActionLog"
FOR EACH ROW EXECUTE FUNCTION "reject_audit_update"();

CREATE TRIGGER "IdentityResolutionEvent_immutable_update"
BEFORE UPDATE ON "IdentityResolutionEvent"
FOR EACH ROW EXECUTE FUNCTION "reject_audit_update"();

CREATE FUNCTION "enforce_access_audit_immutability"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Access audit records are append-only';
  END IF;
  IF NEW."action" IS DISTINCT FROM OLD."action"
    OR NEW."resourceType" IS DISTINCT FROM OLD."resourceType"
    OR NEW."resourceId" IS DISTINCT FROM OLD."resourceId"
    OR NEW."purpose" IS DISTINCT FROM OLD."purpose"
    OR NEW."outcome" IS DISTINCT FROM OLD."outcome"
    OR NEW."metadata" IS DISTINCT FROM OLD."metadata"
    OR NEW."previousHash" IS DISTINCT FROM OLD."previousHash"
    OR NEW."integrityHash" IS DISTINCT FROM OLD."integrityHash"
    OR NEW."actorPseudonym" IS DISTINCT FROM OLD."actorPseudonym"
    OR NEW."subjectPseudonym" IS DISTINCT FROM OLD."subjectPseudonym"
    OR NEW."teamPseudonym" IS DISTINCT FROM OLD."teamPseudonym"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Access audit records are append-only';
  END IF;
  IF NEW."actorId" IS NOT NULL AND NEW."actorId" IS DISTINCT FROM OLD."actorId" THEN
    RAISE EXCEPTION 'Access audit actor references can only be anonymized';
  END IF;
  IF NEW."subjectUserId" IS NOT NULL AND NEW."subjectUserId" IS DISTINCT FROM OLD."subjectUserId" THEN
    RAISE EXCEPTION 'Access audit subject references can only be anonymized';
  END IF;
  IF NEW."teamId" IS NOT NULL AND NEW."teamId" IS DISTINCT FROM OLD."teamId" THEN
    RAISE EXCEPTION 'Access audit team references can only be anonymized';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AccessAuditLog_immutable_update"
BEFORE UPDATE OR DELETE ON "AccessAuditLog"
FOR EACH ROW EXECUTE FUNCTION "enforce_access_audit_immutability"();

CREATE FUNCTION "enforce_cohort_manifest_immutability"() RETURNS trigger AS $$
BEGIN
  IF NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."createdByPseudonym" IS DISTINCT FROM OLD."createdByPseudonym"
    OR NEW."extractionCutoff" IS DISTINCT FROM OLD."extractionCutoff"
    OR NEW."inclusionRules" IS DISTINCT FROM OLD."inclusionRules"
    OR NEW."exclusionRules" IS DISTINCT FROM OLD."exclusionRules"
    OR NEW."consentVersion" IS DISTINCT FROM OLD."consentVersion"
    OR NEW."featureSchemaVersion" IS DISTINCT FROM OLD."featureSchemaVersion"
    OR NEW."splitPolicyVersion" IS DISTINCT FROM OLD."splitPolicyVersion"
    OR NEW."importerVersions" IS DISTINCT FROM OLD."importerVersions"
    OR NEW."distributions" IS DISTINCT FROM OLD."distributions"
    OR NEW."exclusionCounts" IS DISTINCT FROM OLD."exclusionCounts"
    OR NEW."sourceSummary" IS DISTINCT FROM OLD."sourceSummary"
    OR NEW."datasetHash" IS DISTINCT FROM OLD."datasetHash"
    OR NEW."manifestHash" IS DISTINCT FROM OLD."manifestHash"
    OR NEW."recordCount" IS DISTINCT FROM OLD."recordCount"
    OR NEW."athleteCount" IS DISTINCT FROM OLD."athleteCount" THEN
    RAISE EXCEPTION 'Research cohort manifests are immutable; generate a new version instead';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ResearchCohortManifest_immutable_metadata"
BEFORE UPDATE ON "ResearchCohortManifest"
FOR EACH ROW EXECUTE FUNCTION "enforce_cohort_manifest_immutability"();

CREATE FUNCTION "enforce_cohort_record_immutability"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Research cohort records are immutable; generate a new cohort version instead';
  END IF;
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM "ResearchCohortManifest"
    WHERE "id" = OLD."manifestId" AND "status" = 'INVALIDATED'
  ) THEN
    RAISE EXCEPTION 'Seal must be invalidated before research cohort records can be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ResearchCohortRecord_immutable_rows"
BEFORE UPDATE OR DELETE ON "ResearchCohortRecord"
FOR EACH ROW EXECUTE FUNCTION "enforce_cohort_record_immutability"();

-- Outcome fields may be attached or cleared by the strict post-meet lifecycle,
-- but the forecast and its prediction-time inputs can never be rewritten.
CREATE FUNCTION "enforce_prediction_snapshot_input_immutability"() RETURNS trigger AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY[
    'actualResultId', 'evaluationPolicyVersion', 'evaluationMatchMetadata',
    'actualTime', 'absoluteError', 'signedError', 'percentageError',
    'withinInterval', 'achievedPb', 'achievedGoal', 'achievedQualification',
    'evaluatedAt', 'updatedAt'
  ]) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY[
    'actualResultId', 'evaluationPolicyVersion', 'evaluationMatchMetadata',
    'actualTime', 'absoluteError', 'signedError', 'percentageError',
    'withinInterval', 'achievedPb', 'achievedGoal', 'achievedQualification',
    'evaluatedAt', 'updatedAt'
  ]) THEN
    RAISE EXCEPTION 'Prediction inputs are immutable after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PredictionSnapshot_immutable_input"
BEFORE UPDATE ON "PredictionSnapshot"
FOR EACH ROW EXECUTE FUNCTION "enforce_prediction_snapshot_input_immutability"();
