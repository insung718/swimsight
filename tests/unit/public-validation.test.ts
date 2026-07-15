import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const prismaMock = vi.hoisted(() => ({
  modelRegistryEntry: { findMany: vi.fn() },
  predictionSnapshot: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  researchCohortManifest: { findMany: vi.fn() }
}));
const hasDatabaseConfig = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/prisma", () => ({ hasDatabaseConfig, prisma: prismaMock }));

import { getPublicValidationStatus } from "@/lib/services/public-validation-service";

function evaluatedRow(index: number, sourceBacked = true) {
  return {
    userId: `athlete-${index}`,
    modelVersion: "candidate-v1",
    absoluteError: 0.5,
    withinInterval: true,
    pbProbability: 60,
    achievedPb: index % 2 === 0,
    lastRaceBaseline: 57,
    lastThreeBaseline: 56.8,
    linearTrendBaseline: 56.5,
    conservativeBaseline: 56.6,
    actualTime: 56.4,
    evaluatedAt: new Date(Date.UTC(2026, 0, index + 1)),
    actualResult: sourceBacked
      ? {
          importRowId: `row-${index}`,
          originalRowHash: `hash-${index}`,
          externalMeetId: `meet-${index}`,
          externalResultId: `result-${index}`,
          source: "CSV_IMPORT"
        }
      : { importRowId: null, originalRowHash: null, externalMeetId: null, externalResultId: null, source: "MANUAL" }
  };
}

describe("public validation disclosure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasDatabaseConfig.mockReturnValue(true);
    prismaMock.modelRegistryEntry.findMany.mockResolvedValue([]);
    prismaMock.predictionSnapshot.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.researchCohortManifest.findMany.mockResolvedValue([]);
  });

  it("fails safely to an untrained, suppressed status when the database is not configured", async () => {
    hasDatabaseConfig.mockReturnValueOnce(false);

    const status = await getPublicValidationStatus();

    expect(status.productionStatus).toBe("UNTRAINED");
    expect(status.metrics).toBeNull();
    expect(status.cohort.evaluatedPredictions).toBe(0);
    expect(prismaMock.predictionSnapshot.findMany).not.toHaveBeenCalled();
  });

  it("reports UNTRAINED and suppresses metrics when evidence is too small", async () => {
    prismaMock.predictionSnapshot.findMany.mockResolvedValueOnce([evaluatedRow(1)]);
    const status = await getPublicValidationStatus();
    expect(status.productionStatus).toBe("UNTRAINED");
    expect(status.metrics).toBeNull();
    expect(status.metricSuppression).toMatch(/at least 30 evaluated predictions/i);
    expect(status.cohort.evaluatedAthletes).toMatchObject({ suppressed: true, count: null });
  });

  it("excludes self-declared outcomes from public scoring", async () => {
    prismaMock.predictionSnapshot.findMany.mockResolvedValueOnce([
      evaluatedRow(1, true),
      evaluatedRow(2, false)
    ]);
    const status = await getPublicValidationStatus();
    expect(status.cohort.evaluatedPredictions).toBe(1);
    expect(status.cohort.excludedSelfDeclaredEvaluations).toBe(1);
  });

  it("publishes aggregate metrics only after both sample thresholds are met", async () => {
    const rows = Array.from({ length: 30 }, (_, index) => evaluatedRow(index));
    prismaMock.predictionSnapshot.findMany.mockResolvedValueOnce(rows);
    prismaMock.user.findMany.mockResolvedValueOnce(Array.from({ length: 25 }, (_, index) => ({
      id: `athlete-${index}`,
      swims: [{ id: `result-${index}` }]
    })));
    const status = await getPublicValidationStatus();
    expect(status.metrics).toMatchObject({ mae: 0.5, medianAbsoluteError: 0.5, intervalCoverage: 100 });
    expect(status.cohort.evaluatedAthletes).toMatchObject({ suppressed: false, count: 30 });
  });

  it("does not call an ML model promoted unless its dataset is a sealed cohort version", async () => {
    prismaMock.modelRegistryEntry.findMany.mockResolvedValueOnce([{
      modelVersion: "xgboost-100-free-v1",
      event: "ONE_HUNDRED_FREESTYLE",
      course: "LCM",
      datasetVersion: "cohort-unsealed",
      sampleSize: 100,
      metrics: {},
      createdAt: new Date()
    }]);
    prismaMock.researchCohortManifest.findMany.mockResolvedValueOnce([{ version: "another-sealed-cohort" }]);
    const status = await getPublicValidationStatus();
    expect(status.productionStatus).toBe("UNTRAINED");
    expect(status.currentBehavior).toMatch(/Conservative deterministic forecasts/);
  });
});
