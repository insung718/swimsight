import "server-only";
import { hasDatabaseConfig, prisma } from "@/lib/prisma";
import { toGymWorkout } from "@/lib/prisma-mappers";
import type { GymWorkout, GymWorkoutType } from "@/types/swim";

interface CreateGymWorkoutInput {
  userId: string;
  date: string;
  workoutType: GymWorkoutType;
  durationMinutes: number;
  intensity: number;
  focus?: string;
  notes?: string;
}

export async function getGymWorkoutsForUser(userId: string): Promise<GymWorkout[]> {
  if (!hasDatabaseConfig()) {
    return [];
  }

  const workouts = await prisma.gymWorkout.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    take: 1_000
  });

  return workouts.map(toGymWorkout);
}

export async function createGymWorkout(input: CreateGymWorkoutInput) {
  const workout = await prisma.gymWorkout.create({
    data: {
      userId: input.userId,
      date: new Date(input.date),
      workoutType: input.workoutType,
      durationMinutes: input.durationMinutes,
      intensity: input.intensity,
      focus: input.focus,
      notes: input.notes
    }
  });

  return toGymWorkout(workout);
}
