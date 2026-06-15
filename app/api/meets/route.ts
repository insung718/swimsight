import { NextResponse } from "next/server";
import { badRequest, created, unauthorized, validationError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";
import { createUpcomingMeet, listUpcomingMeets } from "@/lib/services/meet-service";
import { parseJsonBody, upcomingMeetSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthContext();
  const meets = await listUpcomingMeets(context?.userId);

  return NextResponse.json({
    mode: context && hasDatabaseConfig() ? "account" : "demo",
    meets
  });
}

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context) {
    return unauthorized("Sign in with Google before adding meets.");
  }

  if (!hasDatabaseConfig()) {
    return badRequest("DATABASE_URL is required before upcoming meets can be saved.");
  }

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(upcomingMeetSchema, body);

  if (!parsed.ok) {
    return validationError(parsed.errors);
  }

  const meet = await createUpcomingMeet({
    userId: context.userId,
    ...parsed.data
  });

  return created({ meet });
}
