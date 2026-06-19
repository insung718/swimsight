import { NextResponse } from "next/server";
import { created } from "@/lib/api";
import { requireApiAccount } from "@/lib/security/api-auth";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { createCommunity, listCommunitiesForUser } from "@/lib/services/community-service";
import { communityCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  return NextResponse.json({ communities: await listCommunitiesForUser(account.context.userId) });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, communityCreateSchema);
  if (!parsed.ok) return parsed.response;

  const community = await createCommunity({
    ownerId: account.context.userId,
    ...parsed.data
  });

  return created({ community });
}
