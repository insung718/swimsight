import "server-only";
import { randomBytes } from "node:crypto";
import { buildDashboardAnalytics, type PredictionReleaseContext } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { fromPrismaEvent, toSwimResult } from "@/lib/prisma-mappers";
import { CannotJoinOwnedGroupError } from "@/lib/services/join-errors";
import { getApprovedHundredFreeChampionReleases } from "@/lib/services/model-governance-service";
import {
  ATHLETE_SHARE_CONSENT_VERSION,
  ATHLETE_SHARE_SCOPES,
  appendAccessAudit,
  hasAthleteShareScope,
  type AthleteShareScope
} from "@/lib/services/access-audit-service";
import type { CoachClubSummary, CoachDashboardData, CoachSwimmerAnalytics, Goal } from "@/types/swim";

const joinCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createJoinCode() {
  return Array.from(randomBytes(8), (byte) => joinCodeAlphabet[byte % joinCodeAlphabet.length]).join("");
}

function toGoal(record: {
  id: string;
  userId: string;
  event: string;
  course: "LCM" | "SCM" | "SCY";
  targetTime: number;
  qualifyingTime?: number | null;
  targetDate: Date;
}): Goal {
  return {
    id: record.id,
    userId: record.userId,
    event: fromPrismaEvent(record.event),
    course: record.course,
    targetTime: record.targetTime,
    qualifyingTime: record.qualifyingTime,
    targetDate: record.targetDate.toISOString().slice(0, 10)
  };
}

function swimmerAnalytics(member: {
  createdAt: Date;
  user: {
    id: string;
    name: string;
    imageUrl?: string | null;
    age?: number | null;
    sex?: "FEMALE" | "MALE" | null;
    taperDays?: number | null;
    swimSessionsPerWeek?: number | null;
    swims: Array<{
      id: string;
      userId: string;
      date: Date;
      event: string;
      course: string;
      timeSeconds: number;
      meetName: string;
      source?: string;
      resultKind?: string;
      raceType?: string;
      notes?: string | null;
    }>;
    goals: Array<{
      id: string;
      userId: string;
      event: string;
      course: "LCM" | "SCM" | "SCY";
      targetTime: number;
      qualifyingTime?: number | null;
      targetDate: Date;
    }>;
    upcomingMeets?: Array<{ id: string }>;
    importBatches?: Array<{ status: string }>;
    predictionSnapshots?: Array<{ evaluatedAt: Date | null }>;
  };
}, releaseContext: PredictionReleaseContext, scopes: AthleteShareScope[]): CoachSwimmerAnalytics {
  const swims = member.user.swims.map(toSwimResult);
  const goals = hasAthleteShareScope(scopes, "GOALS") ? member.user.goals.map(toGoal) : [];
  const analytics = buildDashboardAnalytics(swims, goals[0], [], {
    age: member.user.age,
    sex: member.user.sex,
    taperDays: member.user.taperDays,
    swimSessionsPerWeek: member.user.swimSessionsPerWeek
  }, releaseContext);
  const latest = swims[swims.length - 1];
  const strongest = analytics.strongestEvents[0];

  return {
    id: member.user.id,
    name: member.user.name,
    imageUrl: member.user.imageUrl,
    joinedAt: member.createdAt.toISOString(),
    totalSwims: swims.length,
    activeGoals: hasAthleteShareScope(scopes, "GOALS") ? goals.length : 0,
    strongestEvent: analytics.overview.bestEvent,
    mostImprovedEvent: analytics.overview.mostImprovedEvent,
    swimPowerIndex: analytics.swimPowerIndex.score,
    yearlyImprovement: analytics.overview.yearlyImprovement,
    consistencyScore: strongest?.consistencyScore ?? 0,
    latestResult: latest
      ? {
          event: latest.event,
          course: latest.course,
          timeSeconds: latest.timeSeconds,
          date: latest.date
        }
      : undefined,
    progression: swims.slice(-12).map((swim) => ({
      date: swim.date,
      event: swim.event,
      course: swim.course,
      timeSeconds: swim.timeSeconds
    })),
    dataQualityStatus: swims.filter((swim) => (swim.resultKind ?? "OFFICIAL") === "OFFICIAL" && (swim.raceType ?? "INDIVIDUAL") === "INDIVIDUAL").length >= 10
      ? "READY"
      : swims.length >= 3 ? "BUILDING" : "INSUFFICIENT",
    importStatus: member.user.importBatches?.some((batch) => batch.status === "COMMITTED" || batch.status === "PARTIALLY_COMMITTED") ? "COMPLETE" : "NOT_STARTED",
    predictionEligible: hasAthleteShareScope(scopes, "PREDICTIONS")
      && analytics.predictions.some((prediction) => prediction.model.dataQuality.decision === "FULL_PREDICTION" || prediction.model.dataQuality.decision === "CONSERVATIVE_ESTIMATE"),
    upcomingMeetCount: hasAthleteShareScope(scopes, "UPCOMING_MEETS") ? member.user.upcomingMeets?.length ?? 0 : 0,
    postMeetEvaluationCount: member.user.predictionSnapshots?.filter((snapshot) => snapshot.evaluatedAt).length ?? 0
  };
}

function dashboardOverview(clubs: CoachClubSummary[]): CoachDashboardData["overview"] {
  const swimmers = clubs.flatMap((club) => club.swimmers);
  const unique = Array.from(new Map(swimmers.map((swimmer) => [swimmer.id, swimmer])).values());
  const averageSpi = unique.length
    ? Math.round(unique.reduce((sum, swimmer) => sum + swimmer.swimPowerIndex, 0) / unique.length)
    : 0;

  return {
    clubCount: clubs.length,
    swimmerCount: unique.length,
    totalSwims: unique.reduce((sum, swimmer) => sum + swimmer.totalSwims, 0),
    averageSpi,
    topImprover: [...unique].sort((a, b) => b.yearlyImprovement - a.yearlyImprovement)[0]
  };
}

function clubSummary(team: {
  id: string;
  name: string;
  description?: string | null;
  joinCode: string;
  memberships?: unknown[];
  _count?: { memberships: number };
}): CoachClubSummary {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    joinCode: team.joinCode,
    memberCount: team._count?.memberships ?? team.memberships?.length ?? 0,
    permissionPendingCount: 0,
    dataReadyCount: 0,
    swimmers: []
  };
}

export async function getCoachDashboard(coachId: string): Promise<CoachDashboardData> {
  const [teams, hundredFreeChampionReleases] = await Promise.all([
    prisma.team.findMany({
      where: {
        OR: [
          { ownerId: coachId },
          { memberships: { some: { userId: coachId, role: { in: ["OWNER", "COACH"] } } } }
        ]
      },
      include: {
        memberships: {
          where: { role: "SWIMMER" },
          orderBy: { createdAt: "asc" },
          select: { userId: true, createdAt: true, user: { select: { id: true, name: true, imageUrl: true } } }
        },
        shareGrants: { where: { status: "ACTIVE" }, select: { athleteId: true, status: true, scopes: true } }
      },
      orderBy: { createdAt: "asc" },
      take: 50
    }),
    getApprovedHundredFreeChampionReleases()
  ]);
  const releaseContext = { hundredFreeChampionReleases };
  const authorizedPairs = teams.flatMap((team) => {
    const resultsShared = new Set(team.shareGrants
      .filter((grant) => hasAthleteShareScope(grant.scopes, "RESULTS"))
      .map((grant) => grant.athleteId));
    return team.memberships.filter((membership) => resultsShared.has(membership.userId)).map((membership) => ({ teamId: team.id, membership }));
  });
  const authorizedAthleteIds = [...new Set(authorizedPairs.map(({ membership }) => membership.userId))];
  const athleteRecords = authorizedAthleteIds.length ? await prisma.user.findMany({
    where: { id: { in: authorizedAthleteIds } },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      age: true,
      sex: true,
      taperDays: true,
      swimSessionsPerWeek: true,
      swims: { orderBy: [{ date: "asc" }, { createdAt: "asc" }], take: 2_000 },
      goals: { orderBy: { targetDate: "asc" }, take: 20 },
      upcomingMeets: { where: { startDate: { gte: new Date() } }, select: { id: true }, take: 20 },
      importBatches: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
      predictionSnapshots: { select: { evaluatedAt: true }, where: { evaluatedAt: { not: null } }, take: 1_000 }
    }
  }) : [];
  const athleteById = new Map(athleteRecords.map((athlete) => [athlete.id, athlete]));
  const clubs = teams.map((team) => {
    const grantByAthlete = new Map(team.shareGrants.map((grant) => [grant.athleteId, grant]));
    const shared = new Set(team.shareGrants
      .filter((grant) => hasAthleteShareScope(grant.scopes, "RESULTS"))
      .map((grant) => grant.athleteId));
    const swimmers = team.memberships.flatMap((membership) => {
      const athlete = shared.has(membership.userId) ? athleteById.get(membership.userId) : undefined;
      const grant = grantByAthlete.get(membership.userId);
      const scopes = Array.isArray(grant?.scopes)
        ? grant.scopes.filter((scope): scope is AthleteShareScope => typeof scope === "string" && ATHLETE_SHARE_SCOPES.includes(scope as AthleteShareScope))
        : [];
      return athlete ? [swimmerAnalytics({ createdAt: membership.createdAt, user: athlete }, releaseContext, scopes)] : [];
    });
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      joinCode: team.joinCode,
      memberCount: team.memberships.length,
      permissionPendingCount: team.memberships.filter((membership) => !shared.has(membership.userId)).length,
      dataReadyCount: swimmers.filter((swimmer) => swimmer.dataQualityStatus === "READY").length,
      swimmers
    };
  });

  if (authorizedPairs.length) {
    await prisma.$transaction(async (transaction) => {
      for (const { teamId, membership } of authorizedPairs) {
        await appendAccessAudit(transaction, {
          actorId: coachId,
          subjectUserId: membership.userId,
          teamId,
          action: "VIEW_ATHLETE_ANALYTICS",
          resourceType: "ATHLETE_ANALYTICS",
          resourceId: membership.userId,
          purpose: "COACH_DASHBOARD",
          outcome: "ALLOWED",
          metadata: { scope: "ROSTER_SUMMARY" }
        });
      }
    }, { isolationLevel: "Serializable" });
  }

  return {
    clubs,
    overview: dashboardOverview(clubs)
  };
}

export async function createCoachClub(input: {
  coachId: string;
  name: string;
  description?: string;
}) {
  const team = await prisma.$transaction(async (transaction) => {
    const currentClubCount = await transaction.team.count({ where: { ownerId: input.coachId } });
    if (currentClubCount >= 20) throw new Error("COACH_CLUB_LIMIT_REACHED");
    return transaction.team.create({
      data: {
        ownerId: input.coachId,
        name: input.name,
        description: input.description,
        joinCode: createJoinCode(),
        memberships: {
          create: {
            userId: input.coachId,
            role: "OWNER"
          }
        }
      }
    });
  }, { isolationLevel: "Serializable" });

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    joinCode: team.joinCode,
    memberCount: 0,
    permissionPendingCount: 0,
    dataReadyCount: 0,
    swimmers: []
  } satisfies CoachClubSummary;
}

export async function listCoachClubsForSwimmer(userId: string) {
  const memberships = await prisma.teamMembership.findMany({
    where: {
      userId,
      role: "SWIMMER"
    },
    include: {
      team: {
        include: {
          _count: {
            select: {
              memberships: { where: { role: "SWIMMER" } }
            }
          },
          shareGrants: { where: { athleteId: userId }, select: { status: true }, take: 1 }
        }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 50
  });

  return memberships.map((membership) => ({
    ...clubSummary(membership.team),
    joinCode: "",
    sharingStatus: membership.team.shareGrants[0]?.status ?? "WITHDRAWN"
  }));
}

export async function joinCoachClub(input: { userId: string; joinCode: string }) {
  const team = await prisma.team.findFirst({
    where: {
      joinCode: {
        equals: input.joinCode,
        mode: "insensitive"
      }
    },
    include: {
      memberships: {
        where: { userId: input.userId },
        select: { role: true },
        take: 1
      }
    }
  });

  if (!team) return null;
  const currentMembership = team.memberships[0];
  if (team.ownerId === input.userId || currentMembership?.role === "OWNER" || currentMembership?.role === "COACH") {
    throw new CannotJoinOwnedGroupError("coach club");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.teamMembership.upsert({
      where: { teamId_userId: { teamId: team.id, userId: input.userId } },
      update: {},
      create: { teamId: team.id, userId: input.userId, role: "SWIMMER" }
    });
    await transaction.athleteShareGrant.upsert({
      where: { athleteId_teamId: { athleteId: input.userId, teamId: team.id } },
      update: {
        status: "ACTIVE",
        grantedById: input.userId,
        consentVersion: ATHLETE_SHARE_CONSENT_VERSION,
        scopes: [...ATHLETE_SHARE_SCOPES],
        grantedAt: new Date(),
        withdrawnAt: null
      },
      create: {
        athleteId: input.userId,
        teamId: team.id,
        grantedById: input.userId,
        consentVersion: ATHLETE_SHARE_CONSENT_VERSION,
        scopes: [...ATHLETE_SHARE_SCOPES]
      }
    });
    await appendAccessAudit(transaction, {
      actorId: input.userId,
      subjectUserId: input.userId,
      teamId: team.id,
      action: "GRANT_COACH_ACCESS",
      resourceType: "ATHLETE_SHARE_GRANT",
      resourceId: input.userId,
      purpose: "CLUB_JOIN",
      outcome: "ALLOWED",
      metadata: { consentVersion: ATHLETE_SHARE_CONSENT_VERSION }
    });
  }, { isolationLevel: "Serializable" });

  const updated = await prisma.team.findUniqueOrThrow({
    where: { id: team.id },
    include: {
      _count: {
        select: {
          memberships: { where: { role: "SWIMMER" } }
        }
      }
    }
  });

  return {
    ...clubSummary(updated),
    joinCode: "",
    sharingStatus: "ACTIVE" as const
  };
}

export async function updateCoachShareGrant(input: { userId: string; teamId: string; action: "GRANT" | "WITHDRAW" }) {
  return prisma.$transaction(async (transaction) => {
    const membership = await transaction.teamMembership.findUnique({
      where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
      select: { role: true }
    });
    if (membership?.role !== "SWIMMER") return null;
    const grant = await transaction.athleteShareGrant.upsert({
      where: { athleteId_teamId: { athleteId: input.userId, teamId: input.teamId } },
      update: {
        status: input.action === "GRANT" ? "ACTIVE" : "WITHDRAWN",
        grantedById: input.userId,
        scopes: [...ATHLETE_SHARE_SCOPES],
        consentVersion: ATHLETE_SHARE_CONSENT_VERSION,
        grantedAt: input.action === "GRANT" ? new Date() : undefined,
        withdrawnAt: input.action === "WITHDRAW" ? new Date() : null
      },
      create: {
        athleteId: input.userId,
        teamId: input.teamId,
        grantedById: input.userId,
        status: input.action === "GRANT" ? "ACTIVE" : "WITHDRAWN",
        scopes: [...ATHLETE_SHARE_SCOPES],
        consentVersion: ATHLETE_SHARE_CONSENT_VERSION,
        withdrawnAt: input.action === "WITHDRAW" ? new Date() : null
      }
    });
    await appendAccessAudit(transaction, {
      actorId: input.userId,
      subjectUserId: input.userId,
      teamId: input.teamId,
      action: input.action === "GRANT" ? "GRANT_COACH_ACCESS" : "WITHDRAW_COACH_ACCESS",
      resourceType: "ATHLETE_SHARE_GRANT",
      resourceId: grant.id,
      purpose: "ATHLETE_PRIVACY_CONTROL",
      outcome: "ALLOWED",
      metadata: { consentVersion: ATHLETE_SHARE_CONSENT_VERSION }
    });
    return { teamId: input.teamId, status: grant.status };
  }, { isolationLevel: "Serializable" });
}

export async function coachCanManageClub(coachId: string, clubId: string) {
  const membership = await prisma.teamMembership.findUnique({
    where: {
      teamId_userId: {
        teamId: clubId,
        userId: coachId
      }
    }
  });

  return membership?.role === "OWNER" || membership?.role === "COACH";
}

export async function coachHasManagedClub(coachId: string) {
  return (await prisma.teamMembership.count({
    where: { userId: coachId, role: { in: ["OWNER", "COACH"] } }
  })) > 0;
}
