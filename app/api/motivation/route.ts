import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { getSwimsForUser } from "@/lib/services/swim-service";
import { listUpcomingMeets } from "@/lib/services/meet-service";
import { generateMotivationTips } from "@/lib/services/motivation-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthContext();
  const [swims, meets] = await Promise.all([
    getSwimsForUser(context?.userId),
    listUpcomingMeets(context?.userId)
  ]);

  return NextResponse.json({
    tips: generateMotivationTips(swims, meets[0])
  });
}
