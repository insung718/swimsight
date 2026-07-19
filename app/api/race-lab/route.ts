import { NextResponse } from "next/server";
import { badRequest, conflict, created, notFound } from "@/lib/api";
import { RaceLabValidationError } from "@/lib/race-lab";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import {
  RaceLabConflictError,
  RaceLabNotFoundError,
  deleteRaceLabScenario,
  generateEstimatedRaceSplits,
  getRaceLabState,
  saveGoalRaceScenario,
  saveManualRaceSplits,
  saveSimulationScenario
} from "@/lib/services/race-lab-service";
import { raceLabMutationSchema, raceLabQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const url = new URL(request.url);
  const parsed = raceLabQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) return badRequest("Invalid Race Lab query.");

  try {
    return NextResponse.json(await getRaceLabState(account.context.userId, parsed.data.raceIds));
  } catch (error) {
    if (error instanceof RaceLabNotFoundError) return notFound(error.message);
    if (error instanceof RaceLabValidationError) return badRequest(error.message);
    logServerError("Could not load Race Lab", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, raceLabMutationSchema, 24_576);
  if (!parsed.ok) return parsed.response;

  try {
    const userId = account.context.userId;
    switch (parsed.data.mode) {
      case "SAVE_SPLITS":
        return created(await saveManualRaceSplits({ userId, raceId: parsed.data.raceId, cumulativeTimes: parsed.data.cumulativeTimes }));
      case "GENERATE_ESTIMATE":
        return created(await generateEstimatedRaceSplits({ userId, raceId: parsed.data.raceId }));
      case "SAVE_SIMULATION":
        return created(await saveSimulationScenario({ userId, raceId: parsed.data.raceId, name: parsed.data.name, settings: parsed.data.settings }));
      case "SAVE_GOAL_RACE":
        return created(await saveGoalRaceScenario({
          userId,
          raceId: parsed.data.raceId,
          name: parsed.data.name,
          targetTime: parsed.data.targetTime,
          strategy: parsed.data.strategy,
          segmentTimes: parsed.data.segmentTimes
        }));
      case "DELETE_SCENARIO":
        return NextResponse.json(await deleteRaceLabScenario({ userId, scenarioId: parsed.data.scenarioId }));
    }
  } catch (error) {
    if (error instanceof RaceLabNotFoundError) return notFound(error.message);
    if (error instanceof RaceLabConflictError) return conflict(error.message);
    if (error instanceof RaceLabValidationError) return badRequest(error.message);
    logServerError("Could not update Race Lab", error);
    return databaseUnavailable();
  }
}
