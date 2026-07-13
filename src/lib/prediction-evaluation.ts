import type {
  ModelPerformanceBreakdown,
  ModelPerformanceDashboard,
  Prediction,
  PredictionExplanation,
  PredictionEvaluationRecord,
  SwimResult
} from "@/types/swim";
import { clamp, dateToDays, round } from "@/lib/utils";
import { interpolateExplanation } from "@/lib/prediction-intelligence";

export interface ForecastProjection {
  horizonDays: number;
  predictedTime: number;
  lowerBound: number;
  upperBound: number;
  explanation: PredictionExplanation;
}

export interface PredictionOutcome {
  actualTime: number;
  absoluteError: number;
  signedError: number;
  percentageError: number;
  withinInterval: boolean;
  achievedPb: boolean;
  achievedGoal: boolean | null;
  achievedQualification: boolean | null;
}

export interface EvaluatedPredictionInput extends PredictionEvaluationRecord {
  lastRaceBaseline: number;
  lastThreeBaseline: number;
  linearTrendBaseline: number;
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function projectPredictionToDate(prediction: Prediction, targetDate: string): ForecastProjection | null {
  const horizonDays = dateToDays(targetDate) - dateToDays(prediction.predictionDate);
  if (horizonDays <= 0 || horizonDays > 365) return null;

  const zeroExplanation: PredictionExplanation = {
    method: prediction.explanations.days30.method,
    baseTime: prediction.currentTime,
    predictedTime: prediction.currentTime,
    contributions: [],
    additiveResidual: 0,
    disclaimer: prediction.explanations.days30.disclaimer
  };
  const points = [
    { day: 0, time: prediction.currentTime, low: prediction.currentTime, high: prediction.currentTime, explanation: zeroExplanation },
    { day: 30, time: prediction.predictedTimes.days30, ...prediction.likelyRanges.days30, explanation: prediction.explanations.days30 },
    { day: 90, time: prediction.predictedTimes.days90, ...prediction.likelyRanges.days90, explanation: prediction.explanations.days90 },
    { day: 180, time: prediction.predictedTimes.days180, ...prediction.likelyRanges.days180, explanation: prediction.explanations.days180 },
    { day: 365, time: prediction.predictedTimes.days365, ...prediction.likelyRanges.days365, explanation: prediction.explanations.days365 }
  ].map((point) => ({
    day: point.day,
    time: point.time,
    explanation: point.explanation,
    low: "low" in point ? point.low : prediction.currentTime,
    high: "high" in point ? point.high : prediction.currentTime
  }));
  const endIndex = points.findIndex((point) => point.day >= horizonDays);
  const end = points[Math.max(1, endIndex)];
  const start = points[Math.max(0, Math.max(1, endIndex) - 1)];
  const progress = clamp((horizonDays - start.day) / Math.max(end.day - start.day, 1), 0, 1);

  const predictedTime = round(interpolate(start.time, end.time, progress), 2);
  return {
    horizonDays,
    predictedTime,
    lowerBound: round(interpolate(start.low, end.low, progress), 2),
    upperBound: round(interpolate(start.high, end.high, progress), 2),
    explanation: interpolateExplanation(start.explanation, end.explanation, progress, predictedTime)
  };
}

export function calculatePredictionOutcome({
  actualTime,
  goalTime,
  qualifyingTime,
  lowerBound,
  predictedTime,
  priorPersonalBest,
  upperBound
}: {
  actualTime: number;
  goalTime?: number | null;
  qualifyingTime?: number | null;
  lowerBound: number;
  predictedTime: number;
  priorPersonalBest?: number | null;
  upperBound: number;
}): PredictionOutcome {
  const signedError = actualTime - predictedTime;
  return {
    actualTime,
    absoluteError: round(Math.abs(signedError), 4),
    signedError: round(signedError, 4),
    percentageError: round((Math.abs(signedError) / actualTime) * 100, 4),
    withinInterval: actualTime >= lowerBound && actualTime <= upperBound,
    achievedPb: priorPersonalBest === null || priorPersonalBest === undefined ? true : actualTime < priorPersonalBest,
    achievedGoal: goalTime === null || goalTime === undefined ? null : actualTime <= goalTime,
    achievedQualification: qualifyingTime === null || qualifyingTime === undefined ? null : actualTime <= qualifyingTime
  };
}

export function calculateForecastBaselines(history: SwimResult[], targetDate: string) {
  const sorted = [...history].sort((a, b) => dateToDays(a.date) - dateToDays(b.date)).slice(-20);
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  const recentThree = sorted.slice(-3);
  const lastThreeBaseline = recentThree.reduce((sum, swim) => sum + swim.timeSeconds, 0) / recentThree.length;
  const trendWindow = sorted.slice(-5);
  const startDay = dateToDays(trendWindow[0].date);
  const points = trendWindow.map((swim) => ({ x: dateToDays(swim.date) - startDay, y: swim.timeSeconds }));
  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumXX - sumX ** 2;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  const targetX = dateToDays(targetDate) - startDay;

  return {
    lastRace: round(latest.timeSeconds, 4),
    lastThreeAverage: round(lastThreeBaseline, 4),
    linearTrend: round(Math.max(1, intercept + slope * targetX), 4)
  };
}

function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function breakdown(rows: EvaluatedPredictionInput[], labelFor: (row: EvaluatedPredictionInput) => string): ModelPerformanceBreakdown[] {
  const groups = new Map<string, EvaluatedPredictionInput[]>();
  for (const row of rows) groups.set(labelFor(row), [...(groups.get(labelFor(row)) ?? []), row]);
  return [...groups.entries()].map(([label, group]) => ({
    label,
    count: group.length,
    mae: round(mean(group.map((row) => row.absoluteError ?? 0)), 2),
    medianAbsoluteError: round(median(group.map((row) => row.absoluteError ?? 0)), 2),
    intervalCoverage: round(mean(group.map((row) => row.withinInterval ? 100 : 0)), 1)
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function ageGroup(age?: number | null) {
  if (!age) return "Unknown age";
  if (age <= 10) return "10 and under";
  if (age <= 12) return "11–12";
  if (age <= 14) return "13–14";
  if (age <= 16) return "15–16";
  if (age <= 18) return "17–18";
  return "19 and over";
}

function calibrationFor(
  rows: EvaluatedPredictionInput[],
  label: ModelPerformanceDashboard["probabilityCalibration"][number]["label"],
  probabilityFor: (row: EvaluatedPredictionInput) => number | null | undefined,
  outcomeFor: (row: EvaluatedPredictionInput) => boolean | null | undefined
) {
  const observations = rows.flatMap((row) => {
    const probability = probabilityFor(row);
    const outcome = outcomeFor(row);
    return typeof probability === "number" && typeof outcome === "boolean" ? [{ probability, outcome }] : [];
  });
  const bins = [0, 20, 40, 60, 80].map((start) => {
    const end = start + 20;
    const matches = observations.filter(({ probability }) => probability >= start && (end === 100 ? probability <= end : probability < end));
    return {
      label: `${start}–${end}%`,
      count: matches.length,
      meanPredicted: round(mean(matches.map(({ probability }) => probability)), 1),
      observedRate: round(mean(matches.map(({ outcome }) => outcome ? 100 : 0)), 1)
    };
  });

  return {
    label,
    count: observations.length,
    brierScore: round(mean(observations.map(({ probability, outcome }) => ((probability / 100) - (outcome ? 1 : 0)) ** 2)), 4),
    bins
  };
}

export function buildModelPerformanceDashboard(
  rows: EvaluatedPredictionInput[],
  pendingPredictions: number
): ModelPerformanceDashboard {
  const absoluteErrors = rows.map((row) => row.absoluteError ?? 0);
  const squaredErrors = rows.map((row) => (row.signedError ?? 0) ** 2);
  const probabilityCalibration = [
    calibrationFor(rows, "PB", (row) => row.pbProbability, (row) => row.achievedPb),
    calibrationFor(rows, "Goal", (row) => row.goalProbability, (row) => row.achievedGoal),
    calibrationFor(rows, "Qualifying", (row) => row.qualifyingProbability, (row) => row.achievedQualification)
  ];
  const probabilityCount = probabilityCalibration.reduce((sum, calibration) => sum + calibration.count, 0);
  const weightedBrier = probabilityCount
    ? probabilityCalibration.reduce((sum, calibration) => sum + calibration.brierScore * calibration.count, 0) / probabilityCount
    : 0;
  const baseline = (label: ModelPerformanceDashboard["baselines"][number]["label"], values: number[]) => ({
    label,
    count: rows.length,
    mae: round(mean(values), 2)
  });

  return {
    summary: {
      evaluatedPredictions: rows.length,
      pendingPredictions,
      mae: round(mean(absoluteErrors), 2),
      medianAbsoluteError: round(median(absoluteErrors), 2),
      rmse: round(Math.sqrt(mean(squaredErrors)), 2),
      intervalCoverage: round(mean(rows.map((row) => row.withinInterval ? 100 : 0)), 1),
      probabilityEvaluations: probabilityCount,
      probabilityBrierScore: round(weightedBrier, 4)
    },
    byEvent: breakdown(rows, (row) => `${row.event} · ${row.course}`),
    byAgeGroup: breakdown(rows, (row) => ageGroup(row.athleteAge)),
    byConfidence: breakdown(rows, (row) => row.confidence >= 70 ? "High confidence" : row.confidence >= 45 ? "Moderate confidence" : "Low confidence"),
    byDataSufficiency: breakdown(rows, (row) => `${row.dataSufficiency} data`),
    byModelVersion: breakdown(rows, (row) => row.modelVersion),
    baselines: [
      baseline("SwimSight", absoluteErrors),
      baseline("Last race", rows.map((row) => Math.abs((row.actualTime ?? 0) - row.lastRaceBaseline))),
      baseline("Last-three average", rows.map((row) => Math.abs((row.actualTime ?? 0) - row.lastThreeBaseline))),
      baseline("Linear trend", rows.map((row) => Math.abs((row.actualTime ?? 0) - row.linearTrendBaseline)))
    ],
    probabilityCalibration,
    history: rows.map(({ lastRaceBaseline: _last, lastThreeBaseline: _three, linearTrendBaseline: _trend, ...row }) => row)
  };
}
