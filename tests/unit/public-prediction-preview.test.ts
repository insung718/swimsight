import { describe, expect, it } from "vitest";
import {
  buildPublicPredictionPreview,
  isValidPublicPredictionSeed,
  minimumPublicPredictionTime,
  publicPredictionSeedTtlMs,
  type PublicPredictionSeed
} from "@/lib/public-prediction-preview";

function seed(overrides: Partial<PublicPredictionSeed> = {}): PublicPredictionSeed {
  return {
    course: "LCM",
    currentTime: 25.56,
    sessionsPerWeek: 5,
    createdAt: Date.now(),
    ...overrides
  };
}

describe("public 50 Free prediction preview", () => {
  it("creates a conservative range without crossing the course floor", () => {
    const preview = buildPublicPredictionPreview(seed());

    expect(preview.estimate).toBeLessThan(25.56);
    expect(preview.lowerBound).toBeGreaterThanOrEqual(minimumPublicPredictionTime("LCM"));
    expect(preview.lowerBound).toBeLessThanOrEqual(preview.estimate);
    expect(preview.upperBound).toBeGreaterThanOrEqual(preview.estimate);
    expect(preview.upperBound).toBeLessThanOrEqual(preview.currentTime);
  });

  it("uses training frequency as a bounded directional signal", () => {
    const twoSessions = buildPublicPredictionPreview(seed({ sessionsPerWeek: 2 }));
    const sevenSessions = buildPublicPredictionPreview(seed({ sessionsPerWeek: 7 }));

    expect(sevenSessions.estimate).toBeLessThan(twoSessions.estimate);
    expect(sevenSessions.improvementPercent).toBeGreaterThan(twoSessions.improvementPercent);
  });

  it("does not project a near-record swim below the record buffer", () => {
    const preview = buildPublicPredictionPreview(seed({ currentTime: 21.05, sessionsPerWeek: 14 }));

    expect(preview.estimate).toBeGreaterThanOrEqual(20.91);
    expect(preview.lowerBound).toBeGreaterThanOrEqual(20.91);
  });

  it("rejects expired, malformed, and impossible inputs", () => {
    const now = Date.now();

    expect(isValidPublicPredictionSeed(seed({ createdAt: now - publicPredictionSeedTtlMs - 1 }), now)).toBe(false);
    expect(isValidPublicPredictionSeed(seed({ currentTime: 19.5 }), now)).toBe(false);
    expect(isValidPublicPredictionSeed(seed({ sessionsPerWeek: 15 }), now)).toBe(false);
    expect(isValidPublicPredictionSeed({ ...seed(), course: "POOL" }, now)).toBe(false);
  });
});
