import "server-only";
import { hasDatabaseConfig, prisma } from "@/lib/prisma";
import { CONSENT_POLICY_VERSIONS, PUBLIC_RESEARCH_MINIMUM_COHORT, suppressSmallCohort } from "@/lib/services/privacy-service";
import { TRAINING_READINESS_TARGETS } from "@/lib/services/data-foundation-service";
import { hasResearchGradeResultProvenance } from "@/lib/research-eligibility";

const MIN_EVALUATED_PREDICTIONS = 30;

const limitations = [
  "Current accounts are not a representative sample of competitive swimmers.",
  "Exact age at historical race time is unavailable without a date-of-birth field.",
  "Course, event, age, category, and region subgroups remain unpublished below privacy and stability thresholds.",
  "Self-entered and imported data can contain source errors despite validation and provenance controls.",
  "Public metrics use only source-backed imported official results. User-declared official results remain visible privately but are excluded from public scoring.",
  "A deterministic forecast is not evidence of causal training effects or medical readiness."
];

const knownFailureModes = [
  "Sparse or irregular race histories",
  "Abrupt technique, coaching, illness, or training changes not represented in race data",
  "Incorrect course or race-status metadata",
  "Out-of-distribution elite or very young swimmers",
  "Future performance affected by circumstances unavailable at prediction time"
];

function suppressedMetricReason() {
  return `Metrics require at least ${MIN_EVALUATED_PREDICTIONS} evaluated predictions across ${PUBLIC_RESEARCH_MINIMUM_COHORT} athletes with active public-research consent. Current evidence is too small for a stable public claim.`;
}

function untrainedStatus() {
  return {
    generatedAt: new Date().toISOString(),
    productionStatus: "UNTRAINED",
    currentBehavior: "Conservative deterministic forecasts are in production. No machine-learning challenger has been promoted.",
    modelVersion: "conservative-deterministic-v1",
    lastEvaluationDate: null,
    sampleThresholds: { evaluatedPredictions: MIN_EVALUATED_PREDICTIONS, publicCohort: PUBLIC_RESEARCH_MINIMUM_COHORT, strategicTargets: TRAINING_READINESS_TARGETS },
    cohort: {
      eligibleAthletes: suppressSmallCohort(0, 0),
      eligibleOfficialRaces: suppressSmallCohort(0, 0),
      evaluatedAthletes: suppressSmallCohort(0, 0),
      evaluatedPredictions: 0,
      excludedSelfDeclaredEvaluations: 0
    },
    metrics: null,
    metricSuppression: suppressedMetricReason(),
    limitations,
    knownFailureModes
  };
}

const publicResearchUserWhere = {
  role: "ATHLETE" as const,
  researchConsentVersion: CONSENT_POLICY_VERSIONS.PUBLIC_RESEARCH,
  researchConsentedAt: { not: null },
  researchConsentWithdrawnAt: null,
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

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value: number, places = 2) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export async function getPublicValidationStatus() {
  if (!hasDatabaseConfig()) return untrainedStatus();
  const [champions, evaluated, eligibleUsers, sealedCohorts] = await Promise.all([
    prisma.modelRegistryEntry.findMany({ where: { status: "CHAMPION" }, orderBy: { createdAt: "desc" }, select: { modelVersion: true, event: true, course: true, datasetVersion: true, sampleSize: true, metrics: true, createdAt: true } }),
    prisma.predictionSnapshot.findMany({
      where: { evaluatedAt: { not: null }, actualTime: { not: null }, user: publicResearchUserWhere },
      select: {
        userId: true,
        modelVersion: true,
        absoluteError: true,
        withinInterval: true,
        pbProbability: true,
        achievedPb: true,
        lastRaceBaseline: true,
        lastThreeBaseline: true,
        linearTrendBaseline: true,
        conservativeBaseline: true,
        actualTime: true,
        evaluatedAt: true,
        actualResult: { select: { importRowId: true, originalRowHash: true, externalMeetId: true, externalResultId: true, source: true } }
      },
      orderBy: { evaluatedAt: "asc" },
      take: 100_000
    }),
    prisma.user.findMany({
      where: {
        ...publicResearchUserWhere,
        swims: {
          some: {
            resultKind: "OFFICIAL",
            raceType: "INDIVIDUAL",
            importRowId: { not: null },
            originalRowHash: { not: null },
            externalMeetId: { not: null },
            externalResultId: { not: null }
          }
        }
      },
      select: {
        id: true,
        swims: {
          where: {
            resultKind: "OFFICIAL",
            raceType: "INDIVIDUAL",
            importRowId: { not: null },
            originalRowHash: { not: null },
            externalMeetId: { not: null },
            externalResultId: { not: null }
          },
          select: { id: true }
        }
      },
      take: 10_000
    }),
    prisma.researchCohortManifest.findMany({ where: { status: "SEALED" }, select: { version: true }, take: 1_000 })
  ]);
  const scored = evaluated.filter((row) => typeof row.absoluteError === "number" && row.actualResult && hasResearchGradeResultProvenance(row.actualResult));
  const excludedSelfDeclaredEvaluations = evaluated.length - scored.length;
  const evaluatedAthletes = new Set(scored.map((row) => row.userId)).size;
  const stable = scored.length >= MIN_EVALUATED_PREDICTIONS && evaluatedAthletes >= PUBLIC_RESEARCH_MINIMUM_COHORT;
  const errors = scored.map((row) => row.absoluteError!);
  const baselineMae = (valueFor: (row: typeof evaluated[number]) => number | null) => {
    const baselineErrors = scored.flatMap((row) => {
    const baseline = valueFor(row);
    return typeof baseline === "number" && typeof row.actualTime === "number" ? [Math.abs(row.actualTime - baseline)] : [];
    });
    return baselineErrors.length ? round(mean(baselineErrors)) : null;
  };
  const probabilityRows = scored.flatMap((row) => typeof row.pbProbability === "number" && typeof row.achievedPb === "boolean" ? [{ probability: row.pbProbability / 100, outcome: row.achievedPb ? 1 : 0 }] : []);
  const brier = mean(probabilityRows.map(({ probability, outcome }) => (probability - outcome) ** 2));
  const calibrationBins = [0, 0.2, 0.4, 0.6, 0.8].map((start) => {
    const rows = probabilityRows.filter(({ probability }) => probability >= start && (start === 0.8 ? probability <= 1 : probability < start + 0.2));
    return { count: rows.length, predicted: mean(rows.map((row) => row.probability)), observed: mean(rows.map((row) => row.outcome)) };
  });
  const calibrationError = probabilityRows.length
    ? calibrationBins.reduce((sum, bin) => sum + Math.abs(bin.predicted - bin.observed) * bin.count, 0) / probabilityRows.length
    : 0;
  const sealedVersions = new Set(sealedCohorts.map((cohort) => cohort.version));
  const learnedChampion = champions.find((champion) => !champion.modelVersion.startsWith("conservative-ensemble")
    && champion.sampleSize >= MIN_EVALUATED_PREDICTIONS
    && sealedVersions.has(champion.datasetVersion));
  const eligibleRaceCount = eligibleUsers.reduce((sum, user) => sum + user.swims.length, 0);

  return {
    generatedAt: new Date().toISOString(),
    productionStatus: learnedChampion ? "ML_BACKED_CHAMPION" : "UNTRAINED",
    currentBehavior: learnedChampion ? "Machine-learning model passed configured release gates." : "Conservative deterministic forecasts are in production. No machine-learning challenger has been promoted.",
    modelVersion: learnedChampion?.modelVersion ?? champions[0]?.modelVersion ?? "conservative-deterministic-v1",
    lastEvaluationDate: evaluated.at(-1)?.evaluatedAt?.toISOString() ?? null,
    sampleThresholds: { evaluatedPredictions: MIN_EVALUATED_PREDICTIONS, publicCohort: PUBLIC_RESEARCH_MINIMUM_COHORT, strategicTargets: TRAINING_READINESS_TARGETS },
    cohort: {
      eligibleAthletes: suppressSmallCohort(eligibleUsers.length, eligibleUsers.length),
      eligibleOfficialRaces: suppressSmallCohort(eligibleUsers.length, eligibleRaceCount),
      evaluatedAthletes: suppressSmallCohort(evaluatedAthletes, evaluatedAthletes),
      evaluatedPredictions: scored.length,
      excludedSelfDeclaredEvaluations
    },
    metrics: stable ? {
      mae: round(mean(errors)),
      medianAbsoluteError: round(median(errors)),
      intervalCoverage: round(mean(scored.flatMap((row) => typeof row.withinInterval === "boolean" ? [row.withinInterval ? 100 : 0] : [])), 1),
      brierScore: probabilityRows.length >= MIN_EVALUATED_PREDICTIONS ? round(brier, 4) : null,
      calibrationError: probabilityRows.length >= MIN_EVALUATED_PREDICTIONS ? round(calibrationError, 4) : null,
      baselines: {
        lastRace: baselineMae((row) => row.lastRaceBaseline),
        lastThreeAverage: baselineMae((row) => row.lastThreeBaseline),
        linearTrend: baselineMae((row) => row.linearTrendBaseline),
        conservativeDeterministic: baselineMae((row) => row.conservativeBaseline)
      }
    } : null,
    metricSuppression: stable ? null : suppressedMetricReason(),
    limitations,
    knownFailureModes
  };
}
