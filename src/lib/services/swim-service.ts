import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { buildDashboardAnalytics } from "@/lib/analytics";
import { hasDatabaseConfig, prisma } from "@/lib/prisma";
import { fromPrismaEvent, toPrismaCourse, toPrismaEvent, toSwimResult } from "@/lib/prisma-mappers";
import { getGymWorkoutsForUser } from "@/lib/services/gym-service";
import { listUpcomingMeets } from "@/lib/services/meet-service";
import { getApprovedHundredFreeChampionReleases } from "@/lib/services/model-governance-service";
import { evaluatePredictionSnapshotsForResult, syncPredictionSnapshots } from "@/lib/services/prediction-evaluation-service";
import type { Course, DashboardAnalytics, Goal, SwimEvent, SwimRaceType, SwimResult, SwimResultKind } from "@/types/swim";

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
  raceType?: SwimRaceType;
  provenance?: Prisma.InputJsonValue;
}

export class DuplicateSwimError extends Error {
  constructor() {
    super("This result has already been recorded.");
    this.name = "DuplicateSwimError";
  }
}

function swimDedupeKey(input: CreateSwimInput) {
  const canonical = [
    input.userId,
    input.date,
    input.event,
    input.course,
    input.timeSeconds.toFixed(3),
    input.meetName.normalize("NFKC").trim().toLocaleLowerCase("en"),
    input.resultKind ?? "OFFICIAL",
    input.raceType ?? "INDIVIDUAL"
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

function swimCreateData(input: CreateSwimInput) {
  return {
    userId: input.userId,
    date: new Date(`${input.date}T00:00:00.000Z`),
    event: toPrismaEvent(input.event),
    course: toPrismaCourse(input.course),
    timeSeconds: input.timeSeconds,
    meetName: input.meetName,
    notes: input.notes,
    provenance: input.provenance ?? { method: input.source ?? "MANUAL", parserVersion: "direct-v1" },
    source: input.source ?? "MANUAL" as const,
    resultKind: input.resultKind ?? "OFFICIAL" as const,
    raceType: input.raceType ?? "INDIVIDUAL" as const,
    dedupeKey: swimDedupeKey(input)
  };
}

interface CreateGoalInput {
  userId: string;
  event: SwimEvent;
  course: Course;
  targetTime: number;
  qualifyingTime?: number | null;
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
  let swim;
  try {
    swim = await prisma.$transaction(async (transaction) => {
      const created = await transaction.swimResult.create({ data: swimCreateData(input) });
      await evaluatePredictionSnapshotsForResult(transaction, created);
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DuplicateSwimError();
    throw error;
  }

  return toSwimResult(swim);
}

export async function createManySwims(rows: CreateSwimInput[]) {
  const data = rows.map((input) => swimCreateData({ ...input, source: input.source ?? "CSV" }));
  if (new Set(data.map((row) => row.dedupeKey)).size !== data.length) throw new DuplicateSwimError();

  try {
    const swims = await prisma.$transaction(async (transaction) => {
      const existing = await transaction.swimResult.findFirst({
        where: { dedupeKey: { in: data.map((row) => row.dedupeKey) } },
        select: { id: true }
      });
      if (existing) throw new DuplicateSwimError();
      const created = await transaction.swimResult.createManyAndReturn({ data });
      for (const swim of created) await evaluatePredictionSnapshotsForResult(transaction, swim);
      return created;
    });
    return swims.map(toSwimResult);
  } catch (error) {
    if (error instanceof DuplicateSwimError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DuplicateSwimError();
    throw error;
  }
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
    course: goal.course,
    targetTime: goal.targetTime,
    qualifyingTime: goal.qualifyingTime,
    targetDate: goal.targetDate.toISOString().slice(0, 10)
  };
}

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const goal = await prisma.goal.create({
    data: {
      userId: input.userId,
      event: toPrismaEvent(input.event),
      course: input.course,
      targetTime: input.targetTime,
      qualifyingTime: input.qualifyingTime,
      targetDate: new Date(input.targetDate)
    }
  });

  return {
    id: goal.id,
    userId: goal.userId,
    event: input.event,
    course: goal.course,
    targetTime: goal.targetTime,
    qualifyingTime: goal.qualifyingTime,
    targetDate: goal.targetDate.toISOString().slice(0, 10)
  };
}

export async function getDashboardAnalyticsForUser(userId: string): Promise<DashboardAnalytics> {
  const [swims, goal, workouts, profile, meets, hundredFreeChampionReleases] = await Promise.all([
    getSwimsForUser(userId),
    getPrimaryGoal(userId),
    getGymWorkoutsForUser(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { age: true, sex: true, taperDays: true, swimSessionsPerWeek: true }
    }),
    listUpcomingMeets(userId),
    getApprovedHundredFreeChampionReleases()
  ]);

  const analytics = buildDashboardAnalytics(swims, goal ?? undefined, workouts, profile ?? {}, { hundredFreeChampionReleases });
  await syncPredictionSnapshots({ userId, predictions: analytics.predictions, swims, profile: profile ?? {}, goal: goal ?? undefined, meets });
  return analytics;
}
