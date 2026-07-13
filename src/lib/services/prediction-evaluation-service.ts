import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, SwimResult as PrismaSwimResult } from "@prisma/client";
import { calculateConsistencyScore, isOfficialResult } from "@/lib/analytics";
import { buildProbabilitySet } from "@/lib/prediction-intelligence";
import {
  buildModelPerformanceDashboard,
  calculateForecastBaselines,
  calculatePredictionOutcome,
  projectPredictionToDate,
  type EvaluatedPredictionInput
} from "@/lib/prediction-evaluation";
import { fromPrismaEvent, toPrismaEvent } from "@/lib/prisma-mappers";
import { prisma } from "@/lib/prisma";
import type { Goal, Prediction, PredictionProfile, SwimResult, UpcomingMeet } from "@/types/swim";

interface SyncPredictionSnapshotsInput {
  userId: string;
  predictions: Prediction[];
  swims: SwimResult[];
  profile: PredictionProfile;
  goal?: Goal;
  meets?: UpcomingMeet[];
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validTrainingDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function eligibleHistory(swims: SwimResult[], prediction: Prediction, userId: string) {
  return swims
    .filter((swim) => swim.userId === userId && isOfficialResult(swim) && swim.event === prediction.event && swim.course === prediction.course && swim.date <= prediction.predictionDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-20);
}

export async function syncPredictionSnapshots({
  goal,
  meets = [],
  predictions,
  profile,
  swims,
  userId
}: SyncPredictionSnapshotsInput) {
  const today = new Date().toISOString().slice(0, 10);
  const rows: Prisma.PredictionSnapshotCreateManyInput[] = [];

  for (const prediction of predictions) {
    const history = eligibleHistory(swims, prediction, userId);
    if (!history.length) continue;
    const targets = new Map<string, "HORIZON" | "UPCOMING_MEET">();
    for (const days of [30, 90, 180, 365]) targets.set(addDays(prediction.predictionDate, days), "HORIZON");
    for (const meet of meets) {
      if (meet.targetEvents.includes(prediction.event)) targets.set(meet.startDate, "UPCOMING_MEET");
    }

    for (const [targetDate, targetType] of targets) {
      if (targetDate <= today) continue;
      const projection = projectPredictionToDate(prediction, targetDate);
      const baselines = calculateForecastBaselines(history, targetDate);
      if (!projection || !baselines) continue;
      const matchingGoal = goal?.event === prediction.event && goal.course === prediction.course ? goal : undefined;
      const probabilities = buildProbabilitySet({
        point: projection.predictedTime,
        low: projection.lowerBound,
        high: projection.upperBound,
        pbTime: Math.min(...history.map((swim) => swim.timeSeconds)),
        goalTime: matchingGoal?.targetTime,
        qualifyingTime: matchingGoal?.qualifyingTime,
        residualQuantiles: prediction.model.calibrationResidualQuantiles
      });
      const featureSnapshot = {
        age: profile.age ?? null,
        sex: profile.sex ?? null,
        taperDays: profile.taperDays ?? null,
        swimSessionsPerWeek: profile.swimSessionsPerWeek ?? null,
        historyCount: history.length,
        raceDates: history.map((swim) => swim.date),
        raceTimes: history.map((swim) => swim.timeSeconds),
        latestRaceDate: history[history.length - 1].date,
        latestRaceTime: history[history.length - 1].timeSeconds,
        consistencyScore: calculateConsistencyScore(history),
        course: prediction.course,
        horizonDays: projection.horizonDays
      };
      const immutableInput = {
        event: prediction.event,
        course: prediction.course,
        targetDate,
        modelVersion: prediction.model.version,
        modelSource: prediction.model.kind,
        predictedTime: projection.predictedTime,
        lowerBound: projection.lowerBound,
        upperBound: projection.upperBound,
        confidence: prediction.confidence,
        featureSnapshot,
        explanation: projection.explanation,
        probabilities
      };

      rows.push({
        userId,
        event: toPrismaEvent(prediction.event),
        course: prediction.course,
        targetType,
        horizonDays: projection.horizonDays,
        predictedTime: projection.predictedTime,
        lowerBound: projection.lowerBound,
        upperBound: projection.upperBound,
        confidence: prediction.confidence,
        targetRaceDate: new Date(`${targetDate}T00:00:00.000Z`),
        modelVersion: prediction.model.version,
        modelSource: prediction.model.kind,
        validationMae: prediction.model.validationMae,
        trainingDate: validTrainingDate(prediction.model.trainingDate),
        trainingDatasetSize: prediction.model.trainingDatasetSize,
        featureSnapshot,
        featuresUsed: prediction.model.featuresUsed,
        eligibilityRules: prediction.model.eligibilityRules,
        topFactors: prediction.model.factors,
        explanationMethod: projection.explanation.method,
        explanationBaseTime: projection.explanation.baseTime,
        explanationContributions: projection.explanation.contributions as unknown as Prisma.InputJsonValue,
        calibrationMetadata: prediction.model.calibrationResidualQuantiles as unknown as Prisma.InputJsonValue | undefined,
        dataSufficiency: prediction.model.dataSufficiency,
        athleteAge: profile.age ?? null,
        outOfDistribution: prediction.model.outOfDistribution,
        outOfDistributionReasons: prediction.model.outOfDistributionReasons,
        lastRaceBaseline: baselines.lastRace,
        lastThreeBaseline: baselines.lastThreeAverage,
        linearTrendBaseline: baselines.linearTrend,
        goalTime: matchingGoal?.targetTime ?? null,
        qualifyingTime: matchingGoal?.qualifyingTime ?? null,
        pbProbability: probabilities.pb.probability,
        goalProbability: probabilities.goal?.probability ?? null,
        qualifyingProbability: probabilities.qualifying?.probability ?? null,
        probabilityMethod: probabilities.pb.method,
        inputFingerprint: fingerprint(immutableInput)
      });
    }
  }

  if (!rows.length) return 0;
  const result = await prisma.predictionSnapshot.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

function isEvaluableResult(result: Pick<PrismaSwimResult, "resultKind" | "raceType">) {
  return result.resultKind === "OFFICIAL" && result.raceType === "INDIVIDUAL";
}

export async function evaluatePredictionSnapshotsForResult(
  transaction: Prisma.TransactionClient,
  result: PrismaSwimResult
) {
  if (!isEvaluableResult(result)) return 0;
  const start = new Date(result.date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const bestResult = await transaction.swimResult.findFirst({
    where: {
      userId: result.userId,
      event: result.event,
      course: result.course,
      date: { gte: start, lt: end },
      resultKind: "OFFICIAL",
      raceType: "INDIVIDUAL"
    },
    orderBy: { timeSeconds: "asc" }
  });
  if (!bestResult) return 0;

  const snapshots = await transaction.predictionSnapshot.findMany({
    where: {
      userId: result.userId,
      event: result.event,
      course: result.course,
      targetRaceDate: { gte: start, lt: end },
      predictionTimestamp: { lt: bestResult.createdAt }
    }
  });
  if (!snapshots.length) return 0;

  const priorBest = await transaction.swimResult.findFirst({
    where: {
      userId: result.userId,
      event: result.event,
      course: result.course,
      date: { lt: start },
      resultKind: "OFFICIAL",
      raceType: "INDIVIDUAL"
    },
    orderBy: { timeSeconds: "asc" },
    select: { timeSeconds: true }
  });

  await Promise.all(snapshots.map((snapshot) => {
    const outcome = calculatePredictionOutcome({
      actualTime: bestResult.timeSeconds,
      predictedTime: snapshot.predictedTime,
      lowerBound: snapshot.lowerBound,
      upperBound: snapshot.upperBound,
      priorPersonalBest: priorBest?.timeSeconds,
      goalTime: snapshot.goalTime,
      qualifyingTime: snapshot.qualifyingTime
    });
    return transaction.predictionSnapshot.update({
      where: { id: snapshot.id },
      data: {
        actualResultId: bestResult.id,
        ...outcome,
        evaluatedAt: new Date()
      }
    });
  }));

  return snapshots.length;
}

function sufficiency(value: string): "Low" | "Moderate" | "High" {
  return value === "High" || value === "Moderate" ? value : "Low";
}

function modelSource(value: string): "XGBOOST" | "CONSERVATIVE_ENSEMBLE" {
  return value === "XGBOOST" ? value : "CONSERVATIVE_ENSEMBLE";
}

function probabilityMethod(value: string | null): "EMPIRICAL_RESIDUAL" | "ESTIMATED_RANGE" | null {
  if (value === "EMPIRICAL_RESIDUAL" || value === "ESTIMATED_RANGE") return value;
  return null;
}

export async function getPredictionEvaluationDashboard(userId: string) {
  const [snapshots, pendingPredictions] = await Promise.all([
    prisma.predictionSnapshot.findMany({
      where: { userId },
      orderBy: [{ targetRaceDate: "desc" }, { predictionTimestamp: "desc" }],
      take: 2_000
    }),
    prisma.predictionSnapshot.count({ where: { userId, evaluatedAt: null } })
  ]);

  const rows: EvaluatedPredictionInput[] = snapshots.map((snapshot) => ({
    id: snapshot.id,
    event: fromPrismaEvent(snapshot.event),
    course: snapshot.course,
    targetRaceDate: snapshot.targetRaceDate.toISOString().slice(0, 10),
    predictionTimestamp: snapshot.predictionTimestamp.toISOString(),
    predictedTime: snapshot.predictedTime,
    lowerBound: snapshot.lowerBound,
    upperBound: snapshot.upperBound,
    confidence: snapshot.confidence,
    modelVersion: snapshot.modelVersion,
    modelSource: modelSource(snapshot.modelSource),
    dataSufficiency: sufficiency(snapshot.dataSufficiency),
    athleteAge: snapshot.athleteAge,
    actualTime: snapshot.actualTime,
    absoluteError: snapshot.absoluteError,
    signedError: snapshot.signedError,
    percentageError: snapshot.percentageError,
    withinInterval: snapshot.withinInterval,
    achievedPb: snapshot.achievedPb,
    achievedGoal: snapshot.achievedGoal,
    achievedQualification: snapshot.achievedQualification,
    pbProbability: snapshot.pbProbability,
    goalProbability: snapshot.goalProbability,
    qualifyingProbability: snapshot.qualifyingProbability,
    probabilityMethod: probabilityMethod(snapshot.probabilityMethod),
    evaluatedAt: snapshot.evaluatedAt?.toISOString() ?? null,
    outOfDistribution: snapshot.outOfDistribution,
    lastRaceBaseline: snapshot.lastRaceBaseline,
    lastThreeBaseline: snapshot.lastThreeBaseline,
    linearTrendBaseline: snapshot.linearTrendBaseline
  }));

  const evaluatedRows = rows.filter((row) => row.evaluatedAt && row.actualTime !== null && row.actualTime !== undefined);
  const dashboard = buildModelPerformanceDashboard(evaluatedRows, pendingPredictions);
  dashboard.history = rows.map(({ lastRaceBaseline: _last, lastThreeBaseline: _three, linearTrendBaseline: _trend, ...row }) => row);
  return dashboard;
}
