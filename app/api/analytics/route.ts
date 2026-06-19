import { NextResponse } from "next/server";
import { requireApiAccount } from "@/lib/security/api-auth";
import { getDashboardAnalyticsForUser } from "@/lib/services/swim-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await requireApiAccount();
  if (!account.ok) return account.response;
  return NextResponse.json({ analytics: await getDashboardAnalyticsForUser(account.context.userId) });
}
