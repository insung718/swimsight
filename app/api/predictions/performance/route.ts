import { NextResponse } from "next/server";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { getPredictionEvaluationDashboard } from "@/lib/services/prediction-evaluation-service";
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
    const performance = await getPredictionEvaluationDashboard(account.context.userId);
    return NextResponse.json({ performance });
  } catch (error) {
    logServerError("Could not load prediction performance", error);
    return databaseUnavailable();
  }
}
