import { NextResponse } from "next/server";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { getSwimsForUser } from "@/lib/services/swim-service";
import { listUpcomingMeets } from "@/lib/services/meet-service";
import { generateMotivationTips } from "@/lib/services/motivation-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  let swims;
  let meets;
  try {
    [swims, meets] = await Promise.all([
      getSwimsForUser(account.context.userId),
      listUpcomingMeets(account.context.userId)
    ]);
  } catch (error) {
    console.error("Could not load motivation data", error);
    return databaseUnavailable();
  }

  return NextResponse.json({
    tips: generateMotivationTips(swims, meets[0])
  });
}
