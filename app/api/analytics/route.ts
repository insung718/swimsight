import { NextResponse } from "next/server";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { getDashboardAnalyticsForUser } from "@/lib/services/swim-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    return NextResponse.json({ analytics: await getDashboardAnalyticsForUser(account.context.userId) });
  } catch (error) {
    console.error("Could not load analytics", error);
    return databaseUnavailable();
  }
}
