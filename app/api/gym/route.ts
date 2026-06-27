import { NextResponse } from "next/server";
import { created } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createGymWorkout, getGymWorkoutsForUser } from "@/lib/services/gym-service";
import { gymWorkoutSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return NextResponse.json({ workouts: await getGymWorkoutsForUser(account.context.userId) });
  } catch (error) {
    logServerError("Could not load gym workouts", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, gymWorkoutSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const workout = await createGymWorkout({
      userId: account.context.userId,
      ...parsed.data
    });

    return created({ workout });
  } catch (error) {
    logServerError("Could not create gym workout", error);
    return databaseUnavailable();
  }
}
