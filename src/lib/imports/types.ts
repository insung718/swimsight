import type { Course, SwimEvent, SwimRaceType, SwimResultKind } from "@/types/swim";
import type { ImportedEntityIdentity } from "@/lib/imports/identity";

export const IMPORT_ADAPTER_VERSIONS = {
  SWIMSIGHT_CANONICAL: "swimsight-canonical-v1",
  GENERIC_RACE_CSV: "generic-race-csv-v1",
  SWIMCLOUD_EXPORT: "swimcloud-compatible-export-v1"
} as const;

export type ImportAdapterId = keyof typeof IMPORT_ADAPTER_VERSIONS;

export type CanonicalImportField =
  | "date"
  | "event"
  | "time"
  | "course"
  | "meetName"
  | "resultKind"
  | "raceType"
  | "athleteName"
  | "athleteBirthYear"
  | "externalAthleteId"
  | "externalMeetId"
  | "externalResultId"
  | "sourceStatus";

export type ImportColumnMapping = Partial<Record<CanonicalImportField, string>>;

export interface ParsedCsvDocument {
  headers: string[];
  normalizedHeaders: string[];
  rows: { rowNumber: number; cells: string[]; originalRowHash: string }[];
}

export interface ImportIssue {
  code: string;
  message: string;
  field?: CanonicalImportField;
}

export interface NormalizedImportResult {
  date: string;
  event: SwimEvent;
  course: Course;
  timeSeconds: number;
  meetName: string;
  resultKind: SwimResultKind;
  raceType: SwimRaceType;
  athleteName?: string;
  athleteBirthYear?: number;
  externalAthleteId?: string;
  externalMeetId?: string;
  externalResultId?: string;
  sourceStatus?: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  originalRowHash: string;
  normalized?: NormalizedImportResult;
  errors: ImportIssue[];
  warnings: ImportIssue[];
  sourceProvenance: {
    sourceColumns: Record<string, string>;
    externalAthleteId?: string;
    externalMeetId?: string;
    externalResultId?: string;
    sourceStatus?: string;
    meetIdentity?: ImportedEntityIdentity;
    resultIdentity?: ImportedEntityIdentity;
  };
}

export interface ImportAdapterDetection {
  adapter: ImportAdapterId;
  adapterVersion: string;
  confidence: number;
  reasons: string[];
  mapping: ImportColumnMapping;
}

export interface ImportPreview {
  adapter: ImportAdapterId;
  adapterVersion: string;
  detectedFormat: string;
  detectionConfidence: number;
  detectionReasons: string[];
  sourceFileHash: string;
  headers: string[];
  mapping: ImportColumnMapping;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportPreviewRow[];
}
