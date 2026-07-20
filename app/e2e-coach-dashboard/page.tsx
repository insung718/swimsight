import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CoachDashboard } from "@/components/coach-dashboard";
import type { CoachDashboardData, CoachSwimmerAnalytics } from "@/types/swim";

export const dynamic = "force-dynamic";

const swimmers: CoachSwimmerAnalytics[] = [
  {
    activeGoals: 2,
    consistencyScore: 88,
    dataQualityStatus: "READY",
    id: "coach-fixture-athlete-1",
    importStatus: "COMPLETE",
    joinedAt: "2026-01-12",
    latestResult: { course: "LCM", date: "2026-06-14", event: "100 Freestyle", timeSeconds: 55.9 },
    mostImprovedEvent: "100 Freestyle",
    name: "Ellis Crisci",
    postMeetEvaluationCount: 3,
    predictionEligible: true,
    progression: [
      { course: "LCM", date: "2026-01-18", event: "100 Freestyle", timeSeconds: 58.4 },
      { course: "LCM", date: "2026-03-08", event: "100 Freestyle", timeSeconds: 57.1 },
      { course: "LCM", date: "2026-06-14", event: "100 Freestyle", timeSeconds: 55.9 }
    ],
    strongestEvent: "100 Freestyle",
    swimPowerIndex: 86,
    totalSwims: 18,
    upcomingMeetCount: 1,
    yearlyImprovement: 4.3
  },
  {
    activeGoals: 1,
    consistencyScore: 91,
    dataQualityStatus: "READY",
    id: "coach-fixture-athlete-2",
    importStatus: "COMPLETE",
    joinedAt: "2026-02-03",
    latestResult: { course: "SCM", date: "2026-06-09", event: "100 Butterfly", timeSeconds: 61.8 },
    mostImprovedEvent: "100 Butterfly",
    name: "Mina Park",
    postMeetEvaluationCount: 2,
    predictionEligible: true,
    progression: [
      { course: "SCM", date: "2026-02-10", event: "100 Butterfly", timeSeconds: 64.2 },
      { course: "SCM", date: "2026-04-19", event: "100 Butterfly", timeSeconds: 62.9 },
      { course: "SCM", date: "2026-06-09", event: "100 Butterfly", timeSeconds: 61.8 }
    ],
    strongestEvent: "100 Butterfly",
    swimPowerIndex: 83,
    totalSwims: 14,
    upcomingMeetCount: 2,
    yearlyImprovement: 3.7
  }
];

const dashboard: CoachDashboardData = {
  clubs: [{
    dataReadyCount: 2,
    description: "Performance squad",
    id: "coach-fixture-club",
    joinCode: "LANE26",
    memberCount: 2,
    name: "SwimSight Performance",
    permissionPendingCount: 0,
    sharingStatus: "ACTIVE",
    swimmers
  }],
  overview: {
    averageSpi: 85,
    clubCount: 1,
    swimmerCount: 2,
    topImprover: swimmers[0],
    totalSwims: 32
  }
};

export default async function CoachDashboardE2EPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const isVercelDeployment = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  if (isVercelDeployment || process.env.ENABLE_E2E_ROUTES !== "true" || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) notFound();

  return <CoachDashboard dashboard={dashboard} viewMode="coach" />;
}
