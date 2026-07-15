import { describe, expect, it } from "vitest";
import {
  assignResearchSplit,
  buildResearchDatasetHash,
  buildResearchManifestHash,
  selectPredictionTimeHistory
} from "@/lib/cohort-integrity";

describe("research cohort integrity", () => {
  it("assigns one athlete to a deterministic split", () => {
    const first = assignResearchSplit("athlete-pseudonym-1");
    expect(assignResearchSplit("athlete-pseudonym-1")).toBe(first);
    expect(["TRAIN", "VALIDATION", "TEST"]).toContain(first);
  });

  it("excludes same-day and future races regardless of input order", () => {
    const target = new Date("2026-06-15T00:00:00.000Z");
    const races = [
      { id: "future", date: new Date("2026-06-16T00:00:00.000Z") },
      { id: "prior-2", date: new Date("2026-06-14T00:00:00.000Z") },
      { id: "same-day", date: new Date("2026-06-15T00:00:00.000Z") },
      { id: "prior-1", date: new Date("2026-06-01T00:00:00.000Z") }
    ];
    expect(selectPredictionTimeHistory(races, target).map((race) => race.id)).toEqual(["prior-1", "prior-2"]);
  });

  it("uses at most the latest 20 prediction-time races", () => {
    const races = Array.from({ length: 30 }, (_, index) => ({
      id: `race-${index + 1}`,
      date: new Date(Date.UTC(2024, 0, index + 1))
    }));
    const selected = selectPredictionTimeHistory(races, new Date("2025-01-01T00:00:00.000Z"));
    expect(selected).toHaveLength(20);
    expect(selected[0].id).toBe("race-11");
    expect(selected.at(-1)?.id).toBe("race-30");
  });

  it("hashes the same cohort identically regardless of row order or database IDs", () => {
    const first = {
      athletePseudonym: "athlete-a",
      sourceRecordHash: "source-a",
      splitAssignment: "TRAIN",
      predictionCutoff: new Date("2026-06-01T00:00:00.000Z")
    };
    const second = {
      athletePseudonym: "athlete-b",
      sourceRecordHash: "source-b",
      splitAssignment: "TEST",
      predictionCutoff: new Date("2026-06-02T00:00:00.000Z")
    };
    expect(buildResearchDatasetHash([first, second])).toBe(buildResearchDatasetHash([second, first]));
    expect(buildResearchDatasetHash([first, second])).not.toBe(buildResearchDatasetHash([{ ...first, sourceRecordHash: "changed" }, second]));
  });

  it("keeps manifest identity independent of generation time and object key order", () => {
    const first = {
      generatedAt: "2026-07-15T00:00:00.000Z",
      datasetHash: "dataset-hash",
      inclusionRules: { course: "LCM", official: true }
    };
    const second = {
      inclusionRules: { official: true, course: "LCM" },
      datasetHash: "dataset-hash",
      generatedAt: "2026-07-16T00:00:00.000Z"
    };
    expect(buildResearchManifestHash(first)).toBe(buildResearchManifestHash(second));
    expect(buildResearchManifestHash(first)).not.toBe(buildResearchManifestHash({ ...first, datasetHash: "other" }));
  });
});
