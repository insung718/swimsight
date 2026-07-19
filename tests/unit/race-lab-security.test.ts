import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const transaction = vi.hoisted(() => ({
  raceSplit: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn()
  }
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  swimResult: { findFirst: vi.fn(), findMany: vi.fn() },
  raceSplit: { findMany: vi.fn(), createMany: vi.fn() },
  raceLabScenario: { findMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() }
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { deleteRaceLabScenario, getRaceLabState, saveManualRaceSplits } from "@/lib/services/race-lab-service";
import { raceLabMutationSchema } from "@/lib/validation";

describe("Race Lab account isolation and provenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.raceLabScenario.findMany.mockResolvedValue([]);
    prismaMock.raceSplit.findMany.mockResolvedValue([]);
  });

  it("requires the source race to belong to the authenticated account", async () => {
    prismaMock.swimResult.findFirst.mockResolvedValueOnce(null);
    await expect(saveManualRaceSplits({
      userId: "user-a",
      raceId: "race-owned-by-b",
      cumulativeTimes: [27, 56]
    })).rejects.toThrow(/not found/i);
    expect(prismaMock.swimResult.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "race-owned-by-b", userId: "user-a" }
    }));
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("never lets manual input replace official splits", async () => {
    prismaMock.swimResult.findFirst.mockResolvedValueOnce({
      id: "race-a",
      userId: "user-a",
      event: "ONE_HUNDRED_FREESTYLE",
      course: "LCM",
      timeSeconds: 56,
      resultKind: "OFFICIAL",
      raceType: "INDIVIDUAL",
      date: new Date("2026-06-01")
    });
    transaction.raceSplit.findFirst.mockResolvedValueOnce({ id: "official-split" });

    await expect(saveManualRaceSplits({ userId: "user-a", raceId: "race-a", cumulativeTimes: [27, 56] }))
      .rejects.toThrow(/cannot be replaced/i);
    expect(transaction.raceSplit.deleteMany).not.toHaveBeenCalled();
    expect(transaction.raceSplit.createMany).not.toHaveBeenCalled();
  });

  it("scopes scenario deletion to the authenticated user", async () => {
    prismaMock.raceLabScenario.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(deleteRaceLabScenario({ userId: "user-a", scenarioId: "scenario-b" })).rejects.toThrow(/not found/i);
    expect(prismaMock.raceLabScenario.deleteMany).toHaveBeenCalledWith({ where: { id: "scenario-b", userId: "user-a" } });
  });

  it("rejects client-controlled provenance, user IDs, and projected times", () => {
    expect(raceLabMutationSchema.safeParse({
      mode: "SAVE_SPLITS",
      raceId: "race-a",
      cumulativeTimes: [27, 56],
      source: "OFFICIAL"
    }).success).toBe(false);
    expect(raceLabMutationSchema.safeParse({
      mode: "SAVE_SIMULATION",
      raceId: "race-a",
      userId: "user-b",
      name: "Forged",
      projectedTime: 1,
      settings: {
        reactionTime: 0.7,
        firstSegmentAdjustment: 0,
        middleSegmentAdjustment: 0,
        finalSegmentAdjustment: 0,
        turnAdjustment: 0,
        underwaterEfficiency: 0
      }
    }).success).toBe(false);
  });

  it("fails closed when a stored scenario contains malformed split geometry", async () => {
    prismaMock.raceLabScenario.findMany.mockResolvedValueOnce([{
      id: "scenario-corrupt",
      baseResultId: "race-a",
      kind: "SIMULATION",
      event: "ONE_HUNDRED_FREESTYLE",
      course: "LCM",
      name: "Corrupt snapshot",
      strategy: null,
      targetTime: null,
      projectedTime: 56,
      settings: {},
      segments: [
        { segmentIndex: 3, segmentDistance: 50, cumulativeDistance: 50, segmentTime: 27, cumulativeTime: 27, source: "SIMULATED", precision: "HUNDREDTH" },
        { segmentIndex: 4, segmentDistance: 50, cumulativeDistance: 100, segmentTime: 29, cumulativeTime: 56, source: "SIMULATED", precision: "HUNDREDTH" }
      ],
      engineVersion: "race-lab-v1.0.0",
      createdAt: new Date("2026-06-01")
    }]);

    const state = await getRaceLabState("user-a");
    expect(state.scenarios[0].segments).toEqual([]);
  });
});
