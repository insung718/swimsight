import type { Course, SwimEvent, SwimResult, UpcomingMeet } from "@/types/swim";

const eventToPrisma = {
  "50 Freestyle": "FIFTY_FREESTYLE",
  "100 Freestyle": "ONE_HUNDRED_FREESTYLE",
  "200 Freestyle": "TWO_HUNDRED_FREESTYLE",
  "400 Freestyle": "FOUR_HUNDRED_FREESTYLE",
  "800 Freestyle": "EIGHT_HUNDRED_FREESTYLE",
  "1500 Freestyle": "FIFTEEN_HUNDRED_FREESTYLE",
  "50 Butterfly": "FIFTY_BUTTERFLY",
  "100 Butterfly": "ONE_HUNDRED_BUTTERFLY",
  "200 Butterfly": "TWO_HUNDRED_BUTTERFLY",
  "50 Backstroke": "FIFTY_BACKSTROKE",
  "100 Backstroke": "ONE_HUNDRED_BACKSTROKE",
  "200 Backstroke": "TWO_HUNDRED_BACKSTROKE",
  "50 Breaststroke": "FIFTY_BREASTSTROKE",
  "100 Breaststroke": "ONE_HUNDRED_BREASTSTROKE",
  "200 Breaststroke": "TWO_HUNDRED_BREASTSTROKE",
  "100 IM": "ONE_HUNDRED_IM",
  "200 IM": "TWO_HUNDRED_IM",
  "400 IM": "FOUR_HUNDRED_IM"
} as const satisfies Record<SwimEvent, string>;

const prismaToEvent = Object.fromEntries(
  Object.entries(eventToPrisma).map(([event, prismaValue]) => [prismaValue, event])
) as Record<string, SwimEvent>;

export function toPrismaEvent(event: SwimEvent) {
  return eventToPrisma[event];
}

export function fromPrismaEvent(event: string) {
  return prismaToEvent[event];
}

export function toPrismaCourse(course: Course) {
  return course;
}

export function toSwimResult(record: {
  id: string;
  userId: string;
  date: Date;
  event: string;
  course: string;
  timeSeconds: number;
  meetName: string;
  source?: string;
  notes?: string | null;
}): SwimResult {
  return {
    id: record.id,
    userId: record.userId,
    date: record.date.toISOString().slice(0, 10),
    event: fromPrismaEvent(record.event),
    course: record.course as Course,
    timeSeconds: record.timeSeconds,
    meetName: record.meetName,
    source: record.source as SwimResult["source"],
    notes: record.notes
  };
}

export function toUpcomingMeet(record: {
  id: string;
  userId: string;
  name: string;
  location?: string | null;
  startDate: Date;
  targetEvents: string[];
  notes?: string | null;
}): UpcomingMeet {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meetDate = new Date(record.startDate);
  meetDate.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((meetDate.getTime() - today.getTime()) / 86_400_000);

  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    location: record.location,
    startDate: record.startDate.toISOString().slice(0, 10),
    targetEvents: record.targetEvents.map(fromPrismaEvent),
    notes: record.notes,
    daysUntil
  };
}
