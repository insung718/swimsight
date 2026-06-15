import { buildDashboardAnalytics } from "@/lib/analytics";
import { hasDatabaseConfig, prisma } from "@/lib/prisma";
import { fromPrismaEvent, toPrismaCourse, toPrismaEvent, toSwimResult } from "@/lib/prisma-mappers";
import { sampleGoals, sampleSwims } from "@/lib/sample-data";
import type { Course, DashboardAnalytics, Goal, SwimEvent, SwimResult } from "@/types/swim";

interface CreateSwimInput {
  userId: string;
  date: string;
  event: SwimEvent;
  course: Course;
  timeSeconds: number;
  meetName: string;
  notes?: string;
  source?: "MANUAL" | "CSV" | "MEET_IMPORT";
}

interface CreateGoalInput {
  userId: string;
  event: SwimEvent;
  targetTime: number;
  targetDate: string;
}

export async function getSwimsForUser(userId?: string): Promise<SwimResult[]> {
  if (!hasDatabaseConfig() || !userId) {
    return sampleSwims;
  }

  const swims = await prisma.swimResult.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }]
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
      source: input.source ?? "MANUAL"
    }
  });

  return toSwimResult(swim);
}

export async function createManySwims(rows: CreateSwimInput[]) {
  const swims = await Promise.all(rows.map((row) => createSwim(row)));
  return swims;
}

export async function getPrimaryGoal(userId?: string): Promise<Goal> {
  if (!hasDatabaseConfig() || !userId) {
    return sampleGoals[0];
  }

  const goal = await prisma.goal.findFirst({
    where: { userId },
    orderBy: { targetDate: "asc" }
  });

  if (!goal) {
    return {
      id: "default-goal",
      userId,
      event: "100 Butterfly",
      targetTime: 59,
      targetDate: "2027-03-01"
    };
  }

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

export async function getDashboardAnalyticsForUser(userId?: string): Promise<DashboardAnalytics> {
  const swims = await getSwimsForUser(userId);
  const goal = await getPrimaryGoal(userId);

  return buildDashboardAnalytics(swims.length ? swims : sampleSwims, goal);
}
