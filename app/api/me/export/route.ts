import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: account.context.userId },
      select: {
        id: true,
        email: true,
        name: true,
        imageUrl: true,
        age: true,
        sex: true,
        taperDays: true,
        swimSessionsPerWeek: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        personalAnalyticsConsentVersion: true,
        personalAnalyticsConsentedAt: true,
        personalAnalyticsWithdrawnAt: true,
        trainingConsentVersion: true,
        trainingConsentedAt: true,
        trainingConsentWithdrawnAt: true,
        researchConsentVersion: true,
        researchConsentedAt: true,
        researchConsentWithdrawnAt: true,
        guardianConsentVersion: true,
        guardianConsentedAt: true,
        guardianConsentWithdrawnAt: true,
        trainingDataExcludedAt: true,
        swims: true,
        goals: true,
        predictions: true,
        upcomingMeets: true,
        gymWorkouts: true,
        predictionSnapshots: true,
        predictionAttempts: true,
        consentEvents: true,
        raceFeedback: { include: { revisions: true } },
        memberships: true,
        communityMemberships: true,
        ownedTeams: { select: { id: true, name: true, description: true, createdAt: true, updatedAt: true } },
        ownedCommunities: { select: { id: true, name: true, description: true, createdAt: true, updatedAt: true } },
        sentFriendRequests: { select: { id: true, status: true, createdAt: true, updatedAt: true } },
        receivedFriendRequests: { select: { id: true, status: true, createdAt: true, updatedAt: true } }
      }
    });
    return new NextResponse(JSON.stringify({
      schemaVersion: "swimsight-export-v1",
      exportedAt: new Date().toISOString(),
      user
    }, null, 2), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="swimsight-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "Content-Type": "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    logServerError("Could not create account export", error);
    return NextResponse.json({ error: "Account export could not be created." }, { status: 503 });
  }
}
