import { conflict, created, notFound } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { joinCommunity } from "@/lib/services/community-service";
import { CannotJoinOwnedGroupError } from "@/lib/services/join-errors";
import { communityJoinSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, communityJoinSchema);
  if (!parsed.ok) return parsed.response;

  let community;
  try {
    community = await joinCommunity({
      userId: account.context.userId,
      joinCode: parsed.data.joinCode
    });
  } catch (error) {
    if (error instanceof CannotJoinOwnedGroupError) {
      return conflict(error.message);
    }

    logServerError("Could not join community", error);
    return databaseUnavailable();
  }

  if (!community) {
    return notFound("Community join code was not found.");
  }

  return created({ community });
}
