import { NextResponse } from "next/server";
import { badRequest, notFound } from "@/lib/api";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { getCommunityComparison } from "@/lib/services/community-service";
import { communityIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ communityId: string }> }
) {
  const { communityId } = await params;
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  const idResult = communityIdSchema.safeParse(communityId);
  if (!idResult.success) {
    return badRequest("Community id is required.");
  }

  let comparison;
  try {
    comparison = await getCommunityComparison(idResult.data, account.context.userId);
  } catch (error) {
    console.error("Could not load community comparison", error);
    return databaseUnavailable();
  }

  if (!comparison) {
    return notFound("Community was not found or you are not a member.");
  }

  return NextResponse.json({
    ...comparison
  });
}
