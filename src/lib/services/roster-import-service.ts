import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { operationalPseudonym, sha256 } from "@/lib/data-integrity";
import { isFormulaLike, normalizeHeader, parseCsvDocument } from "@/lib/imports/csv-parser";
import { prisma } from "@/lib/prisma";
import { ATHLETE_SHARE_SCOPES, appendAccessAudit } from "@/lib/services/access-audit-service";

const MAX_ROSTER_ROWS = 500;
const ROSTER_TOKEN_TTL_MS = 30 * 60_000;

type RosterRow = {
  rowNumber: number;
  name: string;
  email: string;
  status: "VALID" | "INVALID" | "DUPLICATE";
  errors: string[];
};

function rosterSecret() {
  const secret = process.env.ROSTER_IMPORT_SECRET ?? process.env.CLERK_SECRET_KEY;
  if (!secret || secret.length < 32) throw new Error("ROSTER_IMPORT_SECRET_NOT_CONFIGURED");
  return secret;
}

function cleanRosterName(value: string) {
  return Array.from(value.normalize("NFKC").trim()).filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  }).join("");
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseRosterImport(csv: string) {
  const document = parseCsvDocument(csv);
  if (document.rows.length > MAX_ROSTER_ROWS) throw new Error("ROSTER_TOO_MANY_ROWS");
  const normalized = document.headers.map(normalizeHeader);
  const nameIndex = normalized.findIndex((header) => ["name", "athlete name", "swimmer name"].includes(header));
  const emailIndex = normalized.findIndex((header) => ["email", "email address", "athlete email", "swimmer email"].includes(header));
  if (nameIndex < 0 || emailIndex < 0) throw new Error("ROSTER_COLUMNS_REQUIRED");

  const seen = new Set<string>();
  const rows: RosterRow[] = document.rows.map((row) => {
    const rawName = row.cells[nameIndex] ?? "";
    const rawEmail = row.cells[emailIndex] ?? "";
    const name = cleanRosterName(rawName);
    const email = rawEmail.normalize("NFKC").trim().toLowerCase();
    const errors: string[] = [];
    if (row.cells.some(isFormulaLike)) errors.push("FORMULA_NOT_ALLOWED");
    if (name.length < 2 || name.length > 100) errors.push("INVALID_NAME");
    if (!validEmail(email)) errors.push("INVALID_EMAIL");
    const duplicate = seen.has(email);
    if (duplicate) errors.push("DUPLICATE_EMAIL_IN_FILE");
    if (email) seen.add(email);
    return {
      rowNumber: row.rowNumber,
      name,
      email,
      status: duplicate ? "DUPLICATE" : errors.length ? "INVALID" : "VALID",
      errors
    };
  });
  const sourceFileHash = sha256(csv);
  return {
    sourceFileHash,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.status === "VALID").length,
    invalidRows: rows.filter((row) => row.status !== "VALID").length,
    rows
  };
}

function signPreview(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", rosterSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPreview(token: string) {
  const [encoded, supplied] = token.split(".");
  if (!encoded || !supplied) return null;
  const expected = createHmac("sha256", rosterSecret()).update(encoded).digest("base64url");
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
    return typeof payload.expiresAt === "number" && payload.expiresAt > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export async function previewRosterImport(input: { coachId: string; teamId: string; cohortId: string; csv: string }) {
  const parsed = parseRosterImport(input.csv);
  const now = new Date();
  const [teamAccess, cohort] = await Promise.all([
    prisma.teamMembership.findUnique({ where: { teamId_userId: { teamId: input.teamId, userId: input.coachId } }, select: { role: true } }),
    prisma.pilotCohort.findFirst({
      where: {
        id: input.cohortId,
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
        ]
      },
      select: { id: true, name: true, label: true }
    })
  ]);
  if (!teamAccess || !["OWNER", "COACH"].includes(teamAccess.role)) throw new Error("ROSTER_FORBIDDEN");
  if (!cohort) throw new Error("ROSTER_COHORT_UNAVAILABLE");
  return {
    ...parsed,
    cohort,
    previewToken: signPreview({
      coachId: input.coachId,
      teamId: input.teamId,
      cohortId: input.cohortId,
      sourceFileHash: parsed.sourceFileHash,
      expiresAt: Date.now() + ROSTER_TOKEN_TTL_MS
    }),
    permissionReview: {
      scopes: [...ATHLETE_SHARE_SCOPES],
      athleteAcceptanceRequired: true,
      consentCapturedSeparately: true,
      accountsCreated: false
    }
  };
}

export async function commitRosterImport(input: {
  coachId: string;
  teamId: string;
  cohortId: string;
  csv: string;
  previewToken: string;
}) {
  const payload = verifyPreview(input.previewToken);
  const parsed = parseRosterImport(input.csv);
  if (!payload
    || payload.coachId !== input.coachId
    || payload.teamId !== input.teamId
    || payload.cohortId !== input.cohortId
    || payload.sourceFileHash !== parsed.sourceFileHash) throw new Error("ROSTER_PREVIEW_INVALID");
  const validRows = parsed.rows.filter((row) => row.status === "VALID");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60_000);

  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const [membership, cohort] = await Promise.all([
      transaction.teamMembership.findUnique({ where: { teamId_userId: { teamId: input.teamId, userId: input.coachId } }, select: { role: true } }),
      transaction.pilotCohort.findFirst({
        where: {
          id: input.cohortId,
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
          ]
        },
        select: { id: true }
      })
    ]);
    if (!membership || !["OWNER", "COACH"].includes(membership.role)) throw new Error("ROSTER_FORBIDDEN");
    if (!cohort) throw new Error("ROSTER_COHORT_UNAVAILABLE");
    const priorCommit = await transaction.accessAuditLog.findFirst({
      where: {
        actorId: input.coachId,
        teamId: input.teamId,
        action: "CREATE_ROSTER_PILOT_INVITATIONS",
        resourceType: "PILOT_INVITATION_SET",
        resourceId: parsed.sourceFileHash
      },
      select: { id: true }
    });
    if (priorCommit) throw new Error("ROSTER_ALREADY_COMMITTED");

    const invitations: Array<{ rowNumber: number; name: string; email: string; joinPath: string; expiresAt: string }> = [];
    for (const row of validRows) {
      const token = randomBytes(32).toString("base64url");
      await transaction.pilotInvitation.create({
        data: {
          cohortId: input.cohortId,
          teamId: input.teamId,
          createdById: input.coachId,
          createdByPseudonym: operationalPseudonym("pilot-invitation-creator", input.coachId)!,
          tokenHash: sha256(token),
          label: `Roster row ${row.rowNumber}`,
          audience: "INDIVIDUAL",
          maxUses: 1,
          expiresAt
        }
      });
      invitations.push({ rowNumber: row.rowNumber, name: row.name, email: row.email, joinPath: `/pilot?token=${encodeURIComponent(token)}`, expiresAt: expiresAt.toISOString() });
    }
    await appendAccessAudit(transaction, {
      actorId: input.coachId,
      teamId: input.teamId,
      action: "CREATE_ROSTER_PILOT_INVITATIONS",
      resourceType: "PILOT_INVITATION_SET",
      resourceId: parsed.sourceFileHash,
      purpose: "CONTROLLED_PILOT_ROSTER_IMPORT",
      outcome: "ALLOWED",
      metadata: { invitationCount: invitations.length, importerVersion: "coach-roster-v1", rawFileRetained: false }
    });
    return { invitations, rejectedRows: parsed.rows.filter((row) => row.status !== "VALID"), importerVersion: "coach-roster-v1" };
  }, { isolationLevel: "Serializable", timeout: 30_000 });
}
