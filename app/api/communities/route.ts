import { NextResponse } from "next/server";
import { badRequest, created, unauthorized, validationError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";
import { createCommunity, listCommunitiesForUser } from "@/lib/services/community-service";
import { communityCreateSchema, parseJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthContext();

  if (!context || !hasDatabaseConfig()) {
    return NextResponse.json({
      mode: "demo",
      communities: [
        {
          id: "demo-community",
          name: "BIS HCMC Swim Team",
          slug: "bis-hcmc-swim-team",
          description: "Demo community for comparing swimmers.",
          joinCode: "DEMO24",
          memberCount: 4
        }
      ]
    });
  }

  const communities = await listCommunitiesForUser(context.userId);

  return NextResponse.json({
    mode: "account",
    communities
  });
}

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context) {
    return unauthorized("Sign in with Google before creating communities.");
  }

  if (!hasDatabaseConfig()) {
    return badRequest("DATABASE_URL is required before communities can be saved.");
  }

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(communityCreateSchema, body);

  if (!parsed.ok) {
    return validationError(parsed.errors);
  }

  const community = await createCommunity({
    ownerId: context.userId,
    ...parsed.data
  });

  return created({ community });
}
