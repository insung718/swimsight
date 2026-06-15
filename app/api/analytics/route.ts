import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";
import { getDashboardAnalyticsForUser } from "@/lib/services/swim-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthContext();
  const analytics = await getDashboardAnalyticsForUser(context?.userId);

  return NextResponse.json({
    mode: context && hasDatabaseConfig() ? "account" : "demo",
    analytics
  });
}
