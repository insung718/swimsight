import "server-only";
import { Prisma } from "@prisma/client";
import {
  assignResearchSplit,
  buildResearchDatasetHash,
  buildResearchManifestHash,
  selectPredictionTimeHistory
} from "@/lib/cohort-integrity";
import { hmacSha256, sha256, stableJson } from "@/lib/data-integrity";
import { prisma } from "@/lib/prisma";
import { hasResearchGradeResultProvenance } from "@/lib/research-eligibility";
import { CONSENT_POLICY_VERSIONS } from "@/lib/services/privacy-service";

export const INTERNAL_MINIMUM_COHORT = 5;
export const TRAINING_READINESS_TARGETS = {
  athletes: 300,
  officialRaces: 2_000,
  evaluatedPredictions: 300,
  majorEventGroups: 5
} as const;

function ageBand(age: number | null) {
  if (age === null) return "Unknown";
  if (age <= 10) return "10 and under";
  if (age <= 12) return "11–12";
  if (age <= 14) return "13–14";
  if (age <= 16) return "15–16";
  if (age <= 18) return "17–18";
  return "19 and over";
}

function eventGroup(event: string) {
  if (event.includes("FREESTYLE")) return "Freestyle";
  if (event.includes("BUTTERFLY")) return "Butterfly";
  if (event.includes("BACKSTROKE")) return "Backstroke";
  if (event.includes("BREASTSTROKE")) return "Breaststroke";
  return "Individual medley";
}

function suppressedCoverage(groups: Map<string, Set<string>>) {
  return [...groups.entries()].map(([label, athletes]) => athletes.size < INTERNAL_MINIMUM_COHORT
    ? { label, athleteCount: null, suppressed: true, minimum: INTERNAL_MINIMUM_COHORT }
    : { label, athleteCount: athletes.size, suppressed: false, minimum: INTERNAL_MINIMUM_COHORT })
    .sort((left, right) => (right.athleteCount ?? -1) - (left.athleteCount ?? -1) || left.label.localeCompare(right.label));
}

function trainingConsentWhere(): Prisma.UserWhereInput {
  return {
    role: "ATHLETE",
    trainingConsentVersion: CONSENT_POLICY_VERSIONS.MODEL_TRAINING,
    trainingConsentedAt: { not: null },
    trainingConsentWithdrawnAt: null,
    trainingDataExcludedAt: null,
    OR: [
      { age: { gte: 18 } },
      {
        age: { lt: 18 },
        guardianConsentVersion: CONSENT_POLICY_VERSIONS.GUARDIAN,
        guardianConsentedAt: { not: null },
        guardianConsentWithdrawnAt: null
      }
    ]
  };
}

export async function buildDatasetReadiness() {
  const [rawAthletes, rawResults, consentedUsers, evaluatedSnapshots, importStatusCounts, pilotCohortCount, pilotInvitations, pilotEnrollments] = await Promise.all([
    prisma.user.count({ where: { role: "ATHLETE" } }),
    prisma.swimResult.count(),
    prisma.user.findMany({
      where: trainingConsentWhere(),
      select: {
        id: true,
        age: true,
        sex: true,
        countryCode: true,
        region: true,
        swims: {
          select: {
            id: true,
            date: true,
            event: true,
            course: true,
            resultKind: true,
            raceType: true,
            importRowId: true,
            originalRowHash: true,
            externalMeetId: true,
            externalResultId: true
          },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }]
        }
      },
      take: 10_000
    }),
    prisma.predictionSnapshot.findMany({
      where: { evaluatedAt: { not: null }, user: trainingConsentWhere() },
      select: {
        userId: true,
        absoluteError: true,
        lastRaceBaseline: true,
        lastThreeBaseline: true,
        linearTrendBaseline: true,
        conservativeBaseline: true,
        pbProbability: true,
        achievedPb: true
      },
      take: 100_000
    }),
    prisma.importRow.groupBy({ by: ["status"], _count: true }),
    prisma.pilotCohort.count(),
    prisma.pilotInvitation.findMany({ select: { maxUses: true, useCount: true, revokedAt: true, expiresAt: true }, take: 10_000 }),
    prisma.pilotEnrollment.findMany({
      select: {
        userId: true,
        status: true,
        enrolledAt: true,
        user: { select: { productEvents: { where: { eventName: "RETURN_VISIT" }, select: { occurredAt: true }, take: 500 } } }
      },
      take: 10_000
    })
  ]);

  const eventCoverage = new Map<string, Set<string>>();
  const courseCoverage = new Map<string, Set<string>>();
  const ageCoverage = new Map<string, Set<string>>();
  const categoryCoverage = new Map<string, Set<string>>();
  const seasonCoverage = new Map<string, Set<string>>();
  const regionCoverage = new Map<string, Set<string>>();
  const majorGroupCoverage = new Map<string, Set<string>>();
  const histories = { atLeast5: 0, atLeast10: 0, atLeast20: 0, atLeast30: 0 };
  const splitAthletes = { TRAIN: 0, VALIDATION: 0, TEST: 0 };
  let eligibleOfficialResults = 0;
  let sourceBackedOfficialResults = 0;
  let statisticallyUsableResults = 0;
  let statisticallyUsableAthletes = 0;

  const add = (map: Map<string, Set<string>>, label: string, athleteId: string) => map.set(label, new Set([...(map.get(label) ?? []), athleteId]));
  for (const user of consentedUsers) {
    const eligible = user.swims.filter((result) => result.resultKind === "OFFICIAL" && result.raceType === "INDIVIDUAL");
    const sourceBacked = eligible.filter(hasResearchGradeResultProvenance);
    eligibleOfficialResults += eligible.length;
    sourceBackedOfficialResults += sourceBacked.length;
    if (sourceBacked.length >= 5) histories.atLeast5 += 1;
    if (sourceBacked.length >= 10) histories.atLeast10 += 1;
    if (sourceBacked.length >= 20) histories.atLeast20 += 1;
    if (sourceBacked.length >= 30) histories.atLeast30 += 1;
    const byEventCourse = new Map<string, typeof sourceBacked>();
    for (const result of sourceBacked) {
      const key = `${result.event}__${result.course}`;
      byEventCourse.set(key, [...(byEventCourse.get(key) ?? []), result]);
      add(eventCoverage, result.event, user.id);
      add(courseCoverage, result.course, user.id);
      add(majorGroupCoverage, eventGroup(result.event), user.id);
      add(seasonCoverage, result.date.getUTCFullYear().toString(), user.id);
    }
    add(ageCoverage, ageBand(user.age), user.id);
    add(categoryCoverage, user.sex ?? "Unknown", user.id);
    add(regionCoverage, [user.countryCode, user.region].filter(Boolean).join(" / ") || "Unknown", user.id);
    const usableGroups = [...byEventCourse.values()].filter((results) => results.length >= 4);
    if (sourceBacked.length >= 5 && usableGroups.length) {
      statisticallyUsableAthletes += 1;
      statisticallyUsableResults += usableGroups.reduce((sum, results) => sum + Math.max(0, results.length - 3), 0);
      splitAthletes[assignResearchSplit(user.id)] += 1;
    }
  }

  const importRowCount = importStatusCounts.reduce((sum, entry) => sum + entry._count, 0);
  const statusCount = (status: string) => importStatusCounts.find((entry) => entry.status === status)?._count ?? 0;
  const duplicateRows = statusCount("DUPLICATE");
  const excludedRows = statusCount("INVALID") + statusCount("REVIEW_REQUIRED") + statusCount("SKIPPED");
  const errors = evaluatedSnapshots.flatMap((snapshot) => typeof snapshot.absoluteError === "number" ? [snapshot.absoluteError] : []);
  const meanError = errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : 0;
  const variance = errors.length > 1 ? errors.reduce((sum, value) => sum + (value - meanError) ** 2, 0) / (errors.length - 1) : 0;
  const metricHalfWidth = errors.length >= 30 ? 1.96 * Math.sqrt(variance) / Math.sqrt(errors.length) : null;
  const majorGroupsReady = [...majorGroupCoverage.values()].filter((athletes) => athletes.size >= INTERNAL_MINIMUM_COHORT).length;
  const ready = statisticallyUsableAthletes >= TRAINING_READINESS_TARGETS.athletes
    && statisticallyUsableResults >= TRAINING_READINESS_TARGETS.officialRaces
    && evaluatedSnapshots.length >= TRAINING_READINESS_TARGETS.evaluatedPredictions
    && majorGroupsReady >= TRAINING_READINESS_TARGETS.majorEventGroups;
  const now = Date.now();
  const retention = (days: number) => {
    const eligible = pilotEnrollments.filter((enrollment) => enrollment.enrolledAt.getTime() <= now - days * 86_400_000);
    const returned = eligible.filter((enrollment) => enrollment.user.productEvents.some((event) => event.occurredAt.getTime() >= enrollment.enrolledAt.getTime() + days * 86_400_000)).length;
    return eligible.length < INTERNAL_MINIMUM_COHORT
      ? { eligible: null, returned: null, rate: null, suppressed: true, minimum: INTERNAL_MINIMUM_COHORT }
      : { eligible: eligible.length, returned, rate: Math.round((returned / eligible.length) * 10_000) / 100, suppressed: false, minimum: INTERNAL_MINIMUM_COHORT };
  };

  return {
    generatedAt: new Date().toISOString(),
    status: ready ? "READY_FOR_CANDIDATE_RESEARCH" : "NOT_READY_FOR_MODEL_TRAINING",
    thresholds: TRAINING_READINESS_TARGETS,
    counts: {
      rawAthletes,
      rawResults,
      consentedAthletes: consentedUsers.length,
      eligibleOfficialResults,
      sourceBackedOfficialResults,
      statisticallyUsableAthletes,
      statisticallyUsableResults,
      evaluatedPredictions: evaluatedSnapshots.length,
      followUpAthletes: new Set(evaluatedSnapshots.map((snapshot) => snapshot.userId)).size,
      averageEligibleResultsPerAthlete: consentedUsers.length ? Math.round((eligibleOfficialResults / consentedUsers.length) * 10) / 10 : 0,
      averageSourceBackedResultsPerAthlete: consentedUsers.length ? Math.round((sourceBackedOfficialResults / consentedUsers.length) * 10) / 10 : 0
    },
    historyThresholds: histories,
    splits: splitAthletes,
    coverage: {
      events: suppressedCoverage(eventCoverage),
      courses: suppressedCoverage(courseCoverage),
      ages: suppressedCoverage(ageCoverage),
      categories: suppressedCoverage(categoryCoverage),
      seasons: suppressedCoverage(seasonCoverage),
      regions: suppressedCoverage(regionCoverage),
      majorEventGroups: suppressedCoverage(majorGroupCoverage)
    },
    quality: {
      importRows: importRowCount,
      duplicateRows,
      duplicateRate: importRowCount ? Math.round((duplicateRows / importRowCount) * 10_000) / 100 : 0,
      excludedRows,
      exclusionRate: importRowCount ? Math.round((excludedRows / importRowCount) * 10_000) / 100 : 0,
      exclusionReasons: {
        INVALID_IMPORT_ROW: statusCount("INVALID"),
        IDENTITY_OR_DUPLICATE_REVIEW: statusCount("REVIEW_REQUIRED"),
        USER_SKIPPED: statusCount("SKIPPED")
      }
    },
    evaluationPrecision: {
      sampleSize: errors.length,
      maeEstimate: errors.length ? Math.round(meanError * 100) / 100 : null,
      approximate95PercentHalfWidth: metricHalfWidth === null ? null : Math.round(metricHalfWidth * 100) / 100,
      status: errors.length >= 30 ? "ESTIMABLE" : "INSUFFICIENT_SAMPLE",
      caveat: "This interval estimates uncertainty around observed absolute error only; it does not establish generalization or subgroup validity."
    },
    evaluationSamples: {
      scoredPredictions: errors.length,
      distinctAthletes: new Set(evaluatedSnapshots.map((snapshot) => snapshot.userId)).size,
      lastRaceBaseline: evaluatedSnapshots.filter((snapshot) => typeof snapshot.lastRaceBaseline === "number").length,
      lastThreeBaseline: evaluatedSnapshots.filter((snapshot) => typeof snapshot.lastThreeBaseline === "number").length,
      linearTrendBaseline: evaluatedSnapshots.filter((snapshot) => typeof snapshot.linearTrendBaseline === "number").length,
      conservativeBaseline: evaluatedSnapshots.filter((snapshot) => typeof snapshot.conservativeBaseline === "number").length,
      probabilityLabels: evaluatedSnapshots.filter((snapshot) => typeof snapshot.pbProbability === "number" && typeof snapshot.achievedPb === "boolean").length
    },
    pilot: {
      cohorts: pilotCohortCount,
      invitations: pilotInvitations.length,
      invitationCapacity: pilotInvitations.reduce((sum, invitation) => sum + invitation.maxUses, 0),
      acceptedInvitationUses: pilotInvitations.reduce((sum, invitation) => sum + invitation.useCount, 0),
      availableInvitations: pilotInvitations.filter((invitation) => !invitation.revokedAt && invitation.expiresAt.getTime() > now && invitation.useCount < invitation.maxUses).length,
      totalEnrollments: pilotEnrollments.length,
      activeEnrollments: pilotEnrollments.filter((enrollment) => enrollment.status === "ACTIVE").length,
      withdrawnEnrollments: pilotEnrollments.filter((enrollment) => enrollment.status === "WITHDRAWN").length,
      completedEnrollments: pilotEnrollments.filter((enrollment) => enrollment.status === "COMPLETED").length,
      retention7Day: retention(7),
      retention30Day: retention(30)
    }
  };
}

type CohortCandidate = {
  userId: string;
  athletePseudonym: string;
  splitAssignment: string;
  swimResultId: string;
  sourceRecordHash: string;
  predictionCutoff: Date;
  featureSnapshot: Prisma.InputJsonValue;
};

function jsonObject(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Prisma.JsonValue> : {};
}

export async function createResearchCohortManifest(input: { createdById: string; extractionCutoff: Date }) {
  const secret = process.env.TRAINING_PSEUDONYM_SECRET;
  if (!secret || secret.length < 32) throw new Error("TRAINING_PSEUDONYM_SECRET_NOT_CONFIGURED");
  if (input.extractionCutoff > new Date()) throw new Error("COHORT_CUTOFF_IN_FUTURE");
  const creator = await prisma.user.findUnique({ where: { id: input.createdById }, select: { role: true } });
  if (creator?.role !== "ADMIN") throw new Error("COHORT_FORBIDDEN");

  const [users, totalUsers, totalResults] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...trainingConsentWhere(),
        trainingConsentedAt: { not: null, lte: input.extractionCutoff }
      },
      select: {
        id: true,
        age: true,
        sex: true,
        trainingConsentVersion: true,
        swims: {
          where: { resultKind: "OFFICIAL", raceType: "INDIVIDUAL", date: { lte: input.extractionCutoff }, createdAt: { lte: input.extractionCutoff } },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            date: true,
            createdAt: true,
            event: true,
            course: true,
            timeSeconds: true,
            source: true,
            meetName: true,
            provenance: true,
            importRowId: true,
            originalRowHash: true,
            externalMeetId: true,
            externalResultId: true
          }
        }
      },
      take: 10_000
    }),
    prisma.user.count({ where: { role: "ATHLETE" } }),
    prisma.swimResult.count({ where: { date: { lte: input.extractionCutoff }, createdAt: { lte: input.extractionCutoff } } })
  ]);

  const candidates: CohortCandidate[] = [];
  const exclusions: Record<string, number> = {
    NO_ACTIVE_TRAINING_CONSENT: Math.max(0, totalUsers - users.length),
    MISSING_RESEARCH_GRADE_SOURCE_PROVENANCE: 0,
    INSUFFICIENT_PRIOR_EVENT_COURSE_HISTORY: 0
  };
  const eventDistribution = new Map<string, number>();
  const courseDistribution = new Map<string, number>();
  const sourceDistribution = new Map<string, number>();
  const importerVersions = new Set<string>();

  for (const user of users) {
    const athletePseudonym = hmacSha256(secret, user.id);
    const splitAssignment = assignResearchSplit(athletePseudonym);
    const grouped = new Map<string, typeof user.swims>();
    for (const result of user.swims) {
      if (!hasResearchGradeResultProvenance(result)) {
        exclusions.MISSING_RESEARCH_GRADE_SOURCE_PROVENANCE += 1;
        continue;
      }
      const key = `${result.event}__${result.course}`;
      grouped.set(key, [...(grouped.get(key) ?? []), result]);
    }
    for (const results of grouped.values()) {
      for (let index = 0; index < results.length; index += 1) {
        const result = results[index];
        // Exact race order inside one meet day is not available, so same-day results
        // are excluded from history instead of being ordered by database timestamps.
        const prior = selectPredictionTimeHistory(results.slice(0, index), result.date, 20);
        if (prior.length < 3) {
          exclusions.INSUFFICIENT_PRIOR_EVENT_COURSE_HISTORY += 1;
          continue;
        }
        const provenance = jsonObject(result.provenance);
        const importerVersion = typeof provenance.importerVersion === "string" ? provenance.importerVersion : "legacy-or-manual-v1";
        importerVersions.add(importerVersion);
        const sourceRecordHash = result.originalRowHash ?? sha256(stableJson({ id: result.id, date: result.date, event: result.event, course: result.course, timeSeconds: result.timeSeconds, source: result.source }));
        const featureSnapshot = {
          schemaVersion: "prediction-time-race-history-v1",
          predictionTime: result.date.toISOString(),
          targetRaceDate: result.date.toISOString(),
          event: result.event,
          course: result.course,
          priorRaceCount: prior.length,
          priorRaces: prior.map((history) => ({ date: history.date.toISOString(), timeSeconds: history.timeSeconds, sourceRecordHash: history.originalRowHash ?? sha256(history.id) })),
          profileAtExtraction: {
            ageAtRace: null,
            categoryAtRace: null,
            taperDaysAtPrediction: null,
            swimSessionsPerWeekAtPrediction: null
          },
          availabilityGuarantee: "Only source races dated before the target race are included. Same-day and later races are excluded.",
          limitation: "Historical age, category, taper, and training frequency are unavailable at prediction time and are therefore not used as historical features."
        };
        candidates.push({ userId: user.id, athletePseudonym, splitAssignment, swimResultId: result.id, sourceRecordHash, predictionCutoff: result.date, featureSnapshot });
        eventDistribution.set(result.event, (eventDistribution.get(result.event) ?? 0) + 1);
        courseDistribution.set(result.course, (courseDistribution.get(result.course) ?? 0) + 1);
        sourceDistribution.set(result.source, (sourceDistribution.get(result.source) ?? 0) + 1);
      }
    }
  }

  const datasetHash = buildResearchDatasetHash(candidates);
  const extractionTimestamp = new Date();
  const includedAthleteIds = new Set(candidates.map((candidate) => candidate.userId));
  const demographicSummary = (valueFor: (user: typeof users[number]) => string) => {
    const groups = new Map<string, number>();
    for (const user of users) {
      if (!includedAthleteIds.has(user.id)) continue;
      const label = valueFor(user);
      groups.set(label, (groups.get(label) ?? 0) + 1);
    }
    return Object.fromEntries([...groups.entries()].sort().map(([label, count]) => [
      label,
      count < INTERNAL_MINIMUM_COHORT ? { count: null, suppressed: true } : { count, suppressed: false }
    ]));
  };
  const manifestPayload = {
    inclusionRules: {
      activeTrainingConsentVersion: CONSENT_POLICY_VERSIONS.MODEL_TRAINING,
      guardianConsentRequiredForMinors: true,
      resultKind: "OFFICIAL",
      raceType: "INDIVIDUAL",
      researchGradeSourceProvenanceRequired: true,
      minimumPriorSameEventCourseResults: 3,
      extractionCutoff: input.extractionCutoff.toISOString(),
      sourceRaceDateBeforeTargetRequired: true,
      databasePersistedBeforeTargetRequired: false
    },
    exclusionRules: {
      withdrawnOrExcludedTrainingConsent: true,
      nonOfficialAndNonIndividualResults: true,
      futureOrPostCutoffRecords: true,
      insufficientPriorHistory: true,
      sameDayRaceOrderUnavailable: true,
      exactHistoricalProfileUnavailable: "EXCLUDED_FROM_FEATURES",
      databaseIngestionTimeNotUsedAsFeatureAvailability: "Official race date is the availability boundary; retrospective imports are disclosed in source provenance."
    },
    consentVersion: CONSENT_POLICY_VERSIONS.MODEL_TRAINING,
    featureSchemaVersion: "prediction-time-race-history-v1",
    splitPolicyVersion: "athlete-hash-70-15-15-v1",
    importerVersions: [...importerVersions].sort(),
    distributions: {
      events: Object.fromEntries([...eventDistribution.entries()].sort()),
      courses: Object.fromEntries([...courseDistribution.entries()].sort()),
      splits: Object.fromEntries(["TRAIN", "VALIDATION", "TEST"].map((split) => [split, new Set(candidates.filter((candidate) => candidate.splitAssignment === split).map((candidate) => candidate.athletePseudonym)).size])),
      ageBands: demographicSummary((user) => ageBand(user.age)),
      categories: demographicSummary((user) => user.sex ?? "Unknown"),
      minimumPublishedSubgroupSize: INTERNAL_MINIMUM_COHORT
    },
    exclusionCounts: exclusions,
    sourceSummary: {
      rawUsersAtExtraction: totalUsers,
      rawResultsBeforeCutoff: totalResults,
      consentedUsers: users.length,
      sourceMethods: Object.fromEntries([...sourceDistribution.entries()].sort()),
      rawFilesRetained: false,
      countsMayOverlapAcrossExclusionReasons: true
    },
    datasetHash,
    recordCount: candidates.length,
    athleteCount: new Set(candidates.map((candidate) => candidate.athletePseudonym)).size,
    extractionCutoff: input.extractionCutoff.toISOString(),
    generatedAt: extractionTimestamp.toISOString()
  };
  const manifestHash = buildResearchManifestHash(manifestPayload);
  const version = `cohort-${extractionTimestamp.toISOString().replace(/[-:.]/g, "").slice(0, 15)}-${manifestHash.slice(0, 10)}`;

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.researchCohortManifest.findUnique({ where: { manifestHash } });
    if (existing) return existing;
    const manifest = await transaction.researchCohortManifest.create({
      data: {
        version,
        createdById: input.createdById,
        createdByPseudonym: hmacSha256(secret, input.createdById),
        extractionCutoff: input.extractionCutoff,
        inclusionRules: manifestPayload.inclusionRules,
        exclusionRules: manifestPayload.exclusionRules,
        consentVersion: manifestPayload.consentVersion,
        featureSchemaVersion: manifestPayload.featureSchemaVersion,
        splitPolicyVersion: manifestPayload.splitPolicyVersion,
        importerVersions: manifestPayload.importerVersions,
        distributions: manifestPayload.distributions,
        exclusionCounts: manifestPayload.exclusionCounts,
        sourceSummary: manifestPayload.sourceSummary,
        datasetHash,
        manifestHash,
        recordCount: manifestPayload.recordCount,
        athleteCount: manifestPayload.athleteCount,
        createdAt: extractionTimestamp
      }
    });
    if (candidates.length) {
      await transaction.researchCohortRecord.createMany({
        data: candidates.map((candidate) => ({ ...candidate, manifestId: manifest.id }))
      });
    }
    return manifest;
  }, { isolationLevel: "Serializable", timeout: 60_000 });
}

export async function listResearchCohortManifests() {
  return prisma.researchCohortManifest.findMany({
    select: { id: true, version: true, status: true, extractionCutoff: true, datasetHash: true, manifestHash: true, recordCount: true, athleteCount: true, distributions: true, exclusionCounts: true, invalidatedAt: true, invalidationReason: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50
  });
}
