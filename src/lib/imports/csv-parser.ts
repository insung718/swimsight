import { createHash } from "node:crypto";
import type { ParsedCsvDocument } from "@/lib/imports/types";

export const MAX_IMPORT_BYTES = 1_500_000;
export const MAX_IMPORT_ROWS = 10_000;
const MAX_COLUMNS = 64;
const MAX_CELL_CHARACTERS = 2_048;

export class CsvDocumentError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "CsvDocumentError";
  }
}

export function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isFormulaLike(value: string) {
  const normalized = value.normalize("NFKC").trimStart();
  return /^[=+\-@]/.test(normalized);
}

function assertDocumentSafety(csv: string) {
  const size = new TextEncoder().encode(csv).byteLength;
  if (size > MAX_IMPORT_BYTES) {
    throw new CsvDocumentError(`Spreadsheet exceeds the ${Math.floor(MAX_IMPORT_BYTES / 1_000_000)}.5 MB import limit.`, "FILE_TOO_LARGE");
  }
  if (csv.includes("\0")) throw new CsvDocumentError("Spreadsheet contains null bytes.", "MALFORMED_ENCODING");
  if (csv.includes("\uFFFD")) throw new CsvDocumentError("Spreadsheet contains invalid replacement characters.", "MALFORMED_ENCODING");
  if (!csv.trim()) throw new CsvDocumentError("Spreadsheet is empty.", "EMPTY_FILE");
}

export function parseCsvDocument(csv: string): ParsedCsvDocument {
  assertDocumentSafety(csv);
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let justClosedQuote = false;

  const pushCell = () => {
    if (cell.length > MAX_CELL_CHARACTERS) {
      throw new CsvDocumentError("A spreadsheet cell exceeds the 2,048 character limit.", "CELL_TOO_LONG");
    }
    row.push(cell.trim());
    cell = "";
    justClosedQuote = false;
    if (row.length > MAX_COLUMNS) throw new CsvDocumentError("Spreadsheet has too many columns.", "TOO_MANY_COLUMNS");
  };

  const pushRow = () => {
    pushCell();
    if (row.some((value) => value.length > 0)) records.push(row);
    row = [];
    if (records.length > MAX_IMPORT_ROWS + 1) {
      throw new CsvDocumentError(`Spreadsheet imports are limited to ${MAX_IMPORT_ROWS.toLocaleString("en-US")} result rows.`, "TOO_MANY_ROWS");
    }
  };

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    const next = csv[index + 1];

    if (quoted) {
      if (character === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        justClosedQuote = true;
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      if (cell.trim().length > 0 || justClosedQuote) {
        throw new CsvDocumentError("Spreadsheet contains an unexpected quote.", "MALFORMED_CSV");
      }
      quoted = true;
    } else if (character === ",") {
      pushCell();
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && next === "\n") index += 1;
      pushRow();
    } else if (justClosedQuote && !/\s/.test(character)) {
      throw new CsvDocumentError("Unexpected text after a quoted spreadsheet cell.", "MALFORMED_CSV");
    } else if (!justClosedQuote) {
      cell += character;
    }
  }

  if (quoted) throw new CsvDocumentError("Spreadsheet contains an unterminated quoted cell.", "MALFORMED_CSV");
  if (cell.length > 0 || row.length > 0) pushRow();
  if (records.length < 2) throw new CsvDocumentError("Spreadsheet must contain a header and at least one result row.", "NO_DATA_ROWS");

  const headers = records[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  const normalizedHeaders = headers.map(normalizeHeader);
  if (normalizedHeaders.some((header) => !header)) throw new CsvDocumentError("Spreadsheet contains an empty header.", "EMPTY_HEADER");
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new CsvDocumentError("Spreadsheet contains duplicate headers.", "DUPLICATE_HEADER");

  const rows = records.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) {
      throw new CsvDocumentError(`Row ${index + 2} has ${cells.length} cells but the header has ${headers.length}.`, "COLUMN_COUNT_MISMATCH");
    }
    return {
      rowNumber: index + 2,
      cells,
      originalRowHash: createHash("sha256").update(JSON.stringify(cells)).digest("hex")
    };
  });

  return { headers, normalizedHeaders, rows };
}
