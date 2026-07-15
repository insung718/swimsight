import { sha256, stableJson } from "@/lib/data-integrity";

export type ResearchSplit = "TRAIN" | "VALIDATION" | "TEST";

export function assignResearchSplit(identifier: string): ResearchSplit {
  const bucket = Number.parseInt(sha256(`split-policy-v1|${identifier}`).slice(0, 8), 16) % 100;
  return bucket < 70 ? "TRAIN" : bucket < 85 ? "VALIDATION" : "TEST";
}

export function selectPredictionTimeHistory<T extends { date: Date }>(
  races: readonly T[],
  targetDate: Date,
  maximumHistory = 20
) {
  const limit = Math.min(Math.max(Math.trunc(maximumHistory), 1), 100);
  return races
    .filter((race) => race.date.getTime() < targetDate.getTime())
    .sort((left, right) => left.date.getTime() - right.date.getTime())
    .slice(-limit);
}

export function buildResearchDatasetHash(records: readonly {
  athletePseudonym: string;
  sourceRecordHash: string;
  splitAssignment: string;
  predictionCutoff: Date;
}[]) {
  return sha256(records
    .map((record) => [
      record.athletePseudonym,
      record.sourceRecordHash,
      record.splitAssignment,
      record.predictionCutoff.toISOString()
    ].join("|"))
    .sort()
    .join("\n"));
}

export function buildResearchManifestHash(payload: Record<string, unknown>) {
  const reproduciblePayload = { ...payload };
  delete reproduciblePayload.generatedAt;
  return sha256(stableJson(reproduciblePayload));
}
