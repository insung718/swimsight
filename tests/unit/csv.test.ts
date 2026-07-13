import { describe, expect, it } from "vitest";
import { validateSwimCsv } from "@/lib/csv";

describe("CSV importer", () => {
  it("validates supported swim rows", () => {
    const result = validateSwimCsv(`Date,Event,Time
2026-03-16,50 Free,25.56
2026-03-16,100 Fly,1:03.80`);

    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(2);
    expect(result.validRows[1].event).toBe("100 Butterfly");
    expect(result.validRows[1].timeSeconds).toBe(63.8);
  });

  it("reports row-level validation errors", () => {
    const result = validateSwimCsv(`Date,Event,Time
not-a-date,50 Free,25.56
2026-03-16,20 Dolphin,88`);

    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toEqual([
      { row: 2, message: "Date must be a valid ISO date." },
      { row: 3, message: "Event is not supported." }
    ]);
  });

  it("rejects future results and duplicate spreadsheet rows", () => {
    const future = validateSwimCsv(`Date,Event,Time\n2999-01-01,50 Free,25.56`);
    const duplicate = validateSwimCsv(`Date,Event,Time,Course,Meet\n2026-03-16,50 Free,25.56,LCM,Meet A\n2026-03-16,50 Free,25.560,LCM,Meet A`);

    expect(future.errors[0].message).toBe("Result date cannot be in the future.");
    expect(duplicate.errors[0]).toEqual({ row: 3, message: "Duplicate result in spreadsheet." });
  });

  it("preserves relay context and millisecond precision", () => {
    const result = validateSwimCsv(`Date,Event,Time,Context\n2026-03-16,100 Free,1:03.805,RELAY_SPLIT`);

    expect(result.errors).toEqual([]);
    expect(result.validRows[0].timeSeconds).toBe(63.805);
    expect(result.validRows[0].raceType).toBe("RELAY_SPLIT");
  });
});
