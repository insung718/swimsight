import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { LanguageToggle } from "@/components/landing/language-toggle";
import { RaceLab } from "@/components/race-lab/race-lab";
import type { RaceLabState } from "@/lib/race-lab";
import type { DashboardAnalytics, Goal, SwimResult } from "@/types/swim";

export const dynamic = "force-dynamic";

const swims: SwimResult[] = [
  { id: "race-previous", userId: "fixture-user", date: "2026-05-10", event: "100 Freestyle", course: "LCM", timeSeconds: 56.8, meetName: "Fixture meet", resultKind: "OFFICIAL", raceType: "INDIVIDUAL" },
  { id: "race-current", userId: "fixture-user", date: "2026-06-14", event: "100 Freestyle", course: "LCM", timeSeconds: 55.9, meetName: "Fixture meet", resultKind: "OFFICIAL", raceType: "INDIVIDUAL" }
];

const initialState: RaceLabState = {
  splits: [
    { id: "split-1", raceId: "race-previous", segmentIndex: 0, segmentDistance: 50, cumulativeDistance: 50, segmentTime: 27.1, cumulativeTime: 27.1, source: "OFFICIAL", precision: "HUNDREDTH" },
    { id: "split-2", raceId: "race-previous", segmentIndex: 1, segmentDistance: 50, cumulativeDistance: 100, segmentTime: 29.7, cumulativeTime: 56.8, source: "OFFICIAL", precision: "HUNDREDTH" },
    { id: "split-3", raceId: "race-current", segmentIndex: 0, segmentDistance: 50, cumulativeDistance: 50, segmentTime: 26.7, cumulativeTime: 26.7, source: "OFFICIAL", precision: "HUNDREDTH" },
    { id: "split-4", raceId: "race-current", segmentIndex: 1, segmentDistance: 50, cumulativeDistance: 100, segmentTime: 29.2, cumulativeTime: 55.9, source: "OFFICIAL", precision: "HUNDREDTH" }
  ],
  scenarios: []
};

const goals: Goal[] = [{ id: "goal-1", userId: "fixture-user", event: "100 Freestyle", course: "LCM", targetTime: 54.9, targetDate: "2026-12-01" }];
const analytics = {
  predictions: [{ event: "100 Freestyle", course: "LCM", predictedTimes: { days90: 55.2 } }]
} as unknown as DashboardAnalytics;

export default async function RaceLabE2EPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (process.env.ENABLE_E2E_ROUTES !== "true" || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) notFound();
  return (
    <main className="dashboard-shell min-h-screen px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto mb-3 flex max-w-[1280px] justify-end"><LanguageToggle compact /></div>
      <div className="mx-auto max-w-[1280px]"><RaceLab analytics={analytics} disablePersistence goals={goals} initialState={initialState} swims={swims} /></div>
    </main>
  );
}
