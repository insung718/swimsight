import { NextResponse } from "next/server";
import { forbidden, ok } from "@/lib/api";
import { requireApiAccount } from "@/lib/security/api-auth";
import { isTrustedAdminEmail } from "@/lib/security/admin";
import { logServerError } from "@/lib/security/logging";
import { enforceSameOrigin, parseSecureJson } from "@/lib/security/request";
import { getModelGovernanceOverview, refreshModelMonitoring } from "@/lib/services/model-governance-service";
import { modelMonitoringRefreshSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function requireTrustedAdmin() {
  const account = await requireApiAccount();
  if (!account.ok) return account;
  if (account.context.role !== "ADMIN" || !isTrustedAdminEmail(account.context.email)) {
    return { ok: false as const, response: forbidden() };
  }
  return account;
}

export async function GET() {
  const account = await requireTrustedAdmin();
  if (!account.ok) return account.response;
  try {
    return ok(await getModelGovernanceOverview());
  } catch (error) {
    logServerError("Could not load model governance overview", error);
    return NextResponse.json({ error: "Model governance data is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const account = await requireTrustedAdmin();
  if (!account.ok) return account.response;
  const parsed = await parseSecureJson(request, modelMonitoringRefreshSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const snapshot = await refreshModelMonitoring(parsed.data);
    return ok({ snapshot, automaticallyRetrained: false, automaticallyPromoted: false });
  } catch (error) {
    logServerError("Could not refresh model monitoring", error);
    return NextResponse.json({ error: "Model monitoring could not be refreshed." }, { status: 503 });
  }
}
