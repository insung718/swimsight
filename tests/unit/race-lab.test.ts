import { describe, expect, it } from "vitest";
import {
  analyzeRaceShape,
  buildSegmentsFromCumulative,
  compareRaceSegments,
  estimateRaceSegments,
  generateGoalRace,
  getCourseLength,
  getSegmentCount,
  RaceLabValidationError,
  rebuildEditableGoal,
  simulateRace
} from "@/lib/race-lab";

describe("Race Lab split integrity", () => {
  it("builds pool-length segments without changing official precision", () => {
    const segments = buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "LCM",
      cumulativeTimes: [26.4, 55.2],
      source: "OFFICIAL",
      totalTime: 55.2
    });

    expect(segments).toHaveLength(2);
    expect(segments[1]).toMatchObject({ segmentTime: 28.8, cumulativeTime: 55.2, source: "OFFICIAL", precision: "HUNDREDTH" });
  });

  it("rejects missing, non-monotonic, and finish-mismatched splits", () => {
    expect(() => buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "SCM",
      cumulativeTimes: [12, 25],
      source: "MANUAL",
      totalTime: 52
    })).toThrow(/Expected 4/);

    expect(() => buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "LCM",
      cumulativeTimes: [27, 26],
      source: "MANUAL"
    })).toThrow(/strictly increasing/);

    expect(() => buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "LCM",
      cumulativeTimes: [27, 56],
      source: "MANUAL",
      totalTime: 55
    })).toThrow(/match the recorded finish time/);
  });

  it("labels generated segments as estimated and limits their stated precision", () => {
    const segments = estimateRaceSegments({ event: "200 Freestyle", course: "LCM", totalTime: 120 });
    expect(segments).toHaveLength(4);
    expect(segments.every((segment) => segment.source === "ESTIMATED" && segment.precision === "TENTH")).toBe(true);
    expect(segments.at(-1)?.cumulativeTime).toBeCloseTo(120, 2);
  });

  it("handles LCM, SCM, and SCY course lengths independently", () => {
    expect(getCourseLength("LCM")).toBe(50);
    expect(getCourseLength("SCM")).toBe(25);
    expect(getCourseLength("SCY")).toBe(25);
    expect(getSegmentCount("100 Freestyle", "LCM")).toBe(2);
    expect(getSegmentCount("100 Freestyle", "SCM")).toBe(4);
    expect(getSegmentCount("100 Freestyle", "SCY")).toBe(4);
  });

  it("compares segment and cumulative gain or loss", () => {
    const actual = buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "LCM",
      cumulativeTimes: [27, 56],
      source: "OFFICIAL"
    });
    const reference = buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "LCM",
      cumulativeTimes: [26.5, 55],
      source: "MANUAL"
    });
    expect(compareRaceSegments(actual, reference)[1]).toMatchObject({ segmentDelta: 0.5, cumulativeDelta: 1 });
  });
});

describe("Race Lab race-shape rules", () => {
  it("detects a fast start and late-race fade using documented thresholds", () => {
    const segments = buildSegmentsFromCumulative({
      event: "200 Freestyle",
      course: "LCM",
      cumulativeTimes: [25, 52, 79, 108.5],
      source: "OFFICIAL"
    });
    const shape = analyzeRaceShape(segments);
    expect(shape.patterns).toContain("Fast start");
    expect(shape.patterns).toContain("Late-race fade");
    expect(shape.primary).toBe("Late-race fade");
    expect(shape.strongestSegment).toBe(0);
    expect(shape.weakestSegment).toBe(3);
  });

  it("detects negative and even race shapes", () => {
    const negative = buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "LCM",
      cumulativeTimes: [29, 56],
      source: "OFFICIAL"
    });
    expect(analyzeRaceShape(negative).patterns).toContain("Negative split");

    const even = buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "LCM",
      cumulativeTimes: [28, 56.1],
      source: "OFFICIAL"
    });
    expect(analyzeRaceShape(even).patterns).toContain("Even pacing");
  });
});

describe("Race Lab deterministic simulation", () => {
  const base = buildSegmentsFromCumulative({
    event: "100 Freestyle",
    course: "LCM",
    cumulativeTimes: [27, 56],
    source: "OFFICIAL"
  });

  it("recalculates immediately from bounded settings and labels the result as a simulation", () => {
    const result = simulateRace({
      event: "100 Freestyle",
      course: "LCM",
      baseSegments: base,
      settings: {
        reactionTime: 0.65,
        firstSegmentAdjustment: -0.2,
        middleSegmentAdjustment: 0,
        finalSegmentAdjustment: -0.3,
        turnAdjustment: -0.1,
        underwaterEfficiency: 0.5
      }
    });
    expect(result.label).toBe("Simulation");
    expect(result.projectedTime).toBeLessThan(56);
    expect(result.segments.every((segment) => segment.source === "SIMULATED")).toBe(true);
  });

  it("rejects out-of-range controls and impossible segment outputs", () => {
    expect(() => simulateRace({
      event: "100 Freestyle",
      course: "LCM",
      baseSegments: base,
      settings: {
        reactionTime: 0.1,
        firstSegmentAdjustment: 0,
        middleSegmentAdjustment: 0,
        finalSegmentAdjustment: 0,
        turnAdjustment: 0,
        underwaterEfficiency: 0
      }
    })).toThrow(RaceLabValidationError);

    expect(() => simulateRace({
      event: "50 Freestyle",
      course: "LCM",
      baseSegments: buildSegmentsFromCumulative({
        event: "50 Freestyle",
        course: "LCM",
        cumulativeTimes: [18.1],
        source: "OFFICIAL"
      }),
      settings: {
        reactionTime: 0.45,
        firstSegmentAdjustment: -2,
        middleSegmentAdjustment: 0,
        finalSegmentAdjustment: 0,
        turnAdjustment: 0,
        underwaterEfficiency: 0
      }
    })).toThrow(/plausibility/);
  });
});

describe("Race Lab goal-race generation", () => {
  it("uses historical shape and preserves the exact editable goal total", () => {
    const history = buildSegmentsFromCumulative({
      event: "200 Freestyle",
      course: "LCM",
      cumulativeTimes: [28, 58, 89, 121],
      source: "OFFICIAL"
    });
    const goal = generateGoalRace({
      event: "200 Freestyle",
      course: "LCM",
      targetTime: 116,
      strategy: "BALANCED",
      historicalShapes: [history]
    });
    expect(goal.usedHistoricalShape).toBe(true);
    expect(goal.segments.at(-1)?.cumulativeTime).toBeCloseTo(116, 2);
    expect(goal.segments.every((segment) => segment.source === "SIMULATED" && segment.precision === "TENTH")).toBe(true);

    const edited = rebuildEditableGoal({
      event: "200 Freestyle",
      course: "LCM",
      targetTime: 116,
      segmentTimes: [27, 29, 30, 30]
    });
    expect(edited.at(-1)?.cumulativeTime).toBe(116);
  });

  it("gives the best recent valid race modest extra influence", () => {
    const bestRecent = buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "LCM",
      cumulativeTimes: [26, 56],
      source: "OFFICIAL"
    });
    const otherRecent = buildSegmentsFromCumulative({
      event: "100 Freestyle",
      course: "LCM",
      cumulativeTimes: [29, 58],
      source: "OFFICIAL"
    });
    const bestWeighted = generateGoalRace({
      event: "100 Freestyle",
      course: "LCM",
      targetTime: 55,
      strategy: "BALANCED",
      historicalShapes: [bestRecent, otherRecent]
    });
    const otherWeighted = generateGoalRace({
      event: "100 Freestyle",
      course: "LCM",
      targetTime: 55,
      strategy: "BALANCED",
      historicalShapes: [otherRecent, bestRecent]
    });

    expect(bestWeighted.segments[0].segmentTime).toBeLessThan(otherWeighted.segments[0].segmentTime);
    expect(bestWeighted.segments.at(-1)?.cumulativeTime).toBe(55);
  });

  it("rejects a goal whose editable segments do not match its finish time", () => {
    expect(() => rebuildEditableGoal({
      event: "100 Freestyle",
      course: "LCM",
      targetTime: 55,
      segmentTimes: [27, 29]
    })).toThrow(/add up/);
  });
});
