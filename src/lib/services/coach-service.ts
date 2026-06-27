import "server-only";
import { randomBytes } from "node:crypto";
import { buildDashboardAnalytics } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { fromPrismaEvent, toSwimResult } from "@/lib/prisma-mappers";
import type { CoachClubSummary, CoachDashboardData, CoachSwimmerAnalytics, Goal } from "@/types/swim";

const joinCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createJoinCode() {
  return Array.from(randomBytes(8), (byte) => joinCodeAlphabet[byte % joinCodeAlphabet.length]).join("");
}

function toGoal(record: {
  id: string;
  userId: string;
  event: string;
  targetTime: number;
  targetDate: Date;
}): Goal {
  return {
    id: record.id,
    userId: record.userId,
    event: fromPrismaEvent(record.event),
    targetTime: record.targetTime,
    targetDate: record.targetDate.toISOString().slice(0, 10)
  };
}

function swimmerAnalytics(member: {
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    imageUrl?: string | null;
    swims: Array<{
      id: string;
      userId: string;
      date: Date;
      event: string;
      course: string;
      timeSeconds: number;
      meetName: string;
      source?: string;
      notes?: string | null;
    }>;
    goals: Array<{
      id: string;
      userId: string;
      event: string;
      targetTime: number;
      targetDate: Date;
    }>;
  };
}): CoachSwimmerAnalytics {
  const swims = member.user.swims.map(toSwimResult);
  const goals = member.user.goals.map(toGoal);
  const analytics = buildDashboardAnalytics(swims, goals[0]);
  const latest = swims[swims.length - 1];
  const strongest = analytics.strongestEvents[0];

  return {
    id: member.user.id,
    name: member.user.name,
    email: member.user.email,
    imageUrl: member.user.imageUrl,
    joinedAt: member.createdAt.toISOString(),
    totalSwims: swims.length,
    activeGoals: goals.length,
    strongestEvent: analytics.overview.bestEvent,
    mostImprovedEvent: analytics.overview.mostImprovedEvent,
    swimPowerIndex: analytics.swimPowerIndex.score,
    yearlyImprovement: analytics.overview.yearlyImprovement,
    consistencyScore: strongest?.consistencyScore ?? 0,
    latestResult: latest
      ? {
          event: latest.event,
          timeSeconds: latest.timeSeconds,
          date: latest.date
        }
      : undefined,
    progression: swims.slice(-12).map((swim) => ({
      date: swim.date,
      event: swim.event,
      timeSeconds: swim.timeSeconds
    }))
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
}): CoachClubSummary {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    joinCode: team.joinCode,
    memberCount: team.memberships?.length ?? 0,
    swimmers: []
  };
}

export async function getCoachDashboard(coachId: string): Promise<CoachDashboardData> {
  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { ownerId: coachId },
        {
          memberships: {
            some: {
              userId: coachId,
              role: { in: ["OWNER", "COACH"] }
            }
          }
        }
      ]
    },
    include: {
      memberships: {
        where: { role: "SWIMMER" },
        orderBy: { createdAt: "asc" },
        include: {
          user: {
            include: {
              swims: {
                orderBy: [{ date: "asc" }, { createdAt: "asc" }],
                take: 2_000
              },
              goals: {
                orderBy: { targetDate: "asc" },
                take: 20
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 50
  });

  const clubs = teams.map((team) => ({
    id: team.id,
    name: team.name,
    description: team.description,
    joinCode: team.joinCode,
    memberCount: team.memberships.length,
    swimmers: team.memberships.map(swimmerAnalytics)
  }));

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
  const team = await prisma.team.create({
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

  return {
    id: team.id,
    name: team.name,
    description: team.description,
    joinCode: team.joinCode,
    memberCount: 0,
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
        include: { memberships: true }
      }
    },
    orderBy: { createdAt: "asc" },
    take: 50
  });

  return memberships.map((membership) => ({
    ...clubSummary(membership.team),
    joinCode: ""
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
    include: { memberships: true }
  });

  if (!team) return null;

  await prisma.teamMembership.upsert({
    where: {
      teamId_userId: {
        teamId: team.id,
        userId: input.userId
      }
    },
    update: {},
    create: {
      teamId: team.id,
      userId: input.userId,
      role: "SWIMMER"
    }
  });

  const updated = await prisma.team.findUniqueOrThrow({
    where: { id: team.id },
    include: { memberships: true }
  });

  return {
    ...clubSummary(updated),
    joinCode: ""
  };
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
