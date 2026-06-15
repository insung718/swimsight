import { NextResponse } from "next/server";
import { buildDashboardAnalytics } from "@/lib/analytics";
import { sampleGoals, sampleSwims } from "@/lib/sample-data";

export async function GET() {
  const analytics = buildDashboardAnalytics(sampleSwims, sampleGoals[0]);

  return NextResponse.json({ analytics });
}
