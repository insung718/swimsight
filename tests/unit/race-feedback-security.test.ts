import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const transaction = vi.hoisted(() => ({
  swimResult: { findFirst: vi.fn() },
  raceFeedback: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  raceFeedbackRevision: { create: vi.fn() }
}));
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  raceFeedback: { findMany: vi.fn() }
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { createRaceFeedback, deleteRaceFeedback, updateRaceFeedback } from "@/lib/services/race-feedback-service";

const fields = {
  taperStatus: "TAPERED" as const,
  illness: false,
  injury: false,
  effort: "MAXIMUM" as const,
  courseInformationCorrect: true,
  unusualCircumstances: null,
  predictionUseful: true
};

describe("race feedback account isolation and history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires the result to belong to the authenticated account", async () => {
    transaction.swimResult.findFirst.mockResolvedValueOnce(null);
    await expect(createRaceFeedback("user-a", "result-owned-by-b", fields)).rejects.toThrow("FEEDBACK_RESULT_NOT_FOUND");
    expect(transaction.swimResult.findFirst).toHaveBeenCalledWith({ where: { id: "result-owned-by-b", userId: "user-a" }, select: { id: true } });
    expect(transaction.raceFeedback.create).not.toHaveBeenCalled();
  });

  it("creates an immutable revision separately from the official result", async () => {
    transaction.swimResult.findFirst.mockResolvedValueOnce({ id: "result-a" });
    transaction.raceFeedback.findUnique.mockResolvedValueOnce(null);
    transaction.raceFeedback.create.mockResolvedValueOnce({ id: "feedback-a", currentVersion: 1 });
    await createRaceFeedback("user-a", "result-a", fields);
    expect(transaction.raceFeedbackRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "user-a", version: 1, changeType: "CREATED", snapshot: expect.objectContaining({ modelTrainingEligible: false }) })
    }));
  });

  it("rejects cross-account edits before writing history", async () => {
    transaction.raceFeedback.findFirst.mockResolvedValueOnce(null);
    await expect(updateRaceFeedback("user-a", "feedback-b", 1, fields)).rejects.toThrow("FEEDBACK_NOT_FOUND");
    expect(transaction.raceFeedback.findFirst).toHaveBeenCalledWith({ where: { id: "feedback-b", userId: "user-a", deletedAt: null } });
    expect(transaction.raceFeedbackRevision.create).not.toHaveBeenCalled();
  });

  it("uses optimistic versions for concurrent edit and delete attempts", async () => {
    transaction.raceFeedback.findFirst.mockResolvedValueOnce({ id: "feedback-a", currentVersion: 2 });
    await expect(deleteRaceFeedback("user-a", "feedback-a", 1)).rejects.toThrow("FEEDBACK_VERSION_CONFLICT");
    expect(transaction.raceFeedback.update).not.toHaveBeenCalled();
  });
});
