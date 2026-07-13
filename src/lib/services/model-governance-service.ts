import "server-only";
import { createHash, createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toPrismaEvent } from "@/lib/prisma-mappers";
import {
  calculateDriftReport,
  evaluateReleaseCandidate,
  type MonitoringObservation,
  type ReleaseCandidate,
  type ReleaseGateConfig,
  type ReleaseMetrics,
  type SubgroupReleaseMetrics
} from "@/lib/prediction-governance";
import type { Course, SwimEvent } from "@/types/swim";

export interface RegisterModelInput {
  modelVersion: string;
  event: SwimEvent;
  course: Course;
  artifact: unknown;
  datasetVersion: string;
  featureSchemaVersion: string;
  trainingCodeVersion: string;
  evaluationVersion: string;
  metrics: ReleaseMetrics;
  subgroupMetrics: SubgroupReleaseMetrics[];
}

function artifactHash(artifact: unknown) {
  return createHash("sha256").update(JSON.stringify(artifact)).digest("hex");
}

function inputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function actorPseudonym(identifier: string) {
  const secret = process.env.MODEL_GOVERNANCE_AUDIT_SECRET;
  if (!identifier.trim() || !secret || secret.length < 32) throw new Error("MODEL_GOVERNANCE_AUDIT_SECRET_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(identifier.trim().toLowerCase()).digest("hex");
}

function releaseMetrics(value: Prisma.JsonValue): ReleaseMetrics {
  const metrics = value as unknown as Partial<ReleaseMetrics>;
  const required = ["mae", "medianAbsoluteError", "rmse", "brierScore", "calibrationError", "intervalCoverage", "sampleSize"] as const;
  if (!required.every((key) => typeof metrics[key] === "number" && Number.isFinite(metrics[key]))) {
    throw new Error("MODEL_REGISTRY_METRICS_INVALID");
  }
  return metrics as ReleaseMetrics;
}

function subgroupMetrics(value: Prisma.JsonValue): SubgroupReleaseMetrics[] {
  if (!Array.isArray(value)) throw new Error("MODEL_REGISTRY_SUBGROUP_METRICS_INVALID");
  return value as unknown as SubgroupReleaseMetrics[];
}

export async function registerModelChallenger(input: RegisterModelInput, actorIdentifier: string) {
  return prisma.$transaction(async (transaction) => {
    const entry = await transaction.modelRegistryEntry.create({
      data: {
        modelVersion: input.modelVersion,
        event: toPrismaEvent(input.event),
        course: input.course,
        status: "CHALLENGER",
        artifactHash: artifactHash(input.artifact),
        datasetVersion: input.datasetVersion,
        featureSchemaVersion: input.featureSchemaVersion,
        trainingCodeVersion: input.trainingCodeVersion,
        evaluationVersion: input.evaluationVersion,
        metrics: inputJson(input.metrics),
        subgroupMetrics: inputJson(input.subgroupMetrics),
        sampleSize: input.metrics.sampleSize
      }
    });
    await transaction.modelReleaseDecision.create({
      data: {
        registryId: entry.id,
        action: "REGISTERED",
        reason: "Candidate registered as challenger. Training success does not imply promotion.",
        metricsSnapshot: inputJson({ metrics: input.metrics, subgroups: input.subgroupMetrics }),
        actorPseudonym: actorPseudonym(actorIdentifier)
      }
    });
    return entry;
  }, { isolationLevel: "Serializable" });
}

function toReleaseCandidate(entry: {
  modelVersion: string;
  metrics: Prisma.JsonValue;
  subgroupMetrics: Prisma.JsonValue;
}): ReleaseCandidate {
  return {
    modelVersion: entry.modelVersion,
    metrics: releaseMetrics(entry.metrics),
    subgroups: subgroupMetrics(entry.subgroupMetrics)
  };
}

export async function evaluateModelChallenger({
  actorIdentifier,
  baselineMetrics,
  challengerId,
  config,
  promote = false
}: {
  actorIdentifier: string;
  baselineMetrics: Record<string, ReleaseMetrics>;
  challengerId: string;
  config?: ReleaseGateConfig;
  promote?: boolean;
}) {
  return prisma.$transaction(async (transaction) => {
    const challenger = await transaction.modelRegistryEntry.findUnique({ where: { id: challengerId } });
    if (!challenger || challenger.status !== "CHALLENGER") throw new Error("MODEL_CHALLENGER_NOT_FOUND");
    const champion = await transaction.modelRegistryEntry.findFirst({
      where: { event: challenger.event, course: challenger.course, status: "CHAMPION" },
      orderBy: { createdAt: "desc" }
    });
    if (!champion) throw new Error("MODEL_CHAMPION_NOT_REGISTERED");

    const decision = evaluateReleaseCandidate({
      baselines: baselineMetrics,
      candidate: toReleaseCandidate(challenger),
      champion: toReleaseCandidate(champion),
      config
    });
    const action = decision.passed ? (promote ? "PROMOTED" : "EVALUATED") : "REJECTED";
    const reason = decision.passed
      ? promote
        ? "All configured release gates passed; an authorized operator explicitly approved promotion."
        : "All configured release gates passed. Candidate remains a challenger until explicit promotion."
      : decision.reasons.join(" | ");

    await transaction.modelReleaseDecision.create({
      data: {
        registryId: challenger.id,
        action,
        reason,
        metricsSnapshot: inputJson({ releaseDecision: decision, baselines: baselineMetrics }),
        actorPseudonym: actorPseudonym(actorIdentifier)
      }
    });

    if (!decision.passed) {
      await transaction.modelRegistryEntry.update({ where: { id: challenger.id }, data: { status: "REJECTED" } });
    } else if (promote) {
      await transaction.modelReleaseDecision.create({
        data: {
          registryId: champion.id,
          action: "RETIRED",
          reason: `Replaced by explicitly promoted model ${challenger.modelVersion}.`,
          metricsSnapshot: inputJson(champion.metrics),
          actorPseudonym: actorPseudonym(actorIdentifier)
        }
      });
      await transaction.modelRegistryEntry.update({ where: { id: champion.id }, data: { status: "RETIRED" } });
      await transaction.modelRegistryEntry.update({ where: { id: challenger.id }, data: { status: "CHAMPION" } });
    }

    return { action, promoted: decision.passed && promote, decision };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}

export async function overrideModelPromotion({
  actorIdentifier,
  challengerId,
  reason
}: {
  actorIdentifier: string;
  challengerId: string;
  reason: string;
}) {
  const normalizedReason = reason.trim();
  if (normalizedReason.length < 20 || normalizedReason.length > 1_000) throw new Error("MODEL_OVERRIDE_REASON_INVALID");
  return prisma.$transaction(async (transaction) => {
    const challenger = await transaction.modelRegistryEntry.findUnique({ where: { id: challengerId } });
    if (!challenger || challenger.status !== "CHALLENGER") throw new Error("MODEL_CHALLENGER_NOT_FOUND");
    const champion = await transaction.modelRegistryEntry.findFirst({
      where: { event: challenger.event, course: challenger.course, status: "CHAMPION" }
    });
    if (champion) {
      await transaction.modelReleaseDecision.create({
        data: {
          registryId: champion.id,
          action: "RETIRED",
          reason: `Retired by explicit override for ${challenger.modelVersion}.`,
          metricsSnapshot: inputJson(champion.metrics),
          actorPseudonym: actorPseudonym(actorIdentifier)
        }
      });
      await transaction.modelRegistryEntry.update({ where: { id: champion.id }, data: { status: "RETIRED" } });
    }
    await transaction.modelReleaseDecision.create({
      data: {
        registryId: challenger.id,
        action: "OVERRIDDEN",
        reason: normalizedReason,
        metricsSnapshot: inputJson({ metrics: challenger.metrics, subgroups: challenger.subgroupMetrics }),
        actorPseudonym: actorPseudonym(actorIdentifier)
      }
    });
    await transaction.modelRegistryEntry.update({ where: { id: challenger.id }, data: { status: "CHAMPION" } });
    return { promoted: true, overridden: true };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}

function numericFeatureSnapshot(value: Prisma.JsonValue): Record<string, number | null> {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => typeof item === "number" || item === null ? [[key, item]] : []));
}

function monitoringObservation(snapshot: {
  predictedTime: number;
  actualTime: number | null;
  withinInterval: boolean | null;
  pbProbability: number | null;
  achievedPb: boolean | null;
  goalProbability: number | null;
  achievedGoal: boolean | null;
  qualifyingProbability: number | null;
  achievedQualification: boolean | null;
  dataQualityScore: number | null;
  featureSnapshot: Prisma.JsonValue;
}): MonitoringObservation {
  return {
    predictedTime: snapshot.predictedTime,
    actualTime: snapshot.actualTime,
    withinInterval: snapshot.withinInterval,
    probability: snapshot.pbProbability,
    outcome: snapshot.achievedPb,
    probabilityPairs: [
      [snapshot.pbProbability, snapshot.achievedPb],
      [snapshot.goalProbability, snapshot.achievedGoal],
      [snapshot.qualifyingProbability, snapshot.achievedQualification]
    ].flatMap(([probability, outcome]) => typeof probability === "number" && typeof outcome === "boolean"
      ? [{ probability, outcome }]
      : []),
    features: {
      ...numericFeatureSnapshot(snapshot.featureSnapshot),
      dataQualityScore: snapshot.dataQualityScore
    }
  };
}

export async function refreshModelMonitoring({
  ageBand = "ALL",
  category = "ALL",
  course,
  event,
  horizonBand = "ALL",
  minSample = 30,
  modelVersion
}: {
  ageBand?: string;
  category?: "ALL" | "FEMALE" | "MALE";
  course: Course;
  event: SwimEvent;
  horizonBand?: string;
  minSample?: number;
  modelVersion: string;
}) {
  const rows = await prisma.predictionSnapshot.findMany({
    where: {
      modelVersion,
      event: toPrismaEvent(event),
      course,
      ...ageBandWhere(ageBand),
      ...(category === "ALL" ? {} : { athleteSex: category }),
      ...horizonWhere(horizonBand)
    },
    orderBy: { predictionTimestamp: "asc" },
    take: 4_000,
    select: {
      predictedTime: true,
      actualTime: true,
      withinInterval: true,
      pbProbability: true,
      achievedPb: true,
      goalProbability: true,
      achievedGoal: true,
      qualifyingProbability: true,
      achievedQualification: true,
      dataQualityScore: true,
      featureSnapshot: true
    }
  });
  const attempts = await prisma.predictionAttempt.findMany({
    where: { event: toPrismaEvent(event), course },
    orderBy: { attemptedAt: "asc" },
    take: 4_000,
    select: { eligibilityDecision: true }
  });
  const split = Math.floor(rows.length / 2);
  const baseline = rows.slice(0, split).map(monitoringObservation);
  const recent = rows.slice(split).map(monitoringObservation);
  const report = calculateDriftReport(baseline, recent, minSample);
  const attemptSplit = Math.floor(attempts.length / 2);
  const baselineAttempts = attempts.slice(0, attemptSplit);
  const recentAttempts = attempts.slice(attemptSplit);
  const unsupportedRate = (items: typeof attempts) => items.length
    ? items.filter((item) => item.eligibilityDecision === "NO_PREDICTION" || item.eligibilityDecision === "PROVISIONAL_ONLY").length / items.length
    : 0;
  const unsupportedRateDrift = baselineAttempts.length >= minSample && recentAttempts.length >= minSample
    ? unsupportedRate(recentAttempts) - unsupportedRate(baselineAttempts)
    : null;
  const unsupportedWarning = unsupportedRateDrift !== null && unsupportedRateDrift >= 0.15;
  const status = unsupportedWarning && report.status !== "CRITICAL" ? "WARNING" : report.status;
  const recommendation = unsupportedWarning
    ? "Unsupported or provisional prediction attempts increased materially. Review data ingestion and eligibility reasons before considering retraining."
    : report.recommendation;
  const evidence = unsupportedWarning
    ? [...report.evidence, `Unsupported/provisional attempt rate rose by ${roundForEvidence(unsupportedRateDrift * 100)} percentage points.`]
    : report.evidence;

  return prisma.modelMonitoringSnapshot.create({
    data: {
      modelVersion,
      event: toPrismaEvent(event),
      course,
      horizonBand,
      ageBand,
      category,
      sampleSize: report.sampleSize,
      baselineSize: report.baselineSize,
      status,
      featureDrift: report.featureDrift,
      predictionDrift: report.predictionDrift,
      residualDrift: report.residualDrift,
      coverageDrift: report.coverageDrift,
      calibrationDrift: report.calibrationDrift,
      unsupportedRateDrift,
      recommendation,
      evidence: { evidence, uncertainty: report.uncertainty }
    }
  });
}

function roundForEvidence(value: number) {
  return Math.round(value * 10) / 10;
}

function ageBandWhere(ageBand: string): Prisma.PredictionSnapshotWhereInput {
  if (ageBand === "10_AND_UNDER") return { athleteAge: { lte: 10 } };
  if (ageBand === "11_12") return { athleteAge: { gte: 11, lte: 12 } };
  if (ageBand === "13_14") return { athleteAge: { gte: 13, lte: 14 } };
  if (ageBand === "15_16") return { athleteAge: { gte: 15, lte: 16 } };
  if (ageBand === "17_18") return { athleteAge: { gte: 17, lte: 18 } };
  if (ageBand === "19_AND_OVER") return { athleteAge: { gte: 19 } };
  if (ageBand === "UNKNOWN") return { athleteAge: null };
  return {};
}

function horizonWhere(horizonBand: string): Prisma.PredictionSnapshotWhereInput {
  if (horizonBand === "0_30_DAYS") return { horizonDays: { lte: 30 } };
  if (horizonBand === "31_90_DAYS") return { horizonDays: { gte: 31, lte: 90 } };
  if (horizonBand === "91_180_DAYS") return { horizonDays: { gte: 91, lte: 180 } };
  if (horizonBand === "181_365_DAYS") return { horizonDays: { gte: 181, lte: 365 } };
  return {};
}

export async function getModelGovernanceOverview() {
  const [registry, decisions, monitoring] = await Promise.all([
    prisma.modelRegistryEntry.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.modelReleaseDecision.findMany({ orderBy: { createdAt: "desc" }, take: 250 }),
    prisma.modelMonitoringSnapshot.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  return { registry, decisions, monitoring };
}

export async function getApprovedHundredFreeChampionReleases() {
  const champions = await prisma.modelRegistryEntry.findMany({
    where: { event: "ONE_HUNDRED_FREESTYLE", status: "CHAMPION" },
    select: { course: true, modelVersion: true, artifactHash: true }
  });
  return Object.fromEntries(champions.map((champion) => [
    champion.course,
    { modelVersion: champion.modelVersion, artifactHash: champion.artifactHash }
  ])) as Partial<Record<Course, { modelVersion: string; artifactHash: string }>>;
}
