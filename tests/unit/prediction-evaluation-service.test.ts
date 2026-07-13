import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluatePredictionSnapshotsForResult } from "@/lib/services/prediction-evaluation-service";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

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
  beforeEach(() => vi.clearAllMocks());

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
