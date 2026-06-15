import { normalizeEvent } from "@/lib/events";
import { parseTimeInput } from "@/lib/utils";
import type { Course, SwimResult } from "@/types/swim";

export interface CsvImportResult {
  validRows: Omit<SwimResult, "id" | "userId">[];
  errors: {
    row: number;
    message: string;
  }[];
}

const allowedCourses = new Set<Course>(["SCM", "LCM", "SCY"]);

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function validateSwimCsv(csv: string): CsvImportResult {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const result: CsvImportResult = { validRows: [], errors: [] };

  if (lines.length < 2) {
    return {
      validRows: [],
      errors: [{ row: 1, message: "CSV must include a header and at least one swim row." }]
    };
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const dateIndex = headers.indexOf("date");
  const eventIndex = headers.indexOf("event");
  const timeIndex = headers.indexOf("time");
  const courseIndex = headers.indexOf("course");
  const meetIndex = headers.indexOf("meet");

  if (dateIndex === -1 || eventIndex === -1 || timeIndex === -1) {
    return {
      validRows: [],
      errors: [{ row: 1, message: "Required headers are Date, Event, and Time." }]
    };
  }

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const cells = splitCsvLine(line);
    const date = cells[dateIndex];
    const event = normalizeEvent(cells[eventIndex] ?? "");
    const timeSeconds = parseTimeInput(cells[timeIndex] ?? "");
    const course = (cells[courseIndex] || "LCM").toUpperCase() as Course;
    const meetName = cells[meetIndex] || "Imported meet";

    if (!date || Number.isNaN(new Date(date).getTime())) {
      result.errors.push({ row: rowNumber, message: "Date must be a valid ISO date." });
      return;
    }

    if (!event) {
      result.errors.push({ row: rowNumber, message: "Event is not supported." });
      return;
    }

    if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) {
      result.errors.push({ row: rowNumber, message: "Time must be seconds or M:SS.xx." });
      return;
    }

    if (!allowedCourses.has(course)) {
      result.errors.push({ row: rowNumber, message: "Course must be SCM, LCM, or SCY." });
      return;
    }

    result.validRows.push({
      date,
      event,
      timeSeconds,
      course,
      meetName
    });
  });

  return result;
}
