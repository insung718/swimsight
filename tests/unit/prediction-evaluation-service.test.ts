import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDashboardAnalytics } from "@/lib/analytics";
import { evaluatePredictionSnapshotsForResult, syncPredictionSnapshots } from "@/lib/services/prediction-evaluation-service";
import type { Goal, SwimResult } from "@/types/swim";

const createManyMock = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { predictionSnapshot: { createMany: createManyMock } } }));

function relativeDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const result = {
  id: "result-1",
  userId: "athlete-1",
  date: new Date("2026-07-12T00:00:00.000Z"),
  event: "ONE_HUNDRED_FREESTYLE",
  course: "LCM",
  timeSeconds: 59.4,
  meetName: "Target Meet",
  source: "MANUAL",
  resultKind: "OFFICIAL",
  raceType: "INDIVIDUAL",
  dedupeKey: "key",
  notes: null,
  createdAt: new Date("2026-07-12T12:00:00.000Z"),
  updatedAt: new Date("2026-07-12T12:00:00.000Z")
} as const;

const snapshots = ["model-v1", "model-v2"].map((modelVersion, index) => ({
  id: `snapshot-${index}`,
  predictedTime: 60,
  lowerBound: 59,
  upperBound: 61,
  goalTime: 59.5,
  modelVersion
}));

function transaction(snapshotRows = snapshots) {
  return {
    swimResult: {
      findFirst: vi.fn()
        .mockResolvedValueOnce(result)
        .mockResolvedValueOnce({ timeSeconds: 60.2 })
    },
    predictionSnapshot: {
      findMany: vi.fn().mockResolvedValueOnce(snapshotRows),
      update: vi.fn().mockResolvedValue({})
    }
  };
}

describe("prediction result matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createManyMock.mockResolvedValue({ count: 4 });
  });

  it("persists account-scoped explanation and probability snapshots without foreign race leakage", async () => {
    const accountSwims: SwimResult[] = [
      { id: "a-1", userId: "athlete-1", date: relativeDate(-60), event: "100 Freestyle", course: "LCM", timeSeconds: 61, meetName: "Meet A" },
      { id: "a-2", userId: "athlete-1", date: relativeDate(-10), event: "100 Freestyle", course: "LCM", timeSeconds: 60, meetName: "Meet B" }
    ];
    const foreignSwim: SwimResult = { id: "b-1", userId: "athlete-2", date: relativeDate(-30), event: "100 Freestyle", course: "LCM", timeSeconds: 40, meetName: "Foreign" };
    const goal: Goal = { id: "goal-1", userId: "athlete-1", event: "100 Freestyle", course: "LCM", targetTime: 59, qualifyingTime: 58.5, targetDate: relativeDate(180) };
    const profile = { age: 16, sex: "MALE" as const, taperDays: 8, swimSessionsPerWeek: 6 };
    const predictions = buildDashboardAnalytics(accountSwims, goal, [], profile).predictions;

    await syncPredictionSnapshots({ userId: "athlete-1", predictions, swims: [...accountSwims, foreignSwim], profile, goal });

    const rows = createManyMock.mock.calls[0][0].data as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.userId === "athlete-1")).toBe(true);
    expect(rows.every((row) => typeof row.pbProbability === "number" && typeof row.explanationMethod === "string")).toBe(true);
    expect(rows.every((row) => row.goalProbability !== null && row.qualifyingProbability !== null)).toBe(true);
    expect(rows.some((row) => JSON.stringify(row.featureSnapshot).includes("40"))).toBe(false);
  });

  it("ignores relay splits before any athlete data is queried", async () => {
    const tx = transaction();
    const count = await evaluatePredictionSnapshotsForResult(tx as never, { ...result, raceType: "RELAY_SPLIT" } as never);
    expect(count).toBe(0);
    expect(tx.swimResult.findFirst).not.toHaveBeenCalled();
  });

  it("matches only the result account, event, course, and exact target date", async () => {
    const tx = transaction();
    await evaluatePredictionSnapshotsForResult(tx as never, result as never);

    expect(tx.predictionSnapshot.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: "athlete-1",
        event: "ONE_HUNDRED_FREESTYLE",
        course: "LCM"
      })
    });
  });

  it("evaluates multiple model versions for the same target without overwriting metadata", async () => {
    const tx = transaction();
    const count = await evaluatePredictionSnapshotsForResult(tx as never, result as never);

    expect(count).toBe(2);
    expect(tx.predictionSnapshot.update).toHaveBeenCalledTimes(2);
    expect(tx.predictionSnapshot.update).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: "snapshot-0" } }));
    expect(tx.predictionSnapshot.update).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: "snapshot-1" } }));
  });

  it("leaves unmatched predictions pending", async () => {
    const tx = transaction([]);
    expect(await evaluatePredictionSnapshotsForResult(tx as never, result as never)).toBe(0);
    expect(tx.predictionSnapshot.update).not.toHaveBeenCalled();
  });
});
