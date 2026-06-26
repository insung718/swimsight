import { describe, expect, it } from "vitest";
import {
  buildDashboardAnalytics,
  calculateConsistencyScore,
  calculateGoalProjection,
  detectTrend,
  getPersonalBests,
  linearRegression
} from "@/lib/analytics";
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

  it("keeps a new account genuinely empty", () => {
    const analytics = buildDashboardAnalytics([]);

    expect(analytics.overview.totalSwims).toBe(0);
    expect(analytics.overview.bestEvent).toBeUndefined();
    expect(analytics.personalBests).toEqual([]);
    expect(analytics.predictions).toEqual([]);
    expect(analytics.goalProjection).toBeUndefined();
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
