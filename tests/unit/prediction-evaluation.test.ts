import { describe, expect, it } from "vitest";
import {
  buildModelPerformanceDashboard,
  calculatePredictionOutcome,
  projectPredictionToDate,
  type EvaluatedPredictionInput
} from "@/lib/prediction-evaluation";
import { releaseMatchesArtifact, validateXgboostArtifact } from "@/lib/xgboost-runtime";
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
  explanations: {
    days30: { method: "DETERMINISTIC_DECOMPOSITION", baseTime: 62, predictedTime: 61.5, contributions: [{ label: "Recent trend", secondsImpact: -0.5, direction: "faster", detail: "Test" }], additiveResidual: 0, disclaimer: "Test" },
    days90: { method: "DETERMINISTIC_DECOMPOSITION", baseTime: 62, predictedTime: 60.5, contributions: [{ label: "Recent trend", secondsImpact: -1.5, direction: "faster", detail: "Test" }], additiveResidual: 0, disclaimer: "Test" },
    days180: { method: "DETERMINISTIC_DECOMPOSITION", baseTime: 62, predictedTime: 59.8, contributions: [{ label: "Recent trend", secondsImpact: -2.2, direction: "faster", detail: "Test" }], additiveResidual: 0, disclaimer: "Test" },
    days365: { method: "DETERMINISTIC_DECOMPOSITION", baseTime: 62, predictedTime: 58.9, contributions: [{ label: "Recent trend", secondsImpact: -3.1, direction: "faster", detail: "Test" }], additiveResidual: 0, disclaimer: "Test" }
  },
  probabilities: {
    days30: { pb: { thresholdTime: 62, probability: 80, method: "ESTIMATED_RANGE", calibration: "Provisional" } },
    days90: { pb: { thresholdTime: 62, probability: 90, method: "ESTIMATED_RANGE", calibration: "Provisional" } },
    days180: { pb: { thresholdTime: 62, probability: 94, method: "ESTIMATED_RANGE", calibration: "Provisional" } },
    days365: { pb: { thresholdTime: 62, probability: 97, method: "ESTIMATED_RANGE", calibration: "Provisional" } }
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
    sufficiencyChecklist: [],
    dataQuality: {
      version: "prediction-quality-v3.0.0",
      score: 70,
      level: "Moderate",
      decision: "CONSERVATIVE_ESTIMATE",
      eligibleRaceCount: 4,
      reasons: [],
      userExplanation: "A conservative estimate is shown."
    }
  },
  trainingImpact: { label: "No gym data", adjustmentMultiplier: 1, weeklyLoad: 0, sessionsLast28Days: 0 },
  actionableInsights: { observed: [], inferred: [], userReported: [], notMeasurable: [] }
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
    const projection = projectPredictionToDate(prediction, "2026-03-02");
    expect(projection).toMatchObject({
      horizonDays: 60,
      predictedTime: 61,
      lowerBound: 60.5,
      upperBound: 61.5
    });
    if (!projection) throw new Error("Expected a forecast projection.");
    expect(projection.explanation.predictedTime).toBe(61);
    expect(projection.explanation.baseTime + projection.explanation.contributions.reduce((sum, item) => sum + item.secondsImpact, 0) + projection.explanation.additiveResidual).toBeCloseTo(61, 4);
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
      achievedGoal: false,
      achievedQualification: null
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
      intervalCoverage: 100,
      probabilityEvaluations: 0,
      probabilityBrierScore: 0,
      probabilityCalibrationError: 0
    });
    expect(dashboard.byModelVersion.map((row) => row.label).sort()).toEqual(["golden-v0", "golden-v1"]);
    expect(dashboard.baselines.find((row) => row.label === "SwimSight")?.mae).toBe(1);
  });

  it("tracks probability calibration without mixing missing legacy probabilities", () => {
    const dashboard = buildModelPerformanceDashboard([
      evaluated({ pbProbability: 80, achievedPb: true, goalProbability: 30, achievedGoal: false }),
      evaluated({ id: "prediction-2", pbProbability: 60, achievedPb: false, goalProbability: null, achievedGoal: null })
    ], 0);

    expect(dashboard.summary.probabilityEvaluations).toBe(3);
    expect(dashboard.probabilityCalibration.find((row) => row.label === "PB")?.count).toBe(2);
    expect(dashboard.probabilityCalibration.find((row) => row.label === "Goal")?.count).toBe(1);
    expect(dashboard.summary.probabilityBrierScore).toBeGreaterThan(0);
  });

  it("fails closed when the model artifact is missing required metadata or has corrupt trees", () => {
    expect(validateXgboostArtifact({ schemaVersion: 1, event: "100 Freestyle", models: {} })).toBe(false);
    expect(validateXgboostArtifact({
      schemaVersion: 1,
      version: "invalid-validated-model",
      event: "100 Freestyle",
      status: "VALIDATED",
      trainedAt: "2026-07-12T00:00:00.000Z",
      featureSchemaVersion: "100-free-history20-v2",
      trainingCodeVersion: "git-test",
      evaluationVersion: "rolling-origin-v3",
      trainingDataFingerprint: "a".repeat(64),
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

  it("requires the approved champion version and immutable artifact hash to match", () => {
    const identity = { modelVersion: "model-v2", artifactHash: "abc123" };
    expect(releaseMatchesArtifact(undefined, identity)).toBe(false);
    expect(releaseMatchesArtifact({ modelVersion: "model-v2", artifactHash: "wrong" }, identity)).toBe(false);
    expect(releaseMatchesArtifact({ modelVersion: "model-v1", artifactHash: "abc123" }, identity)).toBe(false);
    expect(releaseMatchesArtifact(identity, identity)).toBe(true);
  });

  it("accepts a complete version-two model artifact with cover statistics", () => {
    expect(validateXgboostArtifact({
      schemaVersion: 2,
      version: "golden-tree-v2",
      event: "100 Freestyle",
      status: "VALIDATED",
      trainedAt: "2026-07-12T00:00:00.000Z",
      featureSchemaVersion: "100-free-history20-v2",
      trainingCodeVersion: "git-test",
      evaluationVersion: "rolling-origin-v3",
      trainingDataFingerprint: "a".repeat(64),
      featureNames: ["latest_time"],
      models: {
        LCM: {
          status: "VALIDATED",
          baseScore: 60,
          trees: [{
            nodeid: 0,
            cover: 10,
            split: "latest_time",
            splitCondition: 60,
            yes: 1,
            no: 2,
            missing: 1,
            children: [{ nodeid: 1, cover: 5, leaf: -1 }, { nodeid: 2, cover: 5, leaf: 1 }]
          }],
          metrics: {
            rollingMae: 0.8,
            newAthleteMae: 1,
            bestBaselineMae: 1.1,
            residualP80: 1.2,
            residualQuantiles: [{ probability: 0.1, residual: -1 }, { probability: 0.9, residual: 1 }],
            trainingRows: 200,
            athleteCount: 30,
            foldCount: 5
          }
        }
      }
    })).toBe(true);
  });
});
