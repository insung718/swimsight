import { created, notFound } from "@/lib/api";
import { requireApiAccount } from "@/lib/security/api-auth";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { joinCommunity } from "@/lib/services/community-service";
import { communityJoinSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, communityJoinSchema);
  if (!parsed.ok) return parsed.response;

  const community = await joinCommunity({
    userId: account.context.userId,
    joinCode: parsed.data.joinCode
  });

  if (!community) {
    return notFound("Community join code was not found.");
  }

  return created({ community });
}
