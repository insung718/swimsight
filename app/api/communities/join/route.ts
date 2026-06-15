import { badRequest, created, notFound, unauthorized, validationError } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";
import { joinCommunity } from "@/lib/services/community-service";
import { communityJoinSchema, parseJsonBody } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await getAuthContext();

  if (!context) {
    return unauthorized("Sign in with Google before joining communities.");
  }

  if (!hasDatabaseConfig()) {
    return badRequest("DATABASE_URL is required before communities can be saved.");
  }

  const body = await request.json().catch(() => null);
  const parsed = parseJsonBody(communityJoinSchema, body);

  if (!parsed.ok) {
    return validationError(parsed.errors);
  }

  const community = await joinCommunity({
    userId: context.userId,
    joinCode: parsed.data.joinCode
  });

  if (!community) {
    return notFound("Community join code was not found.");
  }

  return created({ community });
}
