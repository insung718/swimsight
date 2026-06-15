import { NextResponse } from "next/server";
import { badRequest, notFound } from "@/lib/api";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";
import { getCommunityComparison } from "@/lib/services/community-service";
import { sampleTeamAnalytics } from "@/lib/sample-data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ communityId: string }> }
) {
  const { communityId } = await params;
  const context = await getAuthContext();

  if (!context || !hasDatabaseConfig()) {
    return NextResponse.json({
      mode: "demo",
      community: {
        id: "demo-community",
        name: "BIS HCMC Swim Team",
        slug: "bis-hcmc-swim-team",
        description: "Demo community for comparing swimmers.",
        joinCode: "DEMO24",
        memberCount: sampleTeamAnalytics.length
      },
      members: sampleTeamAnalytics.map((member) => ({
        id: member.id,
        name: member.name,
        role: member.role === "Captain" ? "OWNER" : "MEMBER",
        joinedAt: new Date().toISOString(),
        analytics: {
          totalSwims: 0,
          strongestEvent: member.primaryEvent,
          swimPowerIndex: member.swimPowerIndex,
          yearlyImprovement: member.totalImprovementPercent
        }
      }))
    });
  }

  if (!communityId) {
    return badRequest("Community id is required.");
  }

  const comparison = await getCommunityComparison(communityId, context.userId);

  if (!comparison) {
    return notFound("Community was not found or you are not a member.");
  }

  return NextResponse.json({
    mode: "account",
    ...comparison
  });
}
