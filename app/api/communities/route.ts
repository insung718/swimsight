import { NextResponse } from "next/server";
import { created } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createCommunity, listCommunitiesForUser } from "@/lib/services/community-service";
import { communityCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return NextResponse.json({ communities: await listCommunitiesForUser(account.context.userId) });
  } catch (error) {
    logServerError("Could not load communities", error);
    return databaseUnavailable();
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, communityCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const community = await createCommunity({
      ownerId: account.context.userId,
      ...parsed.data
    });

    return created({ community });
  } catch (error) {
    logServerError("Could not create community", error);
    return databaseUnavailable();
  }
}
