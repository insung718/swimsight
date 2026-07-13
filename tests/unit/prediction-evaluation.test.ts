import { describe, expect, it } from "vitest";
import {
  buildModelPerformanceDashboard,
  calculatePredictionOutcome,
  projectPredictionToDate,
  type EvaluatedPredictionInput
} from "@/lib/prediction-evaluation";
import { validateXgboostArtifact } from "@/lib/xgboost-runtime";
import type { Prediction } from "@/types/swim";

const prediction: Prediction = {
  event: "100 Freestyle",
  course: "LCM",
  currentTime: 62,
  predictionDate: "2026-01-01",
  predictedTimes: { days30: 61.5, days90: 60.5, days180: 59.8, days365: 58.9 },
  likelyRanges: {
    days30: { low: 61.1, high: 61.9 },
    days90: { low: 59.9, high: 61.1 },
    days180: { low: 59, high: 60.6 },
    days365: { low: 57.8, high: 60 }
  },
  confidence: 72,
  model: {
    kind: "CONSERVATIVE_ENSEMBLE",
    version: "golden-v1",
    historyUsed: 8,
    dataSufficiency: "Moderate",
    factors: [],
    featuresUsed: [],
    eligibilityRules: [],
    outOfDistribution: false,
    outOfDistributionReasons: [],
    sufficiencyChecklist: []
  },
  trainingImpact: { label: "No gym data", adjustmentMultiplier: 1, weeklyLoad: 0, sessionsLast28Days: 0 }
};

function evaluated(overrides: Partial<EvaluatedPredictionInput> = {}): EvaluatedPredictionInput {
  return {
    id: "prediction-1",
    event: "100 Freestyle",
    course: "LCM",
    targetRaceDate: "2026-03-01",
    predictionTimestamp: "2026-01-01T00:00:00.000Z",
    predictedTime: 60,
    lowerBound: 59,
    upperBound: 61,
    confidence: 72,
    modelVersion: "golden-v1",
    modelSource: "CONSERVATIVE_ENSEMBLE",
    dataSufficiency: "Moderate",
    athleteAge: 16,
    actualTime: 61,
    absoluteError: 1,
    signedError: 1,
    percentageError: 1.6393,
    withinInterval: true,
    achievedPb: true,
    achievedGoal: false,
    evaluatedAt: "2026-03-01T12:00:00.000Z",
    outOfDistribution: false,
    lastRaceBaseline: 62,
    lastThreeBaseline: 61.5,
    linearTrendBaseline: 60.5,
    ...overrides
  };
}

describe("prediction evaluation", () => {
  it("interpolates a fixed golden forecast without changing its curve", () => {
    expect(projectPredictionToDate(prediction, "2026-03-02")).toEqual({
      horizonDays: 60,
      predictedTime: 61,
      lowerBound: 60.5,
      upperBound: 61.5
    });
  });

  it("calculates signed, absolute, percentage, range, PB, and goal outcomes", () => {
    expect(calculatePredictionOutcome({
      actualTime: 61.2,
      predictedTime: 61,
      lowerBound: 60.7,
      upperBound: 61.3,
      priorPersonalBest: 61.5,
      goalTime: 61
    })).toEqual({
      actualTime: 61.2,
      absoluteError: 0.2,
      signedError: 0.2,
      percentageError: 0.3268,
      withinInterval: true,
      achievedPb: true,
      achievedGoal: false
    });
  });

  it("keeps fixed golden aggregate metrics and old model versions visible", () => {
    const dashboard = buildModelPerformanceDashboard([
      evaluated(),
      evaluated({ id: "prediction-2", modelVersion: "golden-v0", predictedTime: 59, actualTime: 58, signedError: -1 })
    ], 3);

    expect(dashboard.summary).toEqual({
      evaluatedPredictions: 2,
      pendingPredictions: 3,
      mae: 1,
      medianAbsoluteError: 1,
      rmse: 1,
      intervalCoverage: 100
    });
    expect(dashboard.byModelVersion.map((row) => row.label).sort()).toEqual(["golden-v0", "golden-v1"]);
    expect(dashboard.baselines.find((row) => row.label === "SwimSight")?.mae).toBe(1);
  });

  it("fails closed when the model artifact is missing required metadata or has corrupt trees", () => {
    expect(validateXgboostArtifact({ schemaVersion: 1, event: "100 Freestyle", models: {} })).toBe(false);
    expect(validateXgboostArtifact({
      schemaVersion: 1,
      version: "invalid-validated-model",
      event: "100 Freestyle",
      status: "VALIDATED",
      trainedAt: "2026-07-12T00:00:00.000Z",
      featureNames: ["latest_time"],
      models: {}
    })).toBe(false);
    expect(validateXgboostArtifact({
      schemaVersion: 1,
      version: "corrupt-tree",
      event: "100 Freestyle",
      status: "VALIDATED",
      trainedAt: "2026-07-12T00:00:00.000Z",
      featureNames: ["latest_time"],
      models: { LCM: { status: "VALIDATED", baseScore: 60, trees: [{ nodeid: 0, split: "latest_time" }], metrics: {} } }
    })).toBe(false);
  });
});
