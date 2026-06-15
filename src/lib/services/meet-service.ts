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

export function getDemoUpcomingMeet(): UpcomingMeet {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 24);

  return {
    id: "demo-meet",
    userId: "demo-athlete",
    name: "BIS HCMC Sprint Invitational",
    location: "Ho Chi Minh City",
    startDate: startDate.toISOString().slice(0, 10),
    targetEvents: ["50 Freestyle", "50 Butterfly", "100 Butterfly"],
    notes: "Sharpen starts, breakouts, and first 15m speed.",
    daysUntil: 24
  };
}

export async function listUpcomingMeets(userId?: string): Promise<UpcomingMeet[]> {
  if (!hasDatabaseConfig() || !userId) {
    return [getDemoUpcomingMeet()];
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
    orderBy: { startDate: "asc" }
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
