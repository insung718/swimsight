import { describe, expect, it } from "vitest";
import { buildImportPreview, detectImportAdapter } from "@/lib/imports/adapters";
import {
  CsvDocumentError,
  MAX_IMPORT_BYTES,
  isFormulaLike,
  parseCsvDocument
} from "@/lib/imports/csv-parser";
import { assessImportedMeetIdentity, assessImportedResultIdentity } from "@/lib/imports/identity";

describe("versioned race import adapters", () => {
  it("detects and normalizes the canonical format with row provenance", () => {
    const csv = [
      "Date,Event,Time,Course,Meet Name,Result Kind,Race Type,External Result ID",
      "2026-06-28,100 Freestyle,56.31,LCM,National Trials,Official,Individual,result-100"
    ].join("\n");

    const preview = buildImportPreview({ csv, sourceName: "canonical-results.csv" });

    expect(preview).toMatchObject({
      adapter: "SWIMSIGHT_CANONICAL",
      adapterVersion: "swimsight-canonical-v1",
      totalRows: 1,
      validRows: 1,
      invalidRows: 0
    });
    expect(preview.rows[0].normalized).toMatchObject({
      date: "2026-06-28",
      event: "100 Freestyle",
      timeSeconds: 56.31,
      course: "LCM",
      meetName: "National Trials",
      externalResultId: "result-100"
    });
    expect(preview.rows[0].originalRowHash).toMatch(/^[a-f0-9]{64}$/);
    expect(preview.rows[0].sourceProvenance.sourceColumns["external result id"]).toBe("PRESENT");
  });

  it("maps generic aliases without silently accepting ambiguous dates", () => {
    const valid = buildImportPreview({
      csv: "Race Date,Event Name,Final Time,Pool Length,Competition\n2026-05-12,50 Fly,25.88,25m,Spring Meet",
      sourceName: "results.csv"
    });
    expect(valid.adapter).toBe("GENERIC_RACE_CSV");
    expect(valid.rows[0].normalized).toMatchObject({ event: "50 Butterfly", course: "SCM", timeSeconds: 25.88 });

    const ambiguous = buildImportPreview({
      csv: "Race Date,Event Name,Final Time\n05/12/2026,50 Fly,25.88",
      sourceName: "results.csv"
    });
    expect(ambiguous.validRows).toBe(0);
    expect(ambiguous.rows[0].errors).toContainEqual(expect.objectContaining({ code: "INVALID_DATE" }));
  });

  it("detects a SwimCloud-compatible export and accepts its explicit US date form", () => {
    const csv = [
      "Swimmer Name,Athlete ID,Meet ID,Result ID,Date,Event,Time,Course",
      "Test Athlete,athlete-1,meet-1,result-1,06/28/2026,100 Free,56.31,LCM"
    ].join("\n");
    const document = parseCsvDocument(csv);
    expect(detectImportAdapter(document, "swimcloud-export.csv").adapter).toBe("SWIMCLOUD_EXPORT");

    const preview = buildImportPreview({ csv, sourceName: "swimcloud-export.csv" });
    expect(preview.validRows).toBe(1);
    expect(preview.rows[0].normalized).toMatchObject({
      date: "2026-06-28",
      externalAthleteId: "athlete-1",
      externalMeetId: "meet-1",
      externalResultId: "result-1"
    });
  });

  it("rejects ASCII and Unicode-normalized spreadsheet formulas", () => {
    for (const value of ["=1+1", "+SUM(A1:A2)", "-2+3", "@IMPORTXML(A1)", "＝1+1", "＋SUM(A1:A2)"]) {
      expect(isFormulaLike(value)).toBe(true);
    }

    const preview = buildImportPreview({
      csv: "Date,Event,Time\n2026-06-28,100 Free,＝1+1",
      sourceName: "results.csv"
    });
    expect(preview.validRows).toBe(0);
    expect(preview.rows[0].errors.some((issue) => issue.code === "FORMULA_REJECTED")).toBe(true);
  });

  it("rejects future, malformed, duplicate-header, and oversized input", () => {
    const future = buildImportPreview({ csv: "Date,Event,Time\n2999-01-01,100 Free,56.31" });
    expect(future.rows[0].errors).toContainEqual(expect.objectContaining({ code: "FUTURE_DATE" }));

    const malformedCases = [
      { csv: "Date,Event,Time\n\"2026-01-01,100 Free,56.31", code: "MALFORMED_CSV" },
      { csv: "Date,Event,Time\n2026-01-01,100\0Free,56.31", code: "MALFORMED_ENCODING" },
      { csv: "Date,Event,Event\n2026-01-01,100 Free,56.31", code: "DUPLICATE_HEADER" }
    ];
    for (const testCase of malformedCases) {
      expect(() => parseCsvDocument(testCase.csv)).toThrowError(expect.objectContaining({ code: testCase.code }));
    }

    const oversized = `Date,Event,Time\n${"x".repeat(MAX_IMPORT_BYTES)}`;
    expect(() => parseCsvDocument(oversized)).toThrowError(expect.objectContaining({ code: "FILE_TOO_LARGE" }));
  });

  it("rejects duplicate field mappings and excess row counts", () => {
    expect(() => buildImportPreview({
      csv: "Date,Event,Time\n2026-01-01,100 Free,56.31",
      columnMapping: { date: "Date", event: "Event", time: "Event" }
    })).toThrow(/only map to one/i);

    const rows = Array.from({ length: 10_001 }, () => "2026-01-01,100 Free,56.31");
    expect(() => parseCsvDocument(["Date,Event,Time", ...rows].join("\n"))).toThrowError(
      expect.objectContaining({ code: "TOO_MANY_ROWS" } satisfies Partial<CsvDocumentError>)
    );
  });

  it("creates deterministic, reviewable meet and result identity decisions", () => {
    const sourceMeet = assessImportedMeetIdentity({ externalMeetId: "meet-123", meetName: "National Trials", date: "2026-06-28" });
    expect(sourceMeet).toMatchObject({ confidence: "HIGH", status: "SOURCE_LINKED", reasonCodes: ["SOURCE_MEET_ID_PRESENT"] });

    const derivedMeet = assessImportedMeetIdentity({ meetName: "National Trials", date: "2026-06-28" });
    expect(derivedMeet).toMatchObject({ confidence: "MEDIUM", status: "CONTENT_DERIVED", reasonCodes: expect.arrayContaining(["USER_REVIEWABLE"]) });
    expect(assessImportedMeetIdentity({ meetName: "Imported meet", date: "2026-06-28" })).toMatchObject({
      confidence: "LOW",
      status: "REVIEW_REQUIRED"
    });

    const result = assessImportedResultIdentity({
      date: "2026-06-28",
      event: "100 Freestyle",
      course: "LCM",
      timeSeconds: 56.31,
      meetIdentityKey: derivedMeet.identityKey
    });
    expect(result).toMatchObject({ confidence: "MEDIUM", status: "CONTENT_DERIVED", reasonCodes: expect.arrayContaining(["NEAR_DUPLICATE_REVIEW_ENABLED"]) });
    expect(assessImportedResultIdentity({
      externalResultId: "result-123",
      date: "2026-06-28",
      event: "100 Freestyle",
      course: "LCM",
      timeSeconds: 56.31,
      meetIdentityKey: sourceMeet.identityKey
    })).toMatchObject({ confidence: "HIGH", status: "SOURCE_LINKED" });
  });
});
