import { NextResponse } from "next/server";
import { conflict, created, notFound } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { joinCoachClub, listCoachClubsForSwimmer } from "@/lib/services/coach-service";
import { CannotJoinOwnedGroupError } from "@/lib/services/join-errors";
import { coachClubJoinSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;

  try {
    return NextResponse.json({ clubs: await listCoachClubsForSwimmer(account.context.userId) });
  } catch (error) {
    logServerError("Could not load joined coach clubs", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, coachClubJoinSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const club = await joinCoachClub({
      userId: account.context.userId,
      joinCode: parsed.data.joinCode
    });

    if (!club) return notFound("Coach club join code was not found.");

    return created({ club });
  } catch (error) {
    if (error instanceof CannotJoinOwnedGroupError) {
      return conflict(error.message);
    }

    logServerError("Could not join coach club", error);
    return databaseUnavailable();
  }
}
