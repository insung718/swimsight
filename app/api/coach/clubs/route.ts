import { NextResponse } from "next/server";
import { created, forbidden } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createCoachClub, getCoachDashboard } from "@/lib/services/coach-service";
import { coachClubCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function isCoach(role: string) {
  return role === "COACH" || role === "ADMIN";
}

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  if (!isCoach(account.context.role)) return forbidden("Coach access is required.");

  try {
    return NextResponse.json({ dashboard: await getCoachDashboard(account.context.userId) });
  } catch (error) {
    logServerError("Could not load coach clubs", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  if (!isCoach(account.context.role)) return forbidden("Coach access is required.");
  const parsed = await parseSecureJson(request, coachClubCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const club = await createCoachClub({
      coachId: account.context.userId,
      ...parsed.data
    });

    return created({ club });
  } catch (error) {
    logServerError("Could not create coach club", error);
    return databaseUnavailable();
  }
}
