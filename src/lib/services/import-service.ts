import "server-only";
import { Prisma, type ImportAction, type ImportRowStatus } from "@prisma/client";
import { stableJson, sha256 } from "@/lib/data-integrity";
import { buildImportPreview } from "@/lib/imports/adapters";
import { assessImportedAthleteIdentity, assessImportedMeetIdentity, assessImportedResultIdentity } from "@/lib/imports/identity";
import type { ImportAdapterId, ImportColumnMapping, NormalizedImportResult } from "@/lib/imports/types";
import type { SwimResultKind } from "@/types/swim";
import { prisma } from "@/lib/prisma";
import { toPrismaEvent } from "@/lib/prisma-mappers";
import { evaluatePredictionSnapshotsForResult } from "@/lib/services/prediction-evaluation-service";
import { buildSwimDedupeKey } from "@/lib/services/swim-service";
import { countBucket, markFirstInsight, recordProductEvent } from "@/lib/services/product-analytics-service";

const MAX_RETURNED_ROWS = 500;

function normalizedName(value?: string) {
  return value?.normalize("NFKC").trim().toLocaleLowerCase("en") ?? "";
}

function identityKey(result: NormalizedImportResult) {
  return `${result.externalAthleteId ?? ""}|${normalizedName(result.athleteName)}`;
}

function safeNormalizedData(value: Prisma.JsonValue | null): NormalizedImportResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.date !== "string" || typeof row.event !== "string" || typeof row.course !== "string" || typeof row.timeSeconds !== "number" || typeof row.meetName !== "string") return null;
  return value as unknown as NormalizedImportResult;
}

function buildImportDefinitionHash(input: {
  sourceFileHash: string;
  adapter: string;
  adapterVersion: string;
  mapping: ImportColumnMapping;
  defaultResultKind?: SwimResultKind;
}) {
  return sha256(stableJson({
    sourceFileHash: input.sourceFileHash,
    adapter: input.adapter,
    adapterVersion: input.adapterVersion,
    mapping: input.mapping,
    defaultResultKind: input.defaultResultKind ?? "OFFICIAL"
  }));
}

type ExistingResult = {
  id: string;
  date: Date;
  event: Prisma.SwimResultWhereInput["event"];
  course: Prisma.SwimResultWhereInput["course"];
  timeSeconds: number;
  dedupeKey: string | null;
  externalResultId: string | null;
};

function findExistingMatch(
  result: NormalizedImportResult,
  userId: string,
  existingResults: ExistingResult[],
  existingByDedupe: Map<string, ExistingResult>,
  existingByExternalId: Map<string, ExistingResult>
) {
  const dedupeKey = buildSwimDedupeKey({ userId, ...result });
  const exact = result.externalResultId
    ? existingByExternalId.get(result.externalResultId) ?? existingByDedupe.get(dedupeKey)
    : existingByDedupe.get(dedupeKey);
  const near = exact ?? existingResults.find((existingResult) =>
    existingResult.date.toISOString().slice(0, 10) === result.date
    && existingResult.event === toPrismaEvent(result.event)
    && existingResult.course === result.course
    && Math.abs(existingResult.timeSeconds - result.timeSeconds) <= 0.05
  );
  return { dedupeKey, exact, near };
}

async function appendImportAction(
  transaction: Prisma.TransactionClient,
  input: { batchId: string; actorUserId: string; action: ImportAction; rowCount?: number; metadata?: Prisma.InputJsonValue }
) {
  const previous = await transaction.importActionLog.findFirst({
    where: { batchId: input.batchId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { integrityHash: true }
  });
  const occurredAt = new Date();
  const metadata = {
    ...(input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {}),
    previousIntegrityHash: previous?.integrityHash ?? null
  } as Prisma.InputJsonValue;
  const integrityHash = sha256(stableJson({
    batchId: input.batchId,
    actorUserId: input.actorUserId,
    action: input.action,
    rowCount: input.rowCount ?? 0,
    metadata,
    occurredAt: occurredAt.toISOString()
  }));
  return transaction.importActionLog.create({
    data: {
      batchId: input.batchId,
      actorUserId: input.actorUserId,
      action: input.action,
      rowCount: input.rowCount ?? 0,
      metadata,
      integrityHash,
      createdAt: occurredAt
    }
  });
}

const batchInclude = {
  identities: { orderBy: { createdAt: "asc" as const } },
  rows: { orderBy: { rowNumber: "asc" as const }, take: MAX_RETURNED_ROWS },
  actions: { orderBy: { createdAt: "desc" as const }, take: 20 }
} satisfies Prisma.ImportBatchInclude;

type ImportBatchWithDetails = Prisma.ImportBatchGetPayload<{ include: typeof batchInclude }>;

export function serializeImportBatch(batch: ImportBatchWithDetails) {
  const metadata = batch.metadata && typeof batch.metadata === "object" && !Array.isArray(batch.metadata)
    ? batch.metadata as Record<string, Prisma.JsonValue>
    : {};
  const sourceHeaders = Array.isArray(metadata.sourceHeaders)
    ? metadata.sourceHeaders.filter((header): header is string => typeof header === "string")
    : [];
  return {
    id: batch.id,
    adapter: batch.adapter,
    adapterVersion: batch.adapterVersion,
    sourceName: batch.sourceName,
    status: batch.status,
    detectedFormat: batch.detectedFormat,
    sourceHeaders,
    columnMapping: batch.columnMapping,
    totalRows: batch.totalRows,
    validRows: batch.validRows,
    invalidRows: batch.invalidRows,
    duplicateRows: batch.duplicateRows,
    reviewRows: batch.reviewRows,
    importedRows: batch.importedRows,
    committedAt: batch.committedAt?.toISOString() ?? null,
    rolledBackAt: batch.rolledBackAt?.toISOString() ?? null,
    createdAt: batch.createdAt.toISOString(),
    rowsTruncated: batch.totalRows > batch.rows.length,
    rows: batch.rows.map((row) => ({
      id: row.id,
      rowNumber: row.rowNumber,
      status: row.status,
      originalRowHash: row.originalRowHash,
      normalized: row.normalizedData,
      errors: row.errors,
      warnings: row.warnings,
      duplicateResultId: row.duplicateResultId,
      duplicateConfidence: row.duplicateConfidence,
      identityCandidateId: row.identityCandidateId
    })),
    identities: batch.identities.map((identity) => ({
      id: identity.id,
      sourceName: identity.sourceName,
      externalAthleteId: identity.externalAthleteId,
      sourceBirthYear: identity.sourceBirthYear,
      confidence: identity.confidence,
      score: identity.score,
      status: identity.status,
      reasonCodes: identity.reasonCodes
    })),
    actions: batch.actions.map((action) => ({
      id: action.id,
      action: action.action,
      rowCount: action.rowCount,
      createdAt: action.createdAt.toISOString(),
      integrityHash: action.integrityHash
    }))
  };
}

export async function listImportBatches(userId: string) {
  const batches = await prisma.importBatch.findMany({
    where: { userId },
    include: batchInclude,
    orderBy: { createdAt: "desc" },
    take: 20
  });
  return batches.map(serializeImportBatch);
}

export async function getImportBatch(userId: string, batchId: string) {
  const batch = await prisma.importBatch.findFirst({ where: { id: batchId, userId }, include: batchInclude });
  return batch ? serializeImportBatch(batch) : null;
}

export async function previewImportBatch(input: {
  userId: string;
  csv: string;
  sourceName: string;
  adapter?: ImportAdapterId;
  columnMapping?: ImportColumnMapping;
  defaultResultKind?: SwimResultKind;
}) {
  const preview = buildImportPreview(input);
  const importDefinitionHash = buildImportDefinitionHash({
    sourceFileHash: preview.sourceFileHash,
    adapter: preview.adapter,
    adapterVersion: preview.adapterVersion,
    mapping: preview.mapping,
    defaultResultKind: input.defaultResultKind
  });
  const existing = await prisma.importBatch.findUnique({
    where: { userId_importDefinitionHash: { userId: input.userId, importDefinitionHash } },
    include: batchInclude
  });
  if (existing && existing.status !== "ROLLED_BACK") {
    return { batch: serializeImportBatch(existing), duplicateUpload: true, reactivated: false };
  }

  const [account, existingResults] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: input.userId }, select: { id: true, name: true } }),
    prisma.swimResult.findMany({
      where: { userId: input.userId },
      select: { id: true, date: true, event: true, course: true, timeSeconds: true, meetName: true, resultKind: true, raceType: true, dedupeKey: true, externalResultId: true },
      take: 20_000
    })
  ]);
  const existingByDedupe = new Map<string, ExistingResult>(
    existingResults.flatMap((result) => result.dedupeKey ? [[result.dedupeKey, result] as [string, ExistingResult]] : [])
  );
  const existingByExternalId = new Map<string, ExistingResult>(
    existingResults.flatMap((result) => result.externalResultId ? [[result.externalResultId, result] as [string, ExistingResult]] : [])
  );

  if (existing?.status === "ROLLED_BACK") {
    const reactivated = await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.importBatch.updateMany({
        where: { id: existing.id, userId: input.userId, status: "ROLLED_BACK" },
        data: { status: "PREVIEWED", committedAt: null, rolledBackAt: null }
      });
      if (!claimed.count) {
        return transaction.importBatch.findUniqueOrThrow({ where: { id: existing.id }, include: batchInclude });
      }

      const rows = await transaction.importRow.findMany({
        where: { batchId: existing.id, status: "ROLLED_BACK" },
        include: { identityCandidate: { select: { status: true } } },
        orderBy: { rowNumber: "asc" },
        take: 10_000
      });
      const seenDedupeKeys = new Set<string>();
      const seenExternalResultIds = new Set<string>();
      const validIds: string[] = [];
      const reviewIds: string[] = [];
      const duplicateInsideUploadIds: string[] = [];
      const exactDuplicates: Array<{ id: string; duplicateResultId: string }> = [];

      for (const row of rows) {
        const result = safeNormalizedData(row.normalizedData);
        if (!result) {
          reviewIds.push(row.id);
          continue;
        }
        const match = findExistingMatch(result, input.userId, existingResults, existingByDedupe, existingByExternalId);
        const duplicateInsideUpload = seenDedupeKeys.has(match.dedupeKey)
          || Boolean(result.externalResultId && seenExternalResultIds.has(result.externalResultId));
        seenDedupeKeys.add(match.dedupeKey);
        if (result.externalResultId) seenExternalResultIds.add(result.externalResultId);
        if (duplicateInsideUpload) duplicateInsideUploadIds.push(row.id);
        else if (match.exact) exactDuplicates.push({ id: row.id, duplicateResultId: match.exact.id });
        else if (match.near || !row.identityCandidate || !["AUTO_MATCHED", "CONFIRMED"].includes(row.identityCandidate.status)) reviewIds.push(row.id);
        else validIds.push(row.id);
      }

      if (validIds.length) {
        await transaction.importRow.updateMany({
          where: { id: { in: validIds }, batchId: existing.id },
          data: { status: "VALID", duplicateResultId: null, duplicateConfidence: null }
        });
      }
      if (reviewIds.length) {
        await transaction.importRow.updateMany({
          where: { id: { in: reviewIds }, batchId: existing.id },
          data: { status: "REVIEW_REQUIRED", duplicateResultId: null, duplicateConfidence: null }
        });
      }
      if (duplicateInsideUploadIds.length) {
        await transaction.importRow.updateMany({
          where: { id: { in: duplicateInsideUploadIds }, batchId: existing.id },
          data: { status: "DUPLICATE", duplicateResultId: null, duplicateConfidence: "HIGH" }
        });
      }
      for (const duplicate of exactDuplicates) {
        await transaction.importRow.update({
          where: { id: duplicate.id },
          data: { status: "DUPLICATE", duplicateResultId: duplicate.duplicateResultId, duplicateConfidence: "HIGH" }
        });
      }
      const counts = await recountBatch(transaction, existing.id);
      await transaction.importBatch.update({ where: { id: existing.id }, data: counts });
      await appendImportAction(transaction, {
        batchId: existing.id,
        actorUserId: input.userId,
        action: "PREVIEWED",
        rowCount: rows.length,
        metadata: { reactivatedAfterRollback: true, duplicateRows: counts.duplicateRows, reviewRows: counts.reviewRows }
      });
      return transaction.importBatch.findUniqueOrThrow({ where: { id: existing.id }, include: batchInclude });
    }, { isolationLevel: "Serializable", timeout: 30_000 });
    return { batch: serializeImportBatch(reactivated), duplicateUpload: false, reactivated: true };
  }

  const created = await prisma.$transaction(async (transaction) => {
    const batch = await transaction.importBatch.create({
      data: {
        userId: input.userId,
        adapter: preview.adapter,
        adapterVersion: preview.adapterVersion,
        sourceName: input.sourceName,
        sourceFileHash: preview.sourceFileHash,
        importDefinitionHash,
        detectedFormat: preview.detectedFormat,
        columnMapping: preview.mapping as Prisma.InputJsonValue,
        totalRows: preview.totalRows,
        validRows: 0,
        invalidRows: 0,
        metadata: {
          detectionConfidence: preview.detectionConfidence,
          detectionReasons: preview.detectionReasons,
          sourceHeaders: preview.headers,
          rawFileRetained: false
        }
      }
    });

    const identityMap = new Map<string, { id: string; status: string }>();
    for (const row of preview.rows) {
      if (!row.normalized) continue;
      const key = identityKey(row.normalized);
      if (identityMap.has(key)) continue;
      const decision = assessImportedAthleteIdentity({
        accountName: account.name,
        sourceAthleteId: row.normalized.externalAthleteId,
        sourceName: row.normalized.athleteName
      });
      const candidate = await transaction.importIdentityCandidate.create({
        data: {
          batchId: batch.id,
          ownerUserId: input.userId,
          matchedUserId: decision.status === "AUTO_MATCHED" ? input.userId : null,
          externalAthleteId: row.normalized.externalAthleteId,
          sourceName: row.normalized.athleteName,
          sourceBirthYear: row.normalized.athleteBirthYear,
          confidence: decision.confidence,
          score: decision.score,
          status: decision.status,
          reasonCodes: decision.reasonCodes
        }
      });
      identityMap.set(key, { id: candidate.id, status: candidate.status });
    }

    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    let reviewRows = 0;
    const seenDedupeKeys = new Set<string>();
    const seenExternalResultIds = new Set<string>();
    const rowData: Prisma.ImportRowCreateManyInput[] = preview.rows.map((row) => {
      const candidate = row.normalized ? identityMap.get(identityKey(row.normalized)) : undefined;
      let status: ImportRowStatus = row.normalized ? "VALID" : "INVALID";
      let duplicateResultId: string | undefined;
      let duplicateConfidence: "HIGH" | "MEDIUM" | undefined;
      const warnings = [...row.warnings];

      if (row.normalized) {
        const { dedupeKey, exact, near } = findExistingMatch(row.normalized, input.userId, existingResults, existingByDedupe, existingByExternalId);
        const duplicateInsideFile = seenDedupeKeys.has(dedupeKey)
          || Boolean(row.normalized.externalResultId && seenExternalResultIds.has(row.normalized.externalResultId));
        seenDedupeKeys.add(dedupeKey);
        if (row.normalized.externalResultId) seenExternalResultIds.add(row.normalized.externalResultId);
        if (duplicateInsideFile) {
          status = "DUPLICATE";
          duplicateConfidence = "HIGH";
          warnings.push({ code: "DUPLICATE_WITHIN_UPLOAD", message: "This result appears more than once in the same spreadsheet." });
          duplicateRows += 1;
        } else if (exact) {
          status = "DUPLICATE";
          duplicateResultId = exact.id;
          duplicateConfidence = "HIGH";
          duplicateRows += 1;
        } else if (near) {
          status = "REVIEW_REQUIRED";
          duplicateResultId = near.id;
          duplicateConfidence = "MEDIUM";
          warnings.push({ code: "NEAR_DUPLICATE", message: "A result with the same date, event, course, and nearly identical time already exists." });
          reviewRows += 1;
        } else if (candidate?.status === "REVIEW_REQUIRED") {
          status = "REVIEW_REQUIRED";
          reviewRows += 1;
        } else {
          validRows += 1;
        }
      } else {
        invalidRows += 1;
      }

      return {
        batchId: batch.id,
        rowNumber: row.rowNumber,
        originalRowHash: row.originalRowHash,
        status,
        normalizedData: row.normalized as unknown as Prisma.InputJsonValue | undefined,
        sourceProvenance: row.sourceProvenance as Prisma.InputJsonValue,
        errors: row.errors as unknown as Prisma.InputJsonValue,
        warnings: warnings as unknown as Prisma.InputJsonValue,
        duplicateResultId,
        duplicateConfidence,
        identityCandidateId: candidate?.id
      };
    });
    await transaction.importRow.createMany({ data: rowData });
    await transaction.importBatch.update({
      where: { id: batch.id },
      data: { validRows, invalidRows, duplicateRows, reviewRows }
    });
    await appendImportAction(transaction, {
      batchId: batch.id,
      actorUserId: input.userId,
      action: "PREVIEWED",
      rowCount: preview.totalRows,
      metadata: { validRows, invalidRows, duplicateRows, reviewRows, adapterVersion: preview.adapterVersion }
    });
    await recordProductEvent({
      client: transaction,
      userId: input.userId,
      eventName: "IMPORT_PREVIEWED",
      properties: {
        adapter: preview.adapter,
        rowCountBucket: countBucket(preview.totalRows),
        validCountBucket: countBucket(validRows),
        hasReviewRows: reviewRows > 0
      }
    });
    return transaction.importBatch.findUniqueOrThrow({ where: { id: batch.id }, include: batchInclude });
  }, { isolationLevel: "Serializable" });

  return { batch: serializeImportBatch(created), duplicateUpload: false, reactivated: false };
}

export async function resolveImportIdentity(input: {
  userId: string;
  batchId: string;
  candidateId: string;
  action: "CONFIRM_SELF" | "REJECT" | "UNMERGE";
}) {
  return prisma.$transaction(async (transaction) => {
    const candidate = await transaction.importIdentityCandidate.findFirst({
      where: {
        id: input.candidateId,
        batchId: input.batchId,
        ownerUserId: input.userId,
        batch: { userId: input.userId, status: { in: ["PREVIEWED", "PARTIALLY_COMMITTED"] } }
      }
    });
    if (!candidate) return null;
    const nextStatus = input.action === "CONFIRM_SELF" ? "CONFIRMED" : input.action === "REJECT" ? "REJECTED" : "UNMERGED";
    await transaction.importIdentityCandidate.update({
      where: { id: candidate.id },
      data: {
        status: nextStatus,
        matchedUserId: input.action === "CONFIRM_SELF" ? input.userId : null,
        reviewedAt: new Date()
      }
    });
    await transaction.identityResolutionEvent.create({
      data: {
        candidateId: candidate.id,
        actorUserId: input.userId,
        action: input.action,
        previousStatus: candidate.status,
        nextStatus,
        reason: input.action === "CONFIRM_SELF" ? "Athlete explicitly confirmed this imported identity." : input.action === "REJECT" ? "Athlete rejected this imported identity." : "Athlete reversed the previous identity merge."
      }
    });
    if (input.action === "CONFIRM_SELF") {
      await transaction.importRow.updateMany({
        where: { batchId: input.batchId, identityCandidateId: candidate.id, status: "REVIEW_REQUIRED", duplicateResultId: null },
        data: { status: "VALID" }
      });
    } else {
      await transaction.importRow.updateMany({
        where: { batchId: input.batchId, identityCandidateId: candidate.id, status: { in: ["VALID", "REVIEW_REQUIRED"] } },
        data: { status: input.action === "REJECT" ? "SKIPPED" : "REVIEW_REQUIRED" }
      });
    }
    const counts = await recountBatch(transaction, input.batchId);
    await appendImportAction(transaction, {
      batchId: input.batchId,
      actorUserId: input.userId,
      action: input.action === "CONFIRM_SELF" ? "IDENTITY_CONFIRMED" : "IDENTITY_REJECTED",
      metadata: { candidateId: candidate.id, nextStatus }
    });
    await transaction.importBatch.update({ where: { id: input.batchId }, data: counts });
    const batch = await transaction.importBatch.findUniqueOrThrow({ where: { id: input.batchId }, include: batchInclude });
    return serializeImportBatch(batch);
  }, { isolationLevel: "Serializable" });
}

async function recountBatch(transaction: Prisma.TransactionClient, batchId: string) {
  const grouped = await transaction.importRow.groupBy({ by: ["status"], where: { batchId }, _count: true });
  const count = (statuses: ImportRowStatus[]) => grouped.filter((entry) => statuses.includes(entry.status)).reduce((sum, entry) => sum + entry._count, 0);
  return {
    validRows: count(["VALID"]),
    invalidRows: count(["INVALID"]),
    duplicateRows: count(["DUPLICATE"]),
    reviewRows: count(["REVIEW_REQUIRED"]),
    importedRows: count(["IMPORTED"])
  };
}

export async function correctImportRow(input: {
  userId: string;
  batchId: string;
  rowId: string;
  result: NormalizedImportResult;
}) {
  return prisma.$transaction(async (transaction) => {
    const row = await transaction.importRow.findFirst({
      where: { id: input.rowId, batchId: input.batchId, batch: { userId: input.userId, status: { in: ["PREVIEWED", "PARTIALLY_COMMITTED"] } } },
      include: { identityCandidate: true }
    });
    if (!row || row.status === "IMPORTED") return null;
    const existingResults = await transaction.swimResult.findMany({
      where: { userId: input.userId },
      select: { id: true, date: true, event: true, course: true, timeSeconds: true, dedupeKey: true, externalResultId: true },
      take: 20_000
    });
    const existingByDedupe = new Map<string, ExistingResult>(
      existingResults.flatMap((result) => result.dedupeKey ? [[result.dedupeKey, result] as [string, ExistingResult]] : [])
    );
    const existingByExternalId = new Map<string, ExistingResult>(
      existingResults.flatMap((result) => result.externalResultId ? [[result.externalResultId, result] as [string, ExistingResult]] : [])
    );
    const match = findExistingMatch(input.result, input.userId, existingResults, existingByDedupe, existingByExternalId);
    const otherRows = await transaction.importRow.findMany({
      where: { batchId: input.batchId, id: { not: row.id }, status: { in: ["VALID", "REVIEW_REQUIRED", "IMPORTED"] } },
      select: { normalizedData: true },
      take: 10_000
    });
    const duplicateInsideBatch = otherRows.some((other) => {
      const normalized = safeNormalizedData(other.normalizedData);
      if (!normalized) return false;
      return buildSwimDedupeKey({ userId: input.userId, ...normalized }) === match.dedupeKey
        || Boolean(input.result.externalResultId && normalized.externalResultId === input.result.externalResultId);
    });
    const identityNeedsReview = Boolean(row.identityCandidate && !["AUTO_MATCHED", "CONFIRMED"].includes(row.identityCandidate.status));
    const nextStatus: ImportRowStatus = duplicateInsideBatch || match.exact
      ? "DUPLICATE"
      : match.near || identityNeedsReview
        ? "REVIEW_REQUIRED"
        : "VALID";
    const correctionWarnings = [{ code: "USER_CORRECTED", message: "Row was corrected during import review." }];
    if (duplicateInsideBatch) correctionWarnings.push({ code: "DUPLICATE_WITHIN_UPLOAD", message: "This corrected result duplicates another row in the same spreadsheet." });
    else if (match.exact) correctionWarnings.push({ code: "EXACT_DUPLICATE", message: "This corrected result already exists in your account." });
    else if (match.near) correctionWarnings.push({ code: "NEAR_DUPLICATE", message: "A nearly identical result already exists and requires review." });
    await transaction.importRow.update({
      where: { id: row.id },
      data: {
        normalizedData: input.result as unknown as Prisma.InputJsonValue,
        status: nextStatus,
        errors: [],
        warnings: correctionWarnings,
        duplicateResultId: match.exact?.id ?? match.near?.id ?? null,
        duplicateConfidence: duplicateInsideBatch || match.exact ? "HIGH" : match.near ? "MEDIUM" : null
      }
    });
    await transaction.importBatch.update({ where: { id: input.batchId }, data: await recountBatch(transaction, input.batchId) });
    await appendImportAction(transaction, { batchId: input.batchId, actorUserId: input.userId, action: "ROW_CORRECTED", rowCount: 1, metadata: { rowId: row.id } });
    const batch = await transaction.importBatch.findUniqueOrThrow({ where: { id: input.batchId }, include: batchInclude });
    return serializeImportBatch(batch);
  }, { isolationLevel: "Serializable" });
}

export async function commitImportBatch(input: { userId: string; batchId: string; rowIds?: string[] }) {
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.importBatch.findFirst({
      where: { id: input.batchId, userId: input.userId, status: { in: ["PREVIEWED", "PARTIALLY_COMMITTED"] } }
    });
    if (!batch) return null;
    const priorCommittedBatches = await transaction.importBatch.count({
      where: { userId: input.userId, id: { not: batch.id }, status: { in: ["COMMITTED", "PARTIALLY_COMMITTED"] } }
    });
    const rows = await transaction.importRow.findMany({
      where: {
        batchId: batch.id,
        status: "VALID",
        ...(input.rowIds?.length ? { id: { in: input.rowIds } } : {})
      },
      orderBy: { rowNumber: "asc" },
      take: 10_000
    });
    const candidates = rows.flatMap((row) => {
      const result = safeNormalizedData(row.normalizedData);
      if (!result) return [];
      return [{ row, result }];
    });
    const data: Prisma.SwimResultCreateManyInput[] = candidates.map(({ row, result }) => {
      const meetIdentity = assessImportedMeetIdentity(result);
      const resultIdentity = assessImportedResultIdentity({ ...result, meetIdentityKey: meetIdentity.identityKey });
      return {
        userId: input.userId,
        date: new Date(`${result.date}T00:00:00.000Z`),
        event: toPrismaEvent(result.event),
        course: result.course,
        timeSeconds: result.timeSeconds,
        meetName: result.meetName,
        source: batch.adapter === "SWIMCLOUD_EXPORT" ? "MEET_IMPORT" : "CSV",
        resultKind: result.resultKind,
        raceType: result.raceType,
        dedupeKey: buildSwimDedupeKey({ userId: input.userId, ...result }),
        provenance: {
          method: "VERSIONED_IMPORT_ADAPTER",
          importBatchId: batch.id,
          importer: batch.adapter,
          importerVersion: batch.adapterVersion,
          sourceName: batch.sourceName,
          sourceFileHash: batch.sourceFileHash,
          sourceRowNumber: row.rowNumber,
          originalRowHash: row.originalRowHash,
          externalAthleteId: result.externalAthleteId ?? null,
          externalMeetId: result.externalMeetId ?? null,
          externalResultId: result.externalResultId ?? null,
          sourceStatus: result.sourceStatus ?? null,
          meetIdentity,
          resultIdentity,
          athleteIdentityCandidateId: row.identityCandidateId
        },
        importBatchId: batch.id,
        importRowId: row.id,
        externalAthleteId: result.externalAthleteId,
        externalMeetId: result.externalMeetId,
        externalResultId: result.externalResultId,
        sourceStatus: result.sourceStatus,
        originalRowHash: row.originalRowHash
      };
    });
    const created = data.length
      ? await transaction.swimResult.createManyAndReturn({ data, skipDuplicates: true })
      : [];
    for (const swim of created) await evaluatePredictionSnapshotsForResult(transaction, swim);
    const importedRowIds = created.flatMap((result) => result.importRowId ? [result.importRowId] : []);
    if (importedRowIds.length) {
      await transaction.importRow.updateMany({ where: { id: { in: importedRowIds }, batchId: batch.id }, data: { status: "IMPORTED" } });
    }
    const skippedRowIds = rows.map((row) => row.id).filter((id) => !importedRowIds.includes(id));
    if (skippedRowIds.length) {
      await transaction.importRow.updateMany({ where: { id: { in: skippedRowIds }, batchId: batch.id }, data: { status: "DUPLICATE", duplicateConfidence: "HIGH" } });
    }
    const counts = await recountBatch(transaction, batch.id);
    const unresolved = counts.validRows + counts.invalidRows + counts.reviewRows;
    await transaction.importBatch.update({
      where: { id: batch.id },
      data: {
        ...counts,
        status: unresolved > 0 ? "PARTIALLY_COMMITTED" : "COMMITTED",
        committedAt: new Date()
      }
    });
    await appendImportAction(transaction, {
      batchId: batch.id,
      actorUserId: input.userId,
      action: "COMMITTED",
      rowCount: created.length,
      metadata: { requestedRows: rows.length, skippedDuplicates: skippedRowIds.length, partial: unresolved > 0 }
    });
    await recordProductEvent({
      client: transaction,
      userId: input.userId,
      eventName: "IMPORT_COMPLETED",
      properties: {
        adapter: batch.adapter,
        rowCountBucket: countBucket(rows.length),
        validCountBucket: countBucket(created.length),
        partial: unresolved > 0,
        firstImport: priorCommittedBatches === 0
      }
    });
    if (created.length) await markFirstInsight(transaction, input.userId, "IMPORT");
    const result = await transaction.importBatch.findUniqueOrThrow({ where: { id: batch.id }, include: batchInclude });
    return serializeImportBatch(result);
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}

export async function rollbackImportBatch(input: { userId: string; batchId: string }) {
  return prisma.$transaction(async (transaction) => {
    const batch = await transaction.importBatch.findFirst({ where: { id: input.batchId, userId: input.userId } });
    if (!batch || batch.status === "ROLLED_BACK") return null;
    const importedResults = await transaction.swimResult.findMany({ where: { importBatchId: batch.id, userId: input.userId }, select: { id: true } });
    const resultIds = importedResults.map((result) => result.id);
    const affectedManifests = resultIds.length
      ? await transaction.researchCohortRecord.findMany({ where: { swimResultId: { in: resultIds } }, select: { manifestId: true }, distinct: ["manifestId"] })
      : [];
    if (affectedManifests.length) {
      await transaction.researchCohortManifest.updateMany({
        where: { id: { in: affectedManifests.map((manifest) => manifest.manifestId) }, status: "SEALED" },
        data: { status: "INVALIDATED", invalidatedAt: new Date(), invalidationReason: "A source result was removed through an authorized import rollback. Regenerate as a new cohort version." }
      });
    }
    if (resultIds.length) {
      await transaction.predictionSnapshot.updateMany({
        where: { actualResultId: { in: resultIds } },
        data: {
          actualResultId: null,
          evaluationPolicyVersion: null,
          evaluationMatchMetadata: Prisma.JsonNull,
          actualTime: null,
          absoluteError: null,
          signedError: null,
          percentageError: null,
          withinInterval: null,
          achievedPb: null,
          achievedGoal: null,
          achievedQualification: null,
          evaluatedAt: null
        }
      });
      await transaction.swimResult.deleteMany({ where: { id: { in: resultIds }, userId: input.userId } });
    }
    await transaction.importRow.updateMany({ where: { batchId: batch.id, status: "IMPORTED" }, data: { status: "ROLLED_BACK" } });
    await transaction.importBatch.update({ where: { id: batch.id }, data: { status: "ROLLED_BACK", rolledBackAt: new Date(), importedRows: 0 } });
    await appendImportAction(transaction, { batchId: batch.id, actorUserId: input.userId, action: "ROLLED_BACK", rowCount: resultIds.length, metadata: { invalidatedCohorts: affectedManifests.length } });
    const result = await transaction.importBatch.findUniqueOrThrow({ where: { id: batch.id }, include: batchInclude });
    return serializeImportBatch(result);
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}
