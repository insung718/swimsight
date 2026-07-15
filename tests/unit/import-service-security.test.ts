import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/prediction-evaluation-service", () => ({ evaluatePredictionSnapshotsForResult: vi.fn() }));
vi.mock("@/lib/services/product-analytics-service", () => ({
  countBucket: vi.fn((value: number) => String(value)),
  markFirstInsight: vi.fn(),
  recordProductEvent: vi.fn()
}));

const transaction = vi.hoisted(() => ({
  importBatch: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
  },
  importRow: { createMany: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  importIdentityCandidate: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  identityResolutionEvent: { create: vi.fn() },
  swimResult: { findMany: vi.fn(), deleteMany: vi.fn(), createManyAndReturn: vi.fn() },
  researchCohortRecord: { findMany: vi.fn() },
  researchCohortManifest: { updateMany: vi.fn() },
  predictionSnapshot: { updateMany: vi.fn() },
  importActionLog: { findFirst: vi.fn(), create: vi.fn() }
}));
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
  importBatch: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  user: { findUniqueOrThrow: vi.fn() },
  swimResult: { findMany: vi.fn() }
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  commitImportBatch,
  correctImportRow,
  getImportBatch,
  listImportBatches,
  previewImportBatch,
  resolveImportIdentity,
  rollbackImportBatch
} from "@/lib/services/import-service";

function batchFixture() {
  return {
    id: "batch-1",
    userId: "user-1",
    adapter: "SWIMSIGHT_CANONICAL",
    adapterVersion: "swimsight-canonical-v1",
    sourceName: "results.csv",
    status: "ROLLED_BACK",
    detectedFormat: "SWIMSIGHT CANONICAL",
    columnMapping: {},
    totalRows: 1,
    validRows: 0,
    invalidRows: 0,
    duplicateRows: 0,
    reviewRows: 0,
    importedRows: 0,
    metadata: { sourceHeaders: ["Date", "Event", "Time"] },
    committedAt: new Date("2026-07-01T00:00:00.000Z"),
    rolledBackAt: new Date("2026-07-02T00:00:00.000Z"),
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    rows: [],
    identities: [],
    actions: []
  };
}

describe("import account isolation and rollback lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.importBatch.findMany.mockResolvedValue([]);
    prismaMock.importBatch.findFirst.mockResolvedValue(null);
    transaction.importBatch.findFirst.mockResolvedValue(null);
    transaction.importRow.findFirst.mockResolvedValue(null);
    transaction.importIdentityCandidate.findFirst.mockResolvedValue(null);
  });

  it("scopes import listing and detail reads to the authenticated account", async () => {
    await listImportBatches("user-1");
    expect(prismaMock.importBatch.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "user-1" } }));

    await expect(getImportBatch("user-1", "batch-1")).resolves.toBeNull();
    expect(prismaMock.importBatch.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "batch-1", userId: "user-1" } }));
  });

  it("fails closed for cross-account commit, correction, identity review, and rollback", async () => {
    await expect(commitImportBatch({ userId: "attacker", batchId: "batch-1" })).resolves.toBeNull();
    expect(transaction.importBatch.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "batch-1", userId: "attacker" })
    }));
    expect(transaction.swimResult.createManyAndReturn).not.toHaveBeenCalled();

    await expect(correctImportRow({
      userId: "attacker",
      batchId: "batch-1",
      rowId: "row-1",
      result: { date: "2026-06-01", event: "100 Freestyle", course: "LCM", timeSeconds: 56, meetName: "Meet", resultKind: "OFFICIAL", raceType: "INDIVIDUAL" }
    })).resolves.toBeNull();
    expect(transaction.importRow.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ batch: expect.objectContaining({ userId: "attacker" }) })
    }));

    await expect(resolveImportIdentity({ userId: "attacker", batchId: "batch-1", candidateId: "identity-1", action: "CONFIRM_SELF" })).resolves.toBeNull();
    expect(transaction.importIdentityCandidate.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ownerUserId: "attacker", batch: expect.objectContaining({ userId: "attacker" }) })
    }));

    await expect(rollbackImportBatch({ userId: "attacker", batchId: "batch-1" })).resolves.toBeNull();
    expect(transaction.importBatch.findFirst).toHaveBeenLastCalledWith({ where: { id: "batch-1", userId: "attacker" } });
    expect(transaction.swimResult.deleteMany).not.toHaveBeenCalled();
  });

  it("invalidates cohort lineage and clears derived outcomes before authorized source deletion", async () => {
    transaction.importBatch.findFirst.mockResolvedValueOnce({ id: "batch-1", userId: "user-1", status: "COMMITTED" });
    transaction.swimResult.findMany.mockResolvedValueOnce([{ id: "result-1" }]);
    transaction.researchCohortRecord.findMany.mockResolvedValueOnce([{ manifestId: "manifest-1" }]);
    transaction.importActionLog.findFirst.mockResolvedValueOnce(null);
    transaction.importActionLog.create.mockResolvedValueOnce({ id: "action-1" });
    transaction.importBatch.findUniqueOrThrow.mockResolvedValueOnce(batchFixture());

    await expect(rollbackImportBatch({ userId: "user-1", batchId: "batch-1" })).resolves.toMatchObject({ status: "ROLLED_BACK" });

    expect(transaction.researchCohortManifest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ["manifest-1"] }, status: "SEALED" },
      data: expect.objectContaining({ status: "INVALIDATED" })
    }));
    expect(transaction.predictionSnapshot.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { actualResultId: { in: ["result-1"] } },
      data: expect.objectContaining({ actualResultId: null, absoluteError: null, evaluatedAt: null })
    }));
    expect(transaction.swimResult.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["result-1"] }, userId: "user-1" } });
    expect(transaction.researchCohortManifest.updateMany.mock.invocationCallOrder[0]).toBeLessThan(transaction.swimResult.deleteMany.mock.invocationCallOrder[0]);
    expect(transaction.predictionSnapshot.updateMany.mock.invocationCallOrder[0]).toBeLessThan(transaction.swimResult.deleteMany.mock.invocationCallOrder[0]);
  });

  it("marks repeated rows inside one upload as duplicates before any race is committed", async () => {
    prismaMock.importBatch.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findUniqueOrThrow.mockResolvedValueOnce({ id: "user-1", name: "Avery Chen" });
    prismaMock.swimResult.findMany.mockResolvedValueOnce([]);
    transaction.importBatch.create.mockResolvedValueOnce({ id: "batch-1" });
    transaction.importIdentityCandidate.create.mockResolvedValueOnce({ id: "identity-1", status: "AUTO_MATCHED" });
    transaction.importActionLog.findFirst.mockResolvedValueOnce(null);
    transaction.importActionLog.create.mockResolvedValueOnce({ id: "action-1" });
    transaction.importBatch.findUniqueOrThrow.mockResolvedValueOnce({
      ...batchFixture(),
      status: "PREVIEWED",
      validRows: 1,
      duplicateRows: 1,
      rolledBackAt: null,
      committedAt: null
    });

    await previewImportBatch({
      userId: "user-1",
      sourceName: "results.csv",
      csv: "Date,Event,Time\n2026-06-01,100 Free,56.31\n2026-06-01,100 Free,56.31"
    });

    const createdRows = transaction.importRow.createMany.mock.calls[0][0].data as Array<{ status: string }>;
    expect(createdRows.map((row) => row.status)).toEqual(["VALID", "DUPLICATE"]);
    expect(transaction.importBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data: { validRows: 1, invalidRows: 0, duplicateRows: 1, reviewRows: 0 }
    });
    expect(transaction.swimResult.createManyAndReturn).not.toHaveBeenCalled();
  });
});
