import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { operationalPseudonym, sha256 } from "@/lib/data-integrity";
import { ATHLETE_SHARE_CONSENT_VERSION, ATHLETE_SHARE_SCOPES, appendAccessAudit } from "@/lib/services/access-audit-service";
import { recordProductEvent } from "@/lib/services/product-analytics-service";

export async function createPilotCohort(input: {
  createdById: string;
  name: string;
  label: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
}) {
  const creator = await prisma.user.findUnique({ where: { id: input.createdById }, select: { role: true } });
  if (creator?.role !== "ADMIN") throw new Error("PILOT_FORBIDDEN");
  return prisma.pilotCohort.create({
    data: {
      name: input.name,
      label: input.label,
      description: input.description,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      endsAt: input.endsAt ? new Date(input.endsAt) : undefined
    }
  });
}

export async function listActivePilotCohorts(includeCounts = false) {
  const now = new Date();
  return prisma.pilotCohort.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
      ]
    },
    select: {
      id: true,
      name: true,
      label: true,
      description: true,
      startsAt: true,
      endsAt: true,
      ...(includeCounts ? { _count: { select: { enrollments: true, invitations: true } } } : {})
    },
    orderBy: { createdAt: "desc" },
    take: 50
  });
}

export async function createPilotInvitation(input: {
  createdById: string;
  cohortId: string;
  teamId?: string;
  label: string;
  audience: "INDIVIDUAL" | "SCHOOL" | "CLUB";
  maxUses: number;
  expiresAt: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(input.expiresAt);
  const now = new Date();
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) throw new Error("PILOT_INVITATION_EXPIRY_INVALID");
  if (!Number.isInteger(input.maxUses) || input.maxUses < 1 || input.maxUses > 500) throw new Error("PILOT_INVITATION_USE_LIMIT_INVALID");
  const invitation = await prisma.$transaction(async (transaction) => {
    const [creator, cohort, membership] = await Promise.all([
      transaction.user.findUnique({ where: { id: input.createdById }, select: { role: true } }),
      transaction.pilotCohort.findFirst({
        where: {
          id: input.cohortId,
          active: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
          ]
        },
        select: { endsAt: true }
      }),
      input.teamId
        ? transaction.teamMembership.findUnique({ where: { teamId_userId: { teamId: input.teamId, userId: input.createdById } }, select: { role: true } })
        : Promise.resolve(null)
    ]);
    const canInvite = input.teamId
      ? Boolean(membership && ["OWNER", "COACH"].includes(membership.role))
      : creator?.role === "ADMIN";
    if (!canInvite) throw new Error("PILOT_FORBIDDEN");
    if (!cohort || (cohort.endsAt && expiresAt > cohort.endsAt)) throw new Error("PILOT_COHORT_UNAVAILABLE");
    return transaction.pilotInvitation.create({
      data: {
        createdById: input.createdById,
        createdByPseudonym: operationalPseudonym("pilot-invitation-creator", input.createdById)!,
        cohortId: input.cohortId,
        teamId: input.teamId,
        label: input.label,
        audience: input.audience,
        maxUses: input.maxUses,
        expiresAt,
        tokenHash: sha256(token)
      },
      select: { id: true, label: true, audience: true, maxUses: true, expiresAt: true, cohortId: true, teamId: true }
    });
  }, { isolationLevel: "Serializable" });
  return { invitation, token };
}

export async function listPilotInvitations(createdById: string) {
  return prisma.pilotInvitation.findMany({
    where: { createdById },
    select: {
      id: true,
      label: true,
      audience: true,
      maxUses: true,
      useCount: true,
      expiresAt: true,
      revokedAt: true,
      teamId: true,
      cohort: { select: { id: true, name: true, label: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });
}

export async function revokePilotInvitation(input: { actorId: string; actorRole: "ATHLETE" | "COACH" | "ADMIN"; invitationId: string }) {
  return prisma.$transaction(async (transaction) => {
    const invitation = await transaction.pilotInvitation.findFirst({
      where: {
        id: input.invitationId,
        ...(input.actorRole === "ADMIN" ? {} : { createdById: input.actorId })
      },
      select: { id: true, createdById: true, teamId: true, revokedAt: true }
    });
    if (!invitation) return null;
    const revokedAt = invitation.revokedAt ?? new Date();
    if (!invitation.revokedAt) {
      await transaction.pilotInvitation.update({ where: { id: invitation.id }, data: { revokedAt } });
      await appendAccessAudit(transaction, {
        actorId: input.actorId,
        teamId: invitation.teamId ?? undefined,
        action: "REVOKE_PILOT_INVITATION",
        resourceType: "PILOT_INVITATION",
        resourceId: invitation.id,
        purpose: "CONTROLLED_PILOT",
        outcome: "ALLOWED"
      });
    }
    return { id: invitation.id, revokedAt };
  }, { isolationLevel: "Serializable" });
}

export async function inspectPilotInvitation(input: { userId: string; token: string }) {
  const now = new Date();
  const invitation = await prisma.pilotInvitation.findUnique({
    where: { tokenHash: sha256(input.token) },
    select: {
      id: true,
      createdById: true,
      audience: true,
      maxUses: true,
      useCount: true,
      expiresAt: true,
      revokedAt: true,
      teamId: true,
      cohortId: true,
      cohort: { select: { name: true, label: true, active: true, startsAt: true, endsAt: true } },
      team: { select: { name: true } }
    }
  });
  if (!invitation
    || invitation.revokedAt
    || invitation.expiresAt <= now
    || !invitation.cohort.active
    || (invitation.cohort.startsAt && invitation.cohort.startsAt > now)
    || (invitation.cohort.endsAt && invitation.cohort.endsAt <= now)) {
    return { ok: false as const, reason: "INVITATION_UNAVAILABLE" };
  }
  if (invitation.createdById === input.userId) return { ok: false as const, reason: "INVITATION_SELF" };
  const [membership, enrollment] = await Promise.all([
    invitation.teamId
      ? prisma.teamMembership.findUnique({ where: { teamId_userId: { teamId: invitation.teamId, userId: input.userId } }, select: { role: true } })
      : Promise.resolve(null),
    prisma.pilotEnrollment.findUnique({ where: { cohortId_userId: { cohortId: invitation.cohortId, userId: input.userId } }, select: { status: true } })
  ]);
  if (membership && ["OWNER", "COACH"].includes(membership.role)) return { ok: false as const, reason: "INVITATION_SELF" };
  if (!enrollment && invitation.useCount >= invitation.maxUses) return { ok: false as const, reason: "INVITATION_FULL" };
  return {
    ok: true as const,
    invitation: {
      cohortName: invitation.cohort.name,
      cohortLabel: invitation.cohort.label,
      clubName: invitation.team?.name ?? null,
      audience: invitation.audience,
      expiresAt: invitation.expiresAt,
      alreadyEnrolled: enrollment?.status === "ACTIVE",
      coachAccessScopes: invitation.teamId ? [...ATHLETE_SHARE_SCOPES] : []
    }
  };
}

export async function acceptPilotInvitation(input: { userId: string; token: string }) {
  const tokenHash = sha256(input.token);
  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const invitation = await transaction.pilotInvitation.findUnique({
      where: { tokenHash },
      include: { cohort: true }
    });
    if (!invitation
      || invitation.revokedAt
      || invitation.expiresAt <= now
      || !invitation.cohort.active
      || (invitation.cohort.startsAt && invitation.cohort.startsAt > now)
      || (invitation.cohort.endsAt && invitation.cohort.endsAt <= now)) {
      return { ok: false as const, reason: "INVITATION_UNAVAILABLE" };
    }
    if (invitation.createdById === input.userId) return { ok: false as const, reason: "INVITATION_SELF" };
    const currentMembership = invitation.teamId
      ? await transaction.teamMembership.findUnique({ where: { teamId_userId: { teamId: invitation.teamId, userId: input.userId } } })
      : null;
    if (currentMembership && ["OWNER", "COACH"].includes(currentMembership.role)) {
      return { ok: false as const, reason: "INVITATION_SELF" };
    }
    const existing = await transaction.pilotEnrollment.findUnique({
      where: { cohortId_userId: { cohortId: invitation.cohortId, userId: input.userId } }
    });
    if (!existing && invitation.useCount >= invitation.maxUses) return { ok: false as const, reason: "INVITATION_FULL" };
    if (!existing) {
      const claimed = await transaction.pilotInvitation.updateMany({
        where: { id: invitation.id, useCount: { lt: invitation.maxUses }, revokedAt: null, expiresAt: { gt: now } },
        data: { useCount: { increment: 1 } }
      });
      if (claimed.count !== 1) return { ok: false as const, reason: "INVITATION_FULL" };
    }
    const enrollment = await transaction.pilotEnrollment.upsert({
      where: { cohortId_userId: { cohortId: invitation.cohortId, userId: input.userId } },
      update: { invitationId: invitation.id, teamId: invitation.teamId, status: "ACTIVE", withdrawnAt: null },
      create: {
        cohortId: invitation.cohortId,
        invitationId: invitation.id,
        userId: input.userId,
        teamId: invitation.teamId,
        metadata: {
          invitationDisclosureVersion: "pilot-disclosure-v2",
          coachAccessScopesAccepted: invitation.teamId ? [...ATHLETE_SHARE_SCOPES] : [],
          modelTrainingConsentCapturedSeparately: true,
          publicResearchConsentCapturedSeparately: true
        }
      }
    });
    if (invitation.teamId) {
      if (!currentMembership) {
        await transaction.teamMembership.create({ data: { teamId: invitation.teamId, userId: input.userId, role: "SWIMMER" } });
      }
      if (!currentMembership || currentMembership.role === "SWIMMER") {
        await transaction.athleteShareGrant.upsert({
          where: { athleteId_teamId: { athleteId: input.userId, teamId: invitation.teamId } },
          update: { status: "ACTIVE", grantedById: input.userId, consentVersion: ATHLETE_SHARE_CONSENT_VERSION, scopes: [...ATHLETE_SHARE_SCOPES], grantedAt: now, withdrawnAt: null },
          create: { athleteId: input.userId, teamId: invitation.teamId, grantedById: input.userId, consentVersion: ATHLETE_SHARE_CONSENT_VERSION, scopes: [...ATHLETE_SHARE_SCOPES] }
        });
      }
      await appendAccessAudit(transaction, {
        actorId: input.userId,
        subjectUserId: input.userId,
        teamId: invitation.teamId,
        action: "ACCEPT_PILOT_INVITATION",
        resourceType: "PILOT_ENROLLMENT",
        resourceId: enrollment.id,
        purpose: "CONTROLLED_PILOT",
        outcome: "ALLOWED",
        metadata: { cohortLabel: invitation.cohort.label, consentCapturedSeparately: true }
      });
    }
    await recordProductEvent({
      client: transaction,
      userId: input.userId,
      eventName: "PILOT_ENROLLED",
      properties: { audience: invitation.audience, clubLinked: Boolean(invitation.teamId) }
    });
    return {
      ok: true as const,
      enrollment: {
        id: enrollment.id,
        cohort: { id: invitation.cohort.id, name: invitation.cohort.name, label: invitation.cohort.label },
        teamId: invitation.teamId,
        status: enrollment.status
      }
    };
  }, { isolationLevel: "Serializable" });
}

export async function withdrawPilotEnrollment(input: { userId: string; enrollmentId: string }) {
  return prisma.$transaction(async (transaction) => {
    const enrollment = await transaction.pilotEnrollment.findFirst({ where: { id: input.enrollmentId, userId: input.userId, status: "ACTIVE" } });
    if (!enrollment) return null;
    const updated = await transaction.pilotEnrollment.update({ where: { id: enrollment.id }, data: { status: "WITHDRAWN", withdrawnAt: new Date() } });
    if (enrollment.teamId) {
      await transaction.athleteShareGrant.updateMany({
        where: { athleteId: input.userId, teamId: enrollment.teamId },
        data: { status: "WITHDRAWN", withdrawnAt: new Date() }
      });
      await appendAccessAudit(transaction, {
        actorId: input.userId,
        subjectUserId: input.userId,
        teamId: enrollment.teamId,
        action: "WITHDRAW_PILOT",
        resourceType: "PILOT_ENROLLMENT",
        resourceId: enrollment.id,
        purpose: "CONTROLLED_PILOT",
        outcome: "ALLOWED"
      });
    }
    await recordProductEvent({
      client: transaction,
      userId: input.userId,
      eventName: "PILOT_WITHDRAWN",
      properties: { clubLinked: Boolean(enrollment.teamId) }
    });
    return { id: updated.id, status: updated.status, withdrawnAt: updated.withdrawnAt };
  }, { isolationLevel: "Serializable" });
}

export async function listPilotEnrollments(userId: string) {
  return prisma.pilotEnrollment.findMany({
    where: { userId },
    select: { id: true, status: true, enrolledAt: true, withdrawnAt: true, teamId: true, cohort: { select: { id: true, name: true, label: true, endsAt: true } } },
    orderBy: { enrolledAt: "desc" }
  });
}
