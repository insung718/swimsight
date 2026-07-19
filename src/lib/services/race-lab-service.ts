import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fromPrismaEvent, toPrismaEvent } from "@/lib/prisma-mappers";
import {
  RACE_LAB_ENGINE_VERSION,
  RaceLabValidationError,
  analyzeRaceShape,
  buildSegmentsFromCumulative,
  estimateRaceSegments,
  generateGoalRace,
  getEventDistance,
  getSegmentCount,
  rebuildEditableGoal,
  simulateRace,
  type RaceLabState,
  type RacePacingStrategy,
  type RaceSegment,
  type SavedRaceLabScenario,
  type SimulationSettings,
  type StoredRaceSplit
} from "@/lib/race-lab";
import type { Course, SwimEvent } from "@/types/swim";

type SourceSplit = Exclude<RaceSegment["source"], "SIMULATED">;

export class RaceLabNotFoundError extends Error {
  constructor(message = "Race Lab resource not found.") {
    super(message);
    this.name = "RaceLabNotFoundError";
  }
}

export class RaceLabConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RaceLabConflictError";
  }
}

function jsonSnapshot(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function splitRecordToDto(record: {
  id: string;
  swimResultId: string;
  segmentIndex: number;
  segmentDistance: number;
  cumulativeDistance: number;
  segmentTime: number;
  cumulativeTime: number;
  source: string;
  precision: string;
  note: string | null;
}): StoredRaceSplit {
  return {
    id: record.id,
    raceId: record.swimResultId,
    segmentIndex: record.segmentIndex,
    segmentDistance: record.segmentDistance,
    cumulativeDistance: record.cumulativeDistance,
    segmentTime: record.segmentTime,
    cumulativeTime: record.cumulativeTime,
    source: record.source as SourceSplit,
    precision: record.precision as RaceSegment["precision"],
    note: record.note ?? undefined
  };
}

function scenarioRecordToDto(record: {
  id: string;
  baseResultId: string | null;
  kind: string;
  event: string;
  course: string;
  name: string;
  strategy: string | null;
  targetTime: number | null;
  projectedTime: number;
  settings: Prisma.JsonValue;
  segments: Prisma.JsonValue;
  engineVersion: string;
  createdAt: Date;
}): SavedRaceLabScenario {
  const settings = record.settings && typeof record.settings === "object" && !Array.isArray(record.settings)
    ? record.settings as Record<string, unknown>
    : {};
  const segments = Array.isArray(record.segments) ? record.segments as unknown as RaceSegment[] : [];
  return {
    id: record.id,
    baseResultId: record.baseResultId ?? undefined,
    kind: record.kind as SavedRaceLabScenario["kind"],
    event: fromPrismaEvent(record.event),
    course: record.course as Course,
    name: record.name,
    strategy: record.strategy as RacePacingStrategy | undefined,
    targetTime: record.targetTime ?? undefined,
    projectedTime: record.projectedTime,
    settings,
    segments,
    engineVersion: record.engineVersion,
    createdAt: record.createdAt.toISOString()
  };
}

async function getOwnedRace(userId: string, raceId: string) {
  const race = await prisma.swimResult.findFirst({
    where: { id: raceId, userId },
    select: {
      id: true,
      userId: true,
      event: true,
      course: true,
      timeSeconds: true,
      resultKind: true,
      raceType: true,
      date: true
    }
  });
  if (!race) throw new RaceLabNotFoundError();
  const event = fromPrismaEvent(race.event);
  if (!getEventDistance(event)) throw new RaceLabValidationError("Race Lab supports 50, 100, 200, and 400 distance events.");
  if (race.resultKind !== "OFFICIAL") throw new RaceLabValidationError("Race Lab v1 uses official race results as its source record.");
  if (race.raceType === "RELAY_SPLIT" || race.raceType === "CONVERTED") {
    throw new RaceLabValidationError("Relay splits and converted results are not eligible source races in Race Lab v1.");
  }
  return { ...race, event, course: race.course as Course };
}

function rowsToValidatedSegments(input: {
  rows: StoredRaceSplit[];
  event: SwimEvent;
  course: Course;
  totalTime: number;
}) {
  const priority: SourceSplit[] = ["OFFICIAL", "MANUAL", "ESTIMATED"];
  for (const source of priority) {
    const rows = input.rows.filter((row) => row.source === source).sort((a, b) => a.segmentIndex - b.segmentIndex);
    if (!rows.length) continue;
    try {
      const rebuilt = buildSegmentsFromCumulative({
        event: input.event,
        course: input.course,
        cumulativeTimes: rows.map((row) => row.cumulativeTime),
        source,
        precision: rows[0].precision,
        totalTime: input.totalTime,
        note: rows[0].note
      });
      return rebuilt;
    } catch {
      continue;
    }
  }
  return null;
}

async function splitRowsForRace(userId: string, raceId: string) {
  const rows = await prisma.raceSplit.findMany({
    where: { userId, swimResultId: raceId },
    orderBy: [{ source: "asc" }, { segmentIndex: "asc" }],
    take: 64
  });
  return rows.map(splitRecordToDto);
}

async function ensureEstimatedSegments(userId: string, race: Awaited<ReturnType<typeof getOwnedRace>>) {
  if (getSegmentCount(race.event, race.course) === 1) {
    return buildSegmentsFromCumulative({
      event: race.event,
      course: race.course,
      cumulativeTimes: [race.timeSeconds],
      source: "OFFICIAL",
      totalTime: race.timeSeconds,
      note: "The official finish time is the only pool-length segment."
    });
  }
  const existingRows = await splitRowsForRace(userId, race.id);
  const valid = rowsToValidatedSegments({ rows: existingRows, event: race.event, course: race.course, totalTime: race.timeSeconds });
  if (valid) return valid;

  const estimated = estimateRaceSegments({
    event: race.event,
    course: race.course,
    totalTime: race.timeSeconds,
    note: "Estimated from finish time; not an official timing-pad split."
  });
  await prisma.raceSplit.createMany({
    data: estimated.map((segment) => ({
      userId,
      swimResultId: race.id,
      segmentIndex: segment.segmentIndex,
      segmentDistance: segment.segmentDistance,
      cumulativeDistance: segment.cumulativeDistance,
      segmentTime: segment.segmentTime,
      cumulativeTime: segment.cumulativeTime,
      source: "ESTIMATED" as const,
      precision: "TENTH" as const,
      note: segment.note
    })),
    skipDuplicates: true
  });
  return estimated;
}

export async function getRaceLabState(userId: string, raceIds: string[] = []): Promise<RaceLabState> {
  for (const raceId of raceIds) await getOwnedRace(userId, raceId);
  const [splits, scenarios] = await Promise.all([
    raceIds.length
      ? prisma.raceSplit.findMany({ where: { userId, swimResultId: { in: raceIds } }, orderBy: [{ source: "asc" }, { segmentIndex: "asc" }], take: 256 })
      : Promise.resolve([]),
    prisma.raceLabScenario.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 })
  ]);
  return {
    splits: splits.map(splitRecordToDto),
    scenarios: scenarios.map(scenarioRecordToDto)
  };
}

export async function saveManualRaceSplits(input: { userId: string; raceId: string; cumulativeTimes: number[] }) {
  const race = await getOwnedRace(input.userId, input.raceId);
  const segments = buildSegmentsFromCumulative({
    event: race.event,
    course: race.course,
    cumulativeTimes: input.cumulativeTimes,
    source: "MANUAL",
    precision: "HUNDREDTH",
    totalTime: race.timeSeconds,
    note: "Manually entered by the athlete."
  });

  await prisma.$transaction(async (transaction) => {
    const official = await transaction.raceSplit.findFirst({
      where: { userId: input.userId, swimResultId: race.id, source: "OFFICIAL" },
      select: { id: true }
    });
    if (official) throw new RaceLabConflictError("Official splits already exist for this race and cannot be replaced.");
    await transaction.raceSplit.deleteMany({ where: { userId: input.userId, swimResultId: race.id, source: "MANUAL" } });
    await transaction.raceSplit.createMany({
      data: segments.map((segment) => ({
        userId: input.userId,
        swimResultId: race.id,
        segmentIndex: segment.segmentIndex,
        segmentDistance: segment.segmentDistance,
        cumulativeDistance: segment.cumulativeDistance,
        segmentTime: segment.segmentTime,
        cumulativeTime: segment.cumulativeTime,
        source: "MANUAL" as const,
        precision: "HUNDREDTH" as const,
        note: segment.note
      }))
    });
  });
  return getRaceLabState(input.userId, [race.id]);
}

export async function generateEstimatedRaceSplits(input: { userId: string; raceId: string }) {
  const race = await getOwnedRace(input.userId, input.raceId);
  await ensureEstimatedSegments(input.userId, race);
  return getRaceLabState(input.userId, [race.id]);
}

async function getPreferredSegments(userId: string, race: Awaited<ReturnType<typeof getOwnedRace>>) {
  const rows = await splitRowsForRace(userId, race.id);
  return rowsToValidatedSegments({ rows, event: race.event, course: race.course, totalTime: race.timeSeconds })
    ?? ensureEstimatedSegments(userId, race);
}

export async function saveSimulationScenario(input: {
  userId: string;
  raceId: string;
  name: string;
  settings: SimulationSettings;
}) {
  const race = await getOwnedRace(input.userId, input.raceId);
  const baseSegments = await getPreferredSegments(input.userId, race);
  const simulation = simulateRace({ event: race.event, course: race.course, baseSegments, settings: input.settings });
  const shape = analyzeRaceShape(simulation.segments);
  await prisma.raceLabScenario.create({
    data: {
      userId: input.userId,
      baseResultId: race.id,
      kind: "SIMULATION",
      event: toPrismaEvent(race.event),
      course: race.course,
      name: input.name,
      projectedTime: simulation.projectedTime,
      settings: jsonSnapshot({ ...simulation.settings, label: simulation.label, raceShape: shape.primary }),
      segments: jsonSnapshot(simulation.segments),
      engineVersion: RACE_LAB_ENGINE_VERSION
    }
  });
  return getRaceLabState(input.userId, [race.id]);
}

async function historicalRaceShapes(userId: string, event: SwimEvent, course: Course) {
  const races = await prisma.swimResult.findMany({
    where: {
      userId,
      event: toPrismaEvent(event),
      course,
      resultKind: "OFFICIAL",
      raceType: { in: ["INDIVIDUAL", "TIME_TRIAL"] }
    },
    orderBy: { date: "desc" },
    take: 8,
    select: { id: true, timeSeconds: true }
  });
  if (!races.length) return [];
  const rows = await prisma.raceSplit.findMany({
    where: { userId, swimResultId: { in: races.map((race) => race.id) }, source: { in: ["OFFICIAL", "MANUAL"] } },
    orderBy: { segmentIndex: "asc" },
    take: 128
  });
  return [...races].sort((left, right) => left.timeSeconds - right.timeSeconds).flatMap((race) => {
    const raceRows = rows.filter((row) => row.swimResultId === race.id).map(splitRecordToDto);
    const segments = rowsToValidatedSegments({ rows: raceRows, event, course, totalTime: race.timeSeconds });
    return segments ? [segments] : [];
  });
}

export async function saveGoalRaceScenario(input: {
  userId: string;
  raceId: string;
  name: string;
  targetTime: number;
  strategy: RacePacingStrategy;
  segmentTimes?: number[];
}) {
  const race = await getOwnedRace(input.userId, input.raceId);
  const shapes = await historicalRaceShapes(input.userId, race.event, race.course);
  const generated = generateGoalRace({
    event: race.event,
    course: race.course,
    targetTime: input.targetTime,
    strategy: input.strategy,
    historicalShapes: shapes
  });
  const segments = input.segmentTimes
    ? rebuildEditableGoal({ event: race.event, course: race.course, targetTime: input.targetTime, segmentTimes: input.segmentTimes })
    : generated.segments;
  await prisma.raceLabScenario.create({
    data: {
      userId: input.userId,
      baseResultId: race.id,
      kind: "GOAL_RACE",
      event: toPrismaEvent(race.event),
      course: race.course,
      name: input.name,
      strategy: input.strategy,
      targetTime: input.targetTime,
      projectedTime: input.targetTime,
      settings: jsonSnapshot({
        strategy: input.strategy,
        athleteEdited: Boolean(input.segmentTimes),
        usedHistoricalShape: generated.usedHistoricalShape
      }),
      segments: jsonSnapshot(segments),
      engineVersion: RACE_LAB_ENGINE_VERSION
    }
  });
  return getRaceLabState(input.userId, [race.id]);
}

export async function deleteRaceLabScenario(input: { userId: string; scenarioId: string }) {
  const deleted = await prisma.raceLabScenario.deleteMany({ where: { id: input.scenarioId, userId: input.userId } });
  if (!deleted.count) throw new RaceLabNotFoundError("Saved scenario not found.");
  return getRaceLabState(input.userId);
}
