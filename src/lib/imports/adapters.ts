import { createHash } from "node:crypto";
import { normalizeEvent } from "@/lib/events";
import { isFormulaLike, normalizeHeader, parseCsvDocument } from "@/lib/imports/csv-parser";
import { assessImportedMeetIdentity, assessImportedResultIdentity } from "@/lib/imports/identity";
import {
  IMPORT_ADAPTER_VERSIONS,
  type CanonicalImportField,
  type ImportAdapterDetection,
  type ImportAdapterId,
  type ImportColumnMapping,
  type ImportIssue,
  type ImportPreview,
  type NormalizedImportResult,
  type ParsedCsvDocument
} from "@/lib/imports/types";
import { parseTimeInput } from "@/lib/utils";
import type { Course, SwimRaceType, SwimResultKind } from "@/types/swim";

const requiredFields = ["date", "event", "time"] as const;
const allFields: CanonicalImportField[] = [
  "date", "event", "time", "course", "meetName", "resultKind", "raceType", "athleteName",
  "athleteBirthYear", "externalAthleteId", "externalMeetId", "externalResultId", "sourceStatus"
];

const aliases: Record<CanonicalImportField, string[]> = {
  date: ["date", "race date", "result date", "meet date"],
  event: ["event", "event name", "race", "distance stroke"],
  time: ["time", "final time", "result time", "performance", "swim time"],
  course: ["course", "pool course", "course type", "pool length"],
  meetName: ["meet", "meet name", "competition", "competition name"],
  resultKind: ["type", "result kind", "official", "result type"],
  raceType: ["context", "race type", "relay status"],
  athleteName: ["athlete", "athlete name", "swimmer", "swimmer name", "full name"],
  athleteBirthYear: ["birth year", "year of birth", "yob"],
  externalAthleteId: ["athlete id", "swimmer id", "profile id"],
  externalMeetId: ["meet id", "competition id"],
  externalResultId: ["result id", "race id", "performance id"],
  sourceStatus: ["status", "result status", "dq status"]
};

function autoMapping(document: ParsedCsvDocument) {
  return Object.fromEntries(allFields.flatMap((field) => {
    const match = aliases[field].find((alias) => document.normalizedHeaders.includes(alias));
    return match ? [[field, match]] : [];
  })) as ImportColumnMapping;
}

function canonicalMapping(document: ParsedCsvDocument) {
  const exact: ImportColumnMapping = {
    date: "date",
    event: "event",
    time: "time",
    course: "course",
    meetName: "meet name",
    resultKind: "result kind",
    raceType: "race type",
    athleteName: "athlete name",
    athleteBirthYear: "athlete birth year",
    externalAthleteId: "external athlete id",
    externalMeetId: "external meet id",
    externalResultId: "external result id",
    sourceStatus: "source status"
  };
  return Object.fromEntries(Object.entries(exact).filter(([, header]) => document.normalizedHeaders.includes(header))) as ImportColumnMapping;
}

function validateMapping(document: ParsedCsvDocument, mapping: ImportColumnMapping) {
  for (const field of requiredFields) {
    if (!mapping[field]) throw new Error(`Column mapping is missing ${field}.`);
  }
  for (const [field, rawHeader] of Object.entries(mapping)) {
    if (!allFields.includes(field as CanonicalImportField)) throw new Error(`Unsupported mapped field: ${field}.`);
    const header = normalizeHeader(rawHeader);
    if (!document.normalizedHeaders.includes(header)) throw new Error(`Mapped column was not found: ${rawHeader}.`);
    mapping[field as CanonicalImportField] = header;
  }
  const values = Object.values(mapping).filter(Boolean);
  if (new Set(values).size !== values.length) throw new Error("Each source column can only map to one SwimSight field.");
  return mapping;
}

export function detectImportAdapter(document: ParsedCsvDocument, sourceName = "upload.csv"): ImportAdapterDetection {
  const canonical = canonicalMapping(document);
  const generic = autoMapping(document);
  const source = sourceName.toLowerCase();
  const swimCloudMarkers = ["swimmer id", "athlete id", "meet id", "result id"].filter((header) => document.normalizedHeaders.includes(header));

  if (source.includes("swimcloud") || swimCloudMarkers.length >= 2) {
    return {
      adapter: "SWIMCLOUD_EXPORT",
      adapterVersion: IMPORT_ADAPTER_VERSIONS.SWIMCLOUD_EXPORT,
      confidence: source.includes("swimcloud") && swimCloudMarkers.length ? 0.98 : 0.88,
      reasons: [source.includes("swimcloud") ? "SOURCE_NAME_MATCH" : "SOURCE_NAME_UNKNOWN", ...swimCloudMarkers.map((marker) => `HEADER_${marker.toUpperCase().replaceAll(" ", "_")}`)],
      mapping: generic
    };
  }

  const canonicalHeaders = ["date", "event", "time", "course", "meet name", "result kind", "race type"];
  const canonicalMatches = canonicalHeaders.filter((header) => document.normalizedHeaders.includes(header)).length;
  if (canonicalMatches >= 5 && requiredFields.every((field) => canonical[field])) {
    return {
      adapter: "SWIMSIGHT_CANONICAL",
      adapterVersion: IMPORT_ADAPTER_VERSIONS.SWIMSIGHT_CANONICAL,
      confidence: canonicalMatches / canonicalHeaders.length,
      reasons: ["CANONICAL_HEADER_SET"],
      mapping: canonical
    };
  }

  return {
    adapter: "GENERIC_RACE_CSV",
    adapterVersion: IMPORT_ADAPTER_VERSIONS.GENERIC_RACE_CSV,
    confidence: requiredFields.filter((field) => generic[field]).length / requiredFields.length,
    reasons: ["GENERIC_ALIAS_MATCH"],
    mapping: generic
  };
}

function valueFor(document: ParsedCsvDocument, cells: string[], mapping: ImportColumnMapping, field: CanonicalImportField) {
  const mapped = mapping[field];
  if (!mapped) return "";
  return cells[document.normalizedHeaders.indexOf(normalizeHeader(mapped))] ?? "";
}

function safeText(value: string, max: number, field: CanonicalImportField, issues: ImportIssue[]) {
  const clean = Array.from(value.normalize("NFKC"))
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join("")
    .trim();
  if (isFormulaLike(clean)) {
    issues.push({ code: "FORMULA_REJECTED", message: "Formula-like spreadsheet values are not accepted.", field });
    return "";
  }
  if (clean.length > max) {
    issues.push({ code: "VALUE_TOO_LONG", message: `${field} exceeds ${max} characters.`, field });
    return "";
  }
  return clean;
}

function validDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeDate(value: string, adapter: ImportAdapterId, issues: ImportIssue[]) {
  const clean = safeText(value, 40, "date", issues);
  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(clean);
  if (iso) {
    [, year, month, day] = iso.map(Number);
  } else if (slash && adapter === "SWIMCLOUD_EXPORT") {
    month = Number(slash[1]);
    day = Number(slash[2]);
    year = Number(slash[3]);
  } else {
    issues.push({ code: "INVALID_DATE", message: adapter === "SWIMCLOUD_EXPORT" ? "Date must use YYYY-MM-DD or MM/DD/YYYY." : "Date must use unambiguous YYYY-MM-DD format.", field: "date" });
    return undefined;
  }
  if (!validDateParts(year, month, day)) {
    issues.push({ code: "INVALID_DATE", message: "Result date is not a real calendar date.", field: "date" });
    return undefined;
  }
  const normalized = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  if (normalized > new Date().toISOString().slice(0, 10)) {
    issues.push({ code: "FUTURE_DATE", message: "Result date cannot be in the future.", field: "date" });
    return undefined;
  }
  if (year < 1950) {
    issues.push({ code: "DATE_OUT_OF_RANGE", message: "Result date is outside the supported history range.", field: "date" });
    return undefined;
  }
  return normalized;
}

function normalizeCourse(value: string, issues: ImportIssue[]): Course | undefined {
  const clean = safeText(value || "LCM", 32, "course", issues).toUpperCase().replace(/[\s_-]+/g, "");
  const mapped: Record<string, Course> = { LCM: "LCM", "50M": "LCM", LONGCOURSE: "LCM", SCM: "SCM", "25M": "SCM", SHORTCOURSEMETERS: "SCM", SCY: "SCY", "25Y": "SCY", YARDS: "SCY", SHORTCOURSEYARDS: "SCY" };
  const course = mapped[clean];
  if (!course) issues.push({ code: "INVALID_COURSE", message: "Course must be LCM, SCM, or SCY.", field: "course" });
  return course;
}

function normalizeResultKind(value: string, issues: ImportIssue[]): SwimResultKind | undefined {
  const clean = safeText(value || "OFFICIAL", 40, "resultKind", issues).toUpperCase().replace(/[\s_-]+/g, "");
  if (["OFFICIAL", "MEET", "OFFICIALMEET", "FINAL"].includes(clean)) return "OFFICIAL";
  if (["TRAINING", "PRACTICE", "UNOFFICIAL"].includes(clean)) return "TRAINING";
  issues.push({ code: "INVALID_RESULT_KIND", message: "Result kind must be official or training.", field: "resultKind" });
  return undefined;
}

function normalizeRaceType(value: string, issues: ImportIssue[]): SwimRaceType | undefined {
  const clean = safeText(value || "INDIVIDUAL", 40, "raceType", issues).toUpperCase().replace(/[\s-]+/g, "_");
  if (clean === "RELAY") return "RELAY_SPLIT";
  if (["INDIVIDUAL", "RELAY_SPLIT", "TIME_TRIAL", "CONVERTED"].includes(clean)) return clean as SwimRaceType;
  issues.push({ code: "INVALID_RACE_TYPE", message: "Race type is not supported.", field: "raceType" });
  return undefined;
}

function eventDistance(event: string) {
  return Number.parseInt(event.split(" ")[0] ?? "0", 10);
}

function plausibleRaceTime(event: string, timeSeconds: number, issues: ImportIssue[]) {
  const distance = eventDistance(event);
  if (!distance) return;
  const broadMinimum = distance * 0.15;
  const broadMaximum = Math.min(7_200, Math.max(300, distance * 4.8));
  if (timeSeconds < broadMinimum || timeSeconds > broadMaximum) {
    issues.push({
      code: "IMPLAUSIBLE_TIME",
      message: "Time is outside the broad plausibility range for this event and requires correction.",
      field: "time"
    });
  }
}

function normalizeRow(document: ParsedCsvDocument, cells: string[], mapping: ImportColumnMapping, adapter: ImportAdapterId, defaultResultKind: SwimResultKind) {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  for (const [field, header] of Object.entries(mapping)) {
    const raw = valueFor(document, cells, mapping, field as CanonicalImportField);
    if (raw && isFormulaLike(raw)) errors.push({ code: "FORMULA_REJECTED", message: "Formula-like spreadsheet values are not accepted.", field: field as CanonicalImportField });
    if (!header) errors.push({ code: "MAPPING_ERROR", message: `Missing mapped header for ${field}.`, field: field as CanonicalImportField });
  }

  const date = normalizeDate(valueFor(document, cells, mapping, "date"), adapter, errors);
  const eventText = safeText(valueFor(document, cells, mapping, "event"), 100, "event", errors);
  const event = normalizeEvent(eventText);
  if (!event) errors.push({ code: "UNSUPPORTED_EVENT", message: "Event is not supported by SwimSight.", field: "event" });
  const timeText = safeText(valueFor(document, cells, mapping, "time"), 40, "time", errors);
  const timeSeconds = parseTimeInput(timeText);
  if (!Number.isFinite(timeSeconds) || timeSeconds <= 0 || timeSeconds > 7_200) errors.push({ code: "INVALID_TIME", message: "Time must be seconds or M:SS.xx and under two hours.", field: "time" });
  if (event && Number.isFinite(timeSeconds)) plausibleRaceTime(event, timeSeconds, errors);
  const course = normalizeCourse(valueFor(document, cells, mapping, "course"), errors);
  const resultKind = normalizeResultKind(valueFor(document, cells, mapping, "resultKind") || defaultResultKind, errors);
  const raceType = normalizeRaceType(valueFor(document, cells, mapping, "raceType"), errors);
  const meetName = safeText(valueFor(document, cells, mapping, "meetName") || "Imported meet", 120, "meetName", errors);
  const athleteName = safeText(valueFor(document, cells, mapping, "athleteName"), 120, "athleteName", errors) || undefined;
  const birthYearText = safeText(valueFor(document, cells, mapping, "athleteBirthYear"), 4, "athleteBirthYear", errors);
  const athleteBirthYear = birthYearText ? Number(birthYearText) : undefined;
  if (athleteBirthYear && (!Number.isInteger(athleteBirthYear) || athleteBirthYear < 1920 || athleteBirthYear > new Date().getUTCFullYear())) {
    errors.push({ code: "INVALID_BIRTH_YEAR", message: "Athlete birth year is invalid.", field: "athleteBirthYear" });
  }
  const externalAthleteId = safeText(valueFor(document, cells, mapping, "externalAthleteId"), 128, "externalAthleteId", errors) || undefined;
  const externalMeetId = safeText(valueFor(document, cells, mapping, "externalMeetId"), 128, "externalMeetId", errors) || undefined;
  const externalResultId = safeText(valueFor(document, cells, mapping, "externalResultId"), 128, "externalResultId", errors) || undefined;
  const sourceStatus = safeText(valueFor(document, cells, mapping, "sourceStatus"), 80, "sourceStatus", errors) || undefined;
  if (sourceStatus && /^(DQ|DSQ|DNS|DNF|SCR|SCRATCHED|NO\s*SHOW)$/i.test(sourceStatus)) {
    errors.push({ code: "NON_RESULT_STATUS", message: "Disqualified, scratched, or non-start result rows cannot be imported as race times.", field: "sourceStatus" });
  }
  if (!externalResultId) warnings.push({ code: "NO_EXTERNAL_RESULT_ID", message: "No source result ID was supplied; exact content matching will provide idempotency." });
  if (!externalMeetId) warnings.push({ code: "NO_EXTERNAL_MEET_ID", message: "No source meet ID was supplied; normalized meet name and date will provide a reviewable identity key." });

  const normalized: NormalizedImportResult | undefined = errors.length || !date || !event || !course || !resultKind || !raceType || !Number.isFinite(timeSeconds)
    ? undefined
    : { date, event, timeSeconds, course, meetName, resultKind, raceType, athleteName, athleteBirthYear, externalAthleteId, externalMeetId, externalResultId, sourceStatus };
  return { normalized, errors, warnings };
}

export function buildImportPreview({
  adapter,
  columnMapping,
  csv,
  sourceName = "upload.csv",
  defaultResultKind = "OFFICIAL"
}: {
  csv: string;
  sourceName?: string;
  adapter?: ImportAdapterId;
  columnMapping?: ImportColumnMapping;
  defaultResultKind?: SwimResultKind;
}): ImportPreview {
  const document = parseCsvDocument(csv);
  const detected = detectImportAdapter(document, sourceName);
  const selectedAdapter = adapter ?? detected.adapter;
  const selectedDetection = adapter
    ? { ...detected, adapter, adapterVersion: IMPORT_ADAPTER_VERSIONS[adapter], reasons: [...detected.reasons, "USER_SELECTED_ADAPTER"] }
    : detected;
  const mapping = validateMapping(document, { ...(columnMapping ?? selectedDetection.mapping) });
  const sourceFileHash = createHash("sha256").update(csv).digest("hex");
  const rows = document.rows.map((row) => {
    const normalized = normalizeRow(document, row.cells, mapping, selectedAdapter, defaultResultKind);
    const meetIdentity = normalized.normalized ? assessImportedMeetIdentity(normalized.normalized) : undefined;
    const resultIdentity = normalized.normalized && meetIdentity
      ? assessImportedResultIdentity({ ...normalized.normalized, meetIdentityKey: meetIdentity.identityKey })
      : undefined;
    return {
      ...row,
      ...normalized,
      sourceProvenance: {
        sourceColumns: Object.fromEntries(document.normalizedHeaders.map((header, index) => [header, row.cells[index] ? "PRESENT" : "EMPTY"])),
        externalAthleteId: normalized.normalized?.externalAthleteId,
        externalMeetId: normalized.normalized?.externalMeetId,
        externalResultId: normalized.normalized?.externalResultId,
        sourceStatus: valueFor(document, row.cells, mapping, "sourceStatus").normalize("NFKC").trim().slice(0, 80) || undefined,
        meetIdentity,
        resultIdentity
      }
    };
  });

  return {
    adapter: selectedAdapter,
    adapterVersion: IMPORT_ADAPTER_VERSIONS[selectedAdapter],
    detectedFormat: selectedAdapter.replaceAll("_", " "),
    detectionConfidence: selectedDetection.confidence,
    detectionReasons: selectedDetection.reasons,
    sourceFileHash,
    headers: document.headers,
    mapping,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.normalized && !row.errors.length).length,
    invalidRows: rows.filter((row) => !row.normalized || row.errors.length).length,
    rows
  };
}
