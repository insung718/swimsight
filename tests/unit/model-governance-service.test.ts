import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReleaseMetrics, SubgroupReleaseMetrics } from "@/lib/prediction-governance";

vi.mock("server-only", () => ({}));

const transaction = vi.hoisted(() => ({
  modelRegistryEntry: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn()
  },
  modelReleaseDecision: { create: vi.fn() }
}));
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction))
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { evaluateModelChallenger } from "@/lib/services/model-governance-service";

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

const requiredBaselines = {
  "last-race": metrics({ mae: 1.4 }),
  "last-three": metrics({ mae: 1.35 }),
  "linear-trend": metrics({ mae: 1.3 }),
  "conservative-deterministic": metrics({ mae: 1.25 })
};

function releaseSubgroups(ageBandMae = 1): SubgroupReleaseMetrics[] {
  return [
    { key: "100_FREESTYLE", dimension: "event", ...metrics({ sampleSize: 40 }) },
    { key: "13_14", dimension: "ageBand", ...metrics({ mae: ageBandMae, sampleSize: 40 }) },
    { key: "MALE", dimension: "category", ...metrics({ sampleSize: 40 }) },
    { key: "LCM", dimension: "course", ...metrics({ sampleSize: 40 }) },
    { key: "31_90_DAYS", dimension: "horizon", ...metrics({ sampleSize: 40 }) }
  ];
}

function registry(id: string, modelVersion: string, modelMetrics: ReleaseMetrics, subgroupMetrics: unknown[] = []) {
  return {
    id,
    modelVersion,
    event: "ONE_HUNDRED_FREESTYLE",
    course: "LCM",
    status: id === "champion" ? "CHAMPION" : "CHALLENGER",
    metrics: modelMetrics,
    subgroupMetrics,
    createdAt: new Date()
  };
}

describe("model promotion audit behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MODEL_GOVERNANCE_AUDIT_SECRET = "model-audit-secret-that-is-more-than-thirty-two-characters";
    transaction.modelRegistryEntry.update.mockResolvedValue({});
    transaction.modelReleaseDecision.create.mockResolvedValue({});
  });

  it("does not promote a passing challenger until an operator explicitly requests it", async () => {
    transaction.modelRegistryEntry.findUnique.mockResolvedValueOnce(registry("challenger", "v2", metrics({ mae: 0.9, medianAbsoluteError: 0.7, rmse: 1.1, brierScore: 0.15, calibrationError: 0.04, intervalCoverage: 0.82 }), releaseSubgroups(0.9)));
    transaction.modelRegistryEntry.findFirst.mockResolvedValueOnce(registry("champion", "v1", metrics(), releaseSubgroups()));
    const result = await evaluateModelChallenger({ challengerId: "challenger", actorIdentifier: "admin@example.com", baselineMetrics: requiredBaselines });
    expect(result.action).toBe("EVALUATED");
    expect(result.promoted).toBe(false);
    expect(transaction.modelRegistryEntry.update).not.toHaveBeenCalled();
    expect(transaction.modelReleaseDecision.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "EVALUATED" }) }));
  });

  it("records rejection and leaves the champion untouched when a subgroup regresses", async () => {
    const championSubgroup = releaseSubgroups();
    const challengerSubgroup = releaseSubgroups(1.3);
    transaction.modelRegistryEntry.findUnique.mockResolvedValueOnce(registry("challenger", "v2", metrics({ mae: 0.9, medianAbsoluteError: 0.7, rmse: 1.1, brierScore: 0.15, calibrationError: 0.04, intervalCoverage: 0.82 }), challengerSubgroup));
    transaction.modelRegistryEntry.findFirst.mockResolvedValueOnce(registry("champion", "v1", metrics(), championSubgroup));
    const result = await evaluateModelChallenger({ challengerId: "challenger", actorIdentifier: "admin@example.com", baselineMetrics: requiredBaselines, promote: true });
    expect(result.action).toBe("REJECTED");
    expect(transaction.modelRegistryEntry.update).toHaveBeenCalledTimes(1);
    expect(transaction.modelRegistryEntry.update).toHaveBeenCalledWith({ where: { id: "challenger" }, data: { status: "REJECTED" } });
  });
});
