import { describe, expect, it } from "vitest";
import {
  assessPredictionDataQuality,
  buildActionablePredictionInsights,
  calculateDriftReport,
  evaluateReleaseCandidate,
  validateTemporalFold,
  type ReleaseMetrics,
  type SubgroupReleaseMetrics
} from "@/lib/prediction-governance";
import type { SwimResult } from "@/types/swim";

function race(index: number, overrides: Partial<SwimResult> = {}): SwimResult {
  return {
    id: `race-${index}`,
    userId: "athlete-1",
    date: `2026-0${Math.min(index, 6)}-01`,
    event: "100 Freestyle",
    course: "LCM",
    timeSeconds: 62 - index * 0.2,
    meetName: `Meet ${index}`,
    resultKind: "OFFICIAL",
    raceType: "INDIVIDUAL",
    ...overrides
  };
}

const profile = { age: 16, sex: "MALE" as const, taperDays: 7, swimSessionsPerWeek: 6 };

function metrics(overrides: Partial<ReleaseMetrics> = {}): ReleaseMetrics {
  return {
    mae: 1,
    medianAbsoluteError: 0.8,
    rmse: 1.3,
    brierScore: 0.18,
    calibrationError: 0.06,
    intervalCoverage: 0.8,
    sampleSize: 200,
    ...overrides
  };
}

const baselines = {
  "last-race": metrics({ mae: 1.4 }),
  "last-three": metrics({ mae: 1.35 }),
  "linear-trend": metrics({ mae: 1.3 }),
  "conservative-deterministic": metrics({ mae: 1.25 })
};

function releaseSubgroups(overrides: Partial<Record<SubgroupReleaseMetrics["dimension"], Partial<ReleaseMetrics>>> = {}) {
  const groups: { dimension: SubgroupReleaseMetrics["dimension"]; key: string }[] = [
    { dimension: "event", key: "100_FREESTYLE" },
    { dimension: "ageBand", key: "13_14" },
    { dimension: "category", key: "MALE" },
    { dimension: "course", key: "LCM" },
    { dimension: "horizon", key: "31_90_DAYS" }
  ];
  return groups.map(({ dimension, key }) => ({ key, dimension, ...metrics({ sampleSize: 40, ...overrides[dimension] }) }));
}

describe("prediction data quality", () => {
  it("allows a full prediction only with recent direct official evidence", () => {
    const assessment = assessPredictionDataQuality({
      swims: Array.from({ length: 6 }, (_, index) => race(index + 1)),
      event: "100 Freestyle",
      course: "LCM",
      profile,
      now: "2026-07-01"
    });
    expect(assessment.decision).toBe("FULL_PREDICTION");
    expect(assessment.eligibleRaceCount).toBe(6);
    expect(assessment.score).toBeGreaterThanOrEqual(75);
  });

  it("withholds predictions for manipulated future dates", () => {
    const assessment = assessPredictionDataQuality({
      swims: [race(1), race(2, { date: "2027-01-01" })],
      event: "100 Freestyle",
      course: "LCM",
      profile,
      now: "2026-07-01"
    });
    expect(assessment.decision).toBe("NO_PREDICTION");
    expect(assessment.reasons.map((reason) => reason.code)).toContain("FUTURE_DATED_RESULT");
  });

  it("flags duplicate identity and converted-time dependence deterministically", () => {
    const duplicate = race(3, { id: "duplicate", date: "2026-02-01", timeSeconds: race(2).timeSeconds });
    const assessment = assessPredictionDataQuality({
      swims: [race(1), race(2), duplicate, race(4, { raceType: "CONVERTED" })],
      event: "100 Freestyle",
      course: "LCM",
      profile,
      now: "2026-07-01"
    });
    const codes = assessment.reasons.map((reason) => reason.code);
    expect(codes).toContain("DUPLICATE_IDENTITY_RISK");
    expect(codes).toContain("CONVERSION_DEPENDENCE");
  });

  it("keeps actionable statements separated by evidence class", () => {
    const insights = buildActionablePredictionInsights(Array.from({ length: 6 }, (_, index) => race(index + 1)), profile);
    expect(insights.observed.length).toBeGreaterThan(0);
    expect(insights.userReported).toContain("Reported taper duration: 7 days.");
    expect(insights.notMeasurable.join(" ")).toMatch(/cannot identify a specific training intervention/i);
  });
});

describe("temporal leakage controls", () => {
  it("accepts rolling-origin folds whose features and labels predate validation", () => {
    const result = validateTemporalFold({
      trainingTargetDates: ["2025-01-01", "2025-06-01"],
      validationTargetDates: ["2026-01-01"],
      examples: [{ targetDate: "2026-01-01", featureAsOf: "2025-12-01", targetAthleteId: "a", historyAthleteIds: ["a", "a"] }]
    });
    expect(result.passed).toBe(true);
  });

  it("rejects overlapping cutoffs, future metadata, and foreign athlete history", () => {
    const result = validateTemporalFold({
      trainingTargetDates: ["2026-02-01"],
      validationTargetDates: ["2026-01-01"],
      examples: [{ targetDate: "2026-01-01", featureAsOf: "2026-01-02", targetAthleteId: "a", historyAthleteIds: ["a", "b"] }]
    });
    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      "TRAINING_VALIDATION_DATE_OVERLAP",
      "FEATURE_TIMESTAMP_NOT_BEFORE_TARGET",
      "ATHLETE_HISTORY_LEAKAGE"
    ]));
  });
});

describe("champion-challenger release gates", () => {
  it("passes a sufficiently evaluated challenger that beats champion and every baseline", () => {
    const decision = evaluateReleaseCandidate({
      baselines,
      champion: { modelVersion: "champion", metrics: metrics(), subgroups: releaseSubgroups() },
      candidate: { modelVersion: "challenger", metrics: metrics({ mae: 0.9, medianAbsoluteError: 0.7, rmse: 1.1, brierScore: 0.15, calibrationError: 0.04, intervalCoverage: 0.82 }), subgroups: releaseSubgroups({ ageBand: { mae: 0.9 } }) }
    });
    expect(decision.passed).toBe(true);
  });

  it("rejects aggregate gains that hide a material subgroup regression", () => {
    const decision = evaluateReleaseCandidate({
      baselines,
      champion: { modelVersion: "champion", metrics: metrics(), subgroups: releaseSubgroups() },
      candidate: { modelVersion: "challenger", metrics: metrics({ mae: 0.9, medianAbsoluteError: 0.7, rmse: 1.1, brierScore: 0.15, calibrationError: 0.04, intervalCoverage: 0.82 }), subgroups: releaseSubgroups({ ageBand: { mae: 1.2 } }) }
    });
    expect(decision.passed).toBe(false);
    expect(decision.reasons.join(" ")).toContain("subgroup-ageBand:13_14");
  });

  it("fails closed when champion or challenger cohorts are tiny", () => {
    const decision = evaluateReleaseCandidate({
      baselines,
      champion: { modelVersion: "champion", metrics: metrics({ sampleSize: 0 }), subgroups: [] },
      candidate: { modelVersion: "challenger", metrics: metrics({ sampleSize: 12 }), subgroups: [] }
    });
    expect(decision.passed).toBe(false);
    expect(decision.reasons.join(" ")).toMatch(/minimum-sample|champion-minimum-sample/);
  });

  it("fails closed when required subgroup evidence is omitted", () => {
    const decision = evaluateReleaseCandidate({
      baselines,
      champion: { modelVersion: "champion", metrics: metrics(), subgroups: releaseSubgroups() },
      candidate: { modelVersion: "challenger", metrics: metrics({ mae: 0.9 }), subgroups: [] }
    });
    expect(decision.passed).toBe(false);
    expect(decision.reasons.join(" ")).toContain("candidate-subgroup-coverage-ageBand");
  });
});

describe("production drift", () => {
  it("suppresses alerts for tiny cohorts", () => {
    const report = calculateDriftReport([], [], 30);
    expect(report.status).toBe("INSUFFICIENT_DATA");
    expect(report.recommendation).toMatch(/Do not trigger retraining/);
  });

  it("returns evidence instead of automatically retraining on material drift", () => {
    const baseline = Array.from({ length: 40 }, (_, index) => ({
      predictedTime: 60 + index * 0.01,
      actualTime: 60.2 + index * 0.01,
      withinInterval: true,
      probability: 70,
      outcome: true,
      features: { latestTime: 60 + index * 0.01 }
    }));
    const recent = Array.from({ length: 40 }, (_, index) => ({
      predictedTime: 68 + index * 0.01,
      actualTime: 75 + index * 0.01,
      withinInterval: false,
      probability: 90,
      outcome: false,
      features: { latestTime: 70 + index * 0.01 }
    }));
    const report = calculateDriftReport(baseline, recent, 30);
    expect(["WARNING", "CRITICAL"]).toContain(report.status);
    expect(report.evidence.length).toBeGreaterThan(0);
    expect(report.recommendation).toMatch(/Do not promote automatically/);
  });
});
