import { NextResponse } from "next/server";
import { created } from "@/lib/api";
import { requireApiAccount } from "@/lib/security/api-auth";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createUpcomingMeet, listUpcomingMeets } from "@/lib/services/meet-service";
import { upcomingMeetSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  return NextResponse.json({ meets: await listUpcomingMeets(account.context.userId) });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, upcomingMeetSchema);
  if (!parsed.ok) return parsed.response;

  const meet = await createUpcomingMeet({
    userId: account.context.userId,
    ...parsed.data
  });

  return created({ meet });
}
