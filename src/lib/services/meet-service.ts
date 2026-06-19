import { hasDatabaseConfig, prisma } from "@/lib/prisma";
import { toPrismaEvent, toUpcomingMeet } from "@/lib/prisma-mappers";
import type { SwimEvent, UpcomingMeet } from "@/types/swim";

interface CreateMeetInput {
  userId: string;
  name: string;
  location?: string;
  startDate: string;
  targetEvents: SwimEvent[];
  notes?: string;
}

export async function listUpcomingMeets(userId: string): Promise<UpcomingMeet[]> {
  if (!hasDatabaseConfig()) {
    return [];
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const meets = await prisma.upcomingMeet.findMany({
    where: {
      userId,
      startDate: {
        gte: today
      }
    },
    orderBy: { startDate: "asc" },
    take: 50
  });

  return meets.map(toUpcomingMeet);
}

export async function createUpcomingMeet(input: CreateMeetInput) {
  const meet = await prisma.upcomingMeet.create({
    data: {
      userId: input.userId,
      name: input.name,
      location: input.location,
      startDate: new Date(input.startDate),
      targetEvents: input.targetEvents.map(toPrismaEvent),
      notes: input.notes
    }
  });

  return toUpcomingMeet(meet);
}
