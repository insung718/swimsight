import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { operationalPseudonym, sha256, stableJson } from "@/lib/data-integrity";

export type AccessAuditInput = {
  actorId?: string;
  subjectUserId?: string;
  teamId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  purpose: string;
  outcome: "ALLOWED" | "DENIED";
  metadata?: Prisma.InputJsonValue;
};

export const ATHLETE_SHARE_SCOPES = ["RESULTS", "GOALS", "PREDICTIONS", "UPCOMING_MEETS", "COACH_NOTES"] as const;
export const ATHLETE_SHARE_CONSENT_VERSION = "coach-share-v2";
export type AthleteShareScope = typeof ATHLETE_SHARE_SCOPES[number];

export function hasAthleteShareScope(scopes: unknown, requiredScope?: AthleteShareScope) {
  if (!requiredScope) return true;
  return Array.isArray(scopes) && scopes.some((scope) => scope === requiredScope);
}

export async function appendAccessAudit(transaction: Prisma.TransactionClient, input: AccessAuditInput) {
  const previous = await transaction.accessAuditLog.findFirst({
    where: input.teamId ? { teamId: input.teamId } : input.subjectUserId ? { subjectUserId: input.subjectUserId } : { actorId: input.actorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { integrityHash: true }
  });
  const createdAt = new Date();
  const actorPseudonym = operationalPseudonym("audit-actor", input.actorId);
  const subjectPseudonym = operationalPseudonym("audit-subject", input.subjectUserId);
  const teamPseudonym = operationalPseudonym("audit-team", input.teamId);
  const payload = {
    actorPseudonym,
    subjectPseudonym,
    teamPseudonym,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    purpose: input.purpose,
    outcome: input.outcome,
    metadata: input.metadata ?? null,
    previousHash: previous?.integrityHash ?? null,
    createdAt: createdAt.toISOString()
  };
  return transaction.accessAuditLog.create({
    data: {
      ...input,
      actorPseudonym,
      subjectPseudonym,
      teamPseudonym,
      metadata: input.metadata,
      previousHash: previous?.integrityHash,
      integrityHash: sha256(stableJson(payload)),
      createdAt
    }
  });
}

export async function coachAthleteAccess(input: {
  coachId: string;
  athleteId: string;
  teamId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  purpose: string;
  requiredScope?: AthleteShareScope;
}) {
  return prisma.$transaction(async (transaction) => {
    const [coachMembership, athleteMembership, grant] = await Promise.all([
      transaction.teamMembership.findUnique({ where: { teamId_userId: { teamId: input.teamId, userId: input.coachId } }, select: { role: true } }),
      transaction.teamMembership.findUnique({ where: { teamId_userId: { teamId: input.teamId, userId: input.athleteId } }, select: { role: true } }),
      transaction.athleteShareGrant.findUnique({ where: { athleteId_teamId: { athleteId: input.athleteId, teamId: input.teamId } }, select: { status: true, scopes: true } })
    ]);
    const allowed = Boolean(
      coachMembership && ["OWNER", "COACH"].includes(coachMembership.role)
      && athleteMembership?.role === "SWIMMER"
      && grant?.status === "ACTIVE"
      && hasAthleteShareScope(grant.scopes, input.requiredScope)
    );
    await appendAccessAudit(transaction, {
      actorId: input.coachId,
      subjectUserId: input.athleteId,
      teamId: input.teamId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      purpose: input.purpose,
      outcome: allowed ? "ALLOWED" : "DENIED",
      metadata: {
        reason: allowed ? "ACTIVE_MEMBERSHIP_SHARE_GRANT_AND_SCOPE" : "AUTHORIZATION_REQUIREMENTS_NOT_MET",
        requiredScope: input.requiredScope ?? null
      }
    });
    return allowed;
  }, { isolationLevel: "Serializable" });
}

export async function verifyAuditChain(teamId: string) {
  const records = await prisma.accessAuditLog.findMany({ where: { teamId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  let previousHash: string | null = null;
  for (const record of records) {
    const payload = {
      actorPseudonym: record.actorPseudonym,
      subjectPseudonym: record.subjectPseudonym,
      teamPseudonym: record.teamPseudonym,
      action: record.action,
      resourceType: record.resourceType,
      resourceId: record.resourceId ?? undefined,
      purpose: record.purpose,
      outcome: record.outcome,
      metadata: record.metadata,
      previousHash,
      createdAt: record.createdAt.toISOString()
    };
    if (record.previousHash !== previousHash || record.integrityHash !== sha256(stableJson(payload))) return false;
    previousHash = record.integrityHash;
  }
  return true;
}
