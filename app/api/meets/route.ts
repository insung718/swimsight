import { NextResponse } from "next/server";
import { created } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createUpcomingMeet, listUpcomingMeets } from "@/lib/services/meet-service";
import { upcomingMeetSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return NextResponse.json({ meets: await listUpcomingMeets(account.context.userId) });
  } catch (error) {
    logServerError("Could not load meets", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, upcomingMeetSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const meet = await createUpcomingMeet({
      userId: account.context.userId,
      ...parsed.data
    });

    return created({ meet });
  } catch (error) {
    logServerError("Could not create meet", error);
    return databaseUnavailable();
  }
}
