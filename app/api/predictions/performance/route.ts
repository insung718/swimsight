import { NextResponse } from "next/server";
import { databaseUnavailable, requireApiAccount } from "@/lib/security/api-auth";
import { logServerError } from "@/lib/security/logging";
import { getPredictionEvaluationDashboard } from "@/lib/services/prediction-evaluation-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;

  try {
    const performance = await getPredictionEvaluationDashboard(account.context.userId);
    return NextResponse.json({ performance });
  } catch (error) {
    logServerError("Could not load prediction performance", error);
    return databaseUnavailable();
  }
}
