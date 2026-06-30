import { describe, expect, it } from "vitest";
import {
  buildDashboardAnalytics,
  calculateConsistencyScore,
  calculateGoalProjection,
  detectTrend,
  getPersonalBests,
  linearRegression,
  predictEvent
} from "@/lib/analytics";
import { trainedPredictionModel } from "@/lib/trained-prediction-model";
import type { GymWorkout, SwimResult } from "@/types/swim";
import { sampleGoals, sampleSwims } from "../fixtures/sample-data";

describe("analytics engine", () => {
  it("calculates personal best improvements by event", () => {
    const personalBests = getPersonalBests(sampleSwims);
    const fly = personalBests.find((pb) => pb.event === "100 Butterfly");

    expect(fly).toBeDefined();
    expect(fly?.currentPb).toBe(63.8);
    expect(fly?.previousPb).toBe(65.75);
    expect(fly?.improvementPercent).toBeCloseTo(2.97, 1);
  });

  it("detects improving trends when regression slope is negative", () => {
    const flySwims = sampleSwims.filter((swim) => swim.event === "100 Butterfly");

    expect(detectTrend(flySwims)).toBe("Improving");
  });

  it("returns high consistency for tightly clustered swims", () => {
    const backstroke = sampleSwims.filter((swim) => swim.event === "100 Backstroke");

    expect(calculateConsistencyScore(backstroke)).toBeGreaterThan(90);
  });

  it("projects goal pace and likelihood", () => {
    const projection = calculateGoalProjection(sampleSwims, sampleGoals[0]);

    expect(projection.event).toBe("100 Butterfly");
    expect(projection.requiredMonthlyImprovement).toBeGreaterThan(0);
    expect(["High", "Medium", "Low"]).toContain(projection.likelihood);
  });

  it("builds a complete dashboard analytics payload", () => {
    const analytics = buildDashboardAnalytics(sampleSwims, sampleGoals[0]);

    expect(analytics.overview.totalSwims).toBe(sampleSwims.length);
    expect(analytics.strongestEvents).toHaveLength(3);
    expect(analytics.weakestEvents).toHaveLength(3);
    expect(analytics.predictions.length).toBeGreaterThan(3);
    expect(analytics.swimPowerIndex.score).toBeGreaterThan(0);
  });

  it("keeps training times out of official PBs and predictions", () => {
    const mixedResults: SwimResult[] = [
      { id: "official-1", userId: "u1", date: "2026-01-01", event: "50 Freestyle", course: "LCM", timeSeconds: 26.4, meetName: "City Meet", resultKind: "OFFICIAL" },
      { id: "training-1", userId: "u1", date: "2026-01-10", event: "50 Freestyle", course: "LCM", timeSeconds: 24.1, meetName: "Practice set", resultKind: "TRAINING" }
    ];
    const analytics = buildDashboardAnalytics(mixedResults);

    expect(analytics.overview.totalSwims).toBe(2);
    expect(analytics.personalBests[0].currentPb).toBe(26.4);
    expect(analytics.predictions[0].currentTime).toBe(26.4);
  });

  it("keeps a new account genuinely empty", () => {
    const analytics = buildDashboardAnalytics([]);

    expect(analytics.overview.totalSwims).toBe(0);
    expect(analytics.overview.bestEvent).toBeUndefined();
    expect(analytics.personalBests).toEqual([]);
    expect(analytics.predictions).toEqual([]);
    expect(analytics.goalProjection).toBeUndefined();
    expect(analytics.trainingLoad.label).toBe("No gym data");
  });

  it("does not classify a fast national-level single result as beginner", () => {
    const analytics = buildDashboardAnalytics([
      { id: "fast-1", userId: "u1", date: "2026-06-01", event: "50 Freestyle", course: "LCM", timeSeconds: 25.56, meetName: "National Meet", resultKind: "OFFICIAL" }
    ]);

    expect(analytics.rankings[0].performanceScore).toBeGreaterThan(90);
    expect(analytics.swimPowerIndex.score).toBeGreaterThanOrEqual(56);
    expect(analytics.swimPowerIndex.level).toBe("Competitive");
  });

  it("uses gym training load as a conservative prediction signal", () => {
    const workouts: GymWorkout[] = [
      { id: "gym-1", userId: "user-1", date: "2026-04-01", workoutType: "STRENGTH", durationMinutes: 45, intensity: 6, focus: "Pull strength", notes: null, trainingLoad: 270 },
      { id: "gym-2", userId: "user-1", date: "2026-04-08", workoutType: "CORE", durationMinutes: 35, intensity: 6, focus: "Core", notes: null, trainingLoad: 210 },
      { id: "gym-3", userId: "user-1", date: "2026-04-15", workoutType: "DRYLAND", durationMinutes: 40, intensity: 7, focus: "Starts", notes: null, trainingLoad: 280 },
      { id: "gym-4", userId: "user-1", date: "2026-04-22", workoutType: "STRENGTH", durationMinutes: 42, intensity: 6, focus: "Posterior chain", notes: null, trainingLoad: 252 }
    ];

    const analytics = buildDashboardAnalytics(sampleSwims, sampleGoals[0], workouts);
    const prediction = analytics.predictions.find((item) => item.event === "100 Butterfly");

    expect(analytics.trainingLoad.label).toBe("Strength supported");
    expect(prediction?.trainingImpact.sessionsLast28Days).toBe(4);
    expect(prediction?.trainingImpact.adjustmentMultiplier).toBeGreaterThan(1);
  });

  it("creates a low-confidence baseline prediction from the first event result", () => {
    const analytics = buildDashboardAnalytics([sampleSwims[0]]);

    expect(analytics.predictions).toHaveLength(1);
    expect(analytics.predictions[0].event).toBe(sampleSwims[0].event);
    expect(analytics.predictions[0].confidence).toBe(43);
    expect(analytics.predictions[0].predictedTimes.days365).toBeLessThan(sampleSwims[0].timeSeconds);
    expect(sampleSwims[0].timeSeconds - analytics.predictions[0].predictedTimes.days365).toBeLessThan(0.25);
  });

  it("caps aggressive forecasts so predictions stay realistic", () => {
    const extremeDrop: SwimResult[] = [
      { id: "s1", userId: "u1", date: "2026-01-01", event: "100 Butterfly", course: "LCM", timeSeconds: 70, meetName: "Meet A" },
      { id: "s2", userId: "u1", date: "2026-01-08", event: "100 Butterfly", course: "LCM", timeSeconds: 60, meetName: "Meet B" }
    ];
    const prediction = predictEvent(extremeDrop);

    expect(prediction.predictedTimes.days365).toBeGreaterThanOrEqual(60 * 0.86);
    expect(prediction.confidence).toBeLessThan(60);
  });

  it("does not forecast below elite record floors", () => {
    const nearRecord: SwimResult[] = [
      { id: "s1", userId: "u1", date: "2026-01-01", event: "50 Freestyle", course: "LCM", timeSeconds: 22.2, meetName: "Meet A" },
      { id: "s2", userId: "u1", date: "2026-01-08", event: "50 Freestyle", course: "LCM", timeSeconds: 21.2, meetName: "Meet B" }
    ];
    const prediction = predictEvent(nearRecord);

    expect(prediction.predictedTimes.days365).toBeGreaterThanOrEqual(20.91);
  });

  it("uses trained event-course priors to cap aggressive annual improvement", () => {
    const fastDrop: SwimResult[] = [
      { id: "s1", userId: "u1", date: "2026-01-01", event: "50 Freestyle", course: "SCM", timeSeconds: 30, meetName: "Meet A" },
      { id: "s2", userId: "u1", date: "2026-01-08", event: "50 Freestyle", course: "SCM", timeSeconds: 26, meetName: "Meet B" }
    ];
    const prediction = predictEvent(fastDrop);
    const trainedCap = trainedPredictionModel.priors["50 Freestyle__SCM"].annualImprovementCap;

    expect(prediction.predictedTimes.days365).toBeGreaterThanOrEqual(26 * (1 - trainedCap));
  });

  it("keeps predictions separate by course", () => {
    const mixedCourse: SwimResult[] = [
      { id: "s1", userId: "u1", date: "2026-01-01", event: "100 Butterfly", course: "LCM", timeSeconds: 63, meetName: "LCM A" },
      { id: "s2", userId: "u1", date: "2026-02-01", event: "100 Butterfly", course: "LCM", timeSeconds: 62, meetName: "LCM B" },
      { id: "s3", userId: "u1", date: "2026-01-01", event: "100 Butterfly", course: "SCY", timeSeconds: 55, meetName: "SCY A" },
      { id: "s4", userId: "u1", date: "2026-02-01", event: "100 Butterfly", course: "SCY", timeSeconds: 54, meetName: "SCY B" }
    ];
    const analytics = buildDashboardAnalytics(mixedCourse);

    expect(analytics.predictions.map((prediction) => prediction.course).sort()).toEqual(["LCM", "SCY"]);
  });

  it("does not crash when a goal exists before results for that event", () => {
    const analytics = buildDashboardAnalytics(sampleSwims, {
      ...sampleGoals[0],
      event: "200 Breaststroke"
    });

    expect(analytics.goalProjection).toBeUndefined();
  });

  it("fits a simple regression line", () => {
    const regression = linearRegression([
      { x: 0, y: 10 },
      { x: 1, y: 8 },
      { x: 2, y: 6 }
    ]);

    expect(regression.slope).toBe(-2);
    expect(regression.intercept).toBe(10);
  });
});
