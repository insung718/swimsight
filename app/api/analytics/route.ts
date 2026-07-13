import { NextResponse } from "next/server";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { getDashboardAnalyticsForUser } from "@/lib/services/swim-service";
import { getConsentState } from "@/lib/services/privacy-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  try {
    const consent = await getConsentState(account.context.userId);
    if (!consent.personalAnalytics.active) {
      return NextResponse.json({ error: "Personal analytics consent is required." }, { status: 403 });
    }
    return NextResponse.json({ analytics: await getDashboardAnalyticsForUser(account.context.userId) });
  } catch (error) {
    logServerError("Could not load analytics", error);
    return databaseUnavailable();
  }
}
