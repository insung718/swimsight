import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { parseRosterImport } from "@/lib/services/roster-import-service";

describe("coach roster import", () => {
  beforeEach(() => vi.clearAllMocks());

  it("previews valid rows without creating or looking up athlete accounts", () => {
    const parsed = parseRosterImport("Name,Email\nAvery Chen,avery@example.com\nMina Park,mina@example.com");
    expect(parsed).toMatchObject({ totalRows: 2, validRows: 2, invalidRows: 0 });
    expect(parsed.rows[0]).toMatchObject({ name: "Avery Chen", email: "avery@example.com", status: "VALID" });
    expect(parsed.sourceFileHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects formula injection, invalid email, and duplicate addresses", () => {
    const parsed = parseRosterImport([
      "Name,Email",
      "=HYPERLINK(A1),bad-email",
      "Mina Park,MINA@example.com",
      "Mina Again,mina@example.com"
    ].join("\n"));
    expect(parsed.validRows).toBe(1);
    expect(parsed.rows[0].errors).toContain("FORMULA_NOT_ALLOWED");
    expect(parsed.rows[0].errors).toContain("INVALID_EMAIL");
    expect(parsed.rows[2]).toMatchObject({ status: "DUPLICATE", errors: expect.arrayContaining(["DUPLICATE_EMAIL_IN_FILE"]) });
  });

  it("requires explicit name and email columns and caps pilot rosters", () => {
    expect(() => parseRosterImport("Athlete,Phone\nAvery,123")).toThrow("ROSTER_COLUMNS_REQUIRED");
    const rows = Array.from({ length: 501 }, (_, index) => `Athlete ${index},athlete${index}@example.com`);
    expect(() => parseRosterImport(["Name,Email", ...rows].join("\n"))).toThrow("ROSTER_TOO_MANY_ROWS");
  });
});
