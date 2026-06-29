import "server-only";
import { buildDashboardAnalytics } from "@/lib/analytics";
import { hasDatabaseConfig, prisma } from "@/lib/prisma";
import { fromPrismaEvent, toPrismaCourse, toPrismaEvent, toSwimResult } from "@/lib/prisma-mappers";
import { getGymWorkoutsForUser } from "@/lib/services/gym-service";
import type { Course, DashboardAnalytics, Goal, SwimEvent, SwimResult, SwimResultKind } from "@/types/swim";

interface CreateSwimInput {
  userId: string;
  date: string;
  event: SwimEvent;
  course: Course;
  timeSeconds: number;
  meetName: string;
  notes?: string;
  source?: "MANUAL" | "CSV" | "MEET_IMPORT";
  resultKind?: SwimResultKind;
}

interface CreateGoalInput {
  userId: string;
  event: SwimEvent;
  targetTime: number;
  targetDate: string;
}

export async function getSwimsForUser(userId: string): Promise<SwimResult[]> {
  if (!hasDatabaseConfig()) {
    return [];
  }

  const swims = await prisma.swimResult.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: 2_000
  });

  return swims.map(toSwimResult);
}

export async function createSwim(input: CreateSwimInput) {
  const swim = await prisma.swimResult.create({
    data: {
      userId: input.userId,
      date: new Date(input.date),
      event: toPrismaEvent(input.event),
      course: toPrismaCourse(input.course),
      timeSeconds: input.timeSeconds,
      meetName: input.meetName,
      notes: input.notes,
      source: input.source ?? "MANUAL",
      resultKind: input.resultKind ?? "OFFICIAL"
    }
  });

  return toSwimResult(swim);
}

export async function createManySwims(rows: CreateSwimInput[]) {
  const swims = await prisma.$transaction(rows.map((input) => prisma.swimResult.create({
    data: {
      userId: input.userId,
      date: new Date(input.date),
      event: toPrismaEvent(input.event),
      course: toPrismaCourse(input.course),
      timeSeconds: input.timeSeconds,
      meetName: input.meetName,
      notes: input.notes,
      source: input.source ?? "CSV",
      resultKind: input.resultKind ?? "OFFICIAL"
    }
  })));
  return swims.map(toSwimResult);
}

export async function getPrimaryGoal(userId: string): Promise<Goal | null> {
  if (!hasDatabaseConfig()) {
    return null;
  }

  const goal = await prisma.goal.findFirst({
    where: { userId },
    orderBy: { targetDate: "asc" }
  });

  if (!goal) return null;

  return {
    id: goal.id,
    userId: goal.userId,
    event: fromPrismaEvent(goal.event),
    targetTime: goal.targetTime,
    targetDate: goal.targetDate.toISOString().slice(0, 10)
  };
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const goal = await prisma.goal.create({
    data: {
      userId: input.userId,
      event: toPrismaEvent(input.event),
      targetTime: input.targetTime,
      targetDate: new Date(input.targetDate)
    }
  });

  return {
    id: goal.id,
    userId: goal.userId,
    event: input.event,
    targetTime: goal.targetTime,
    targetDate: goal.targetDate.toISOString().slice(0, 10)
  };
}

export async function getDashboardAnalyticsForUser(userId: string): Promise<DashboardAnalytics> {
  const [swims, goal, workouts] = await Promise.all([
    getSwimsForUser(userId),
    getPrimaryGoal(userId),
    getGymWorkoutsForUser(userId)
  ]);

  return buildDashboardAnalytics(swims, goal ?? undefined, workouts);
}
