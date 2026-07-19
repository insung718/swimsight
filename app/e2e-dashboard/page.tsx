import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SwimSightDashboard } from "@/components/swimsight-dashboard";
import { buildDashboardAnalytics } from "@/lib/analytics";
import type { Goal, GymWorkout, ModelPerformanceDashboard, PredictionProfile, SwimResult } from "@/types/swim";

export const dynamic = "force-dynamic";

const swims: SwimResult[] = [
  { id: "dashboard-1", userId: "fixture-user", date: "2026-01-18", event: "100 Freestyle", course: "LCM", timeSeconds: 58.4, meetName: "Season opener", resultKind: "OFFICIAL" },
  { id: "dashboard-2", userId: "fixture-user", date: "2026-03-08", event: "100 Freestyle", course: "LCM", timeSeconds: 57.1, meetName: "Spring invitational", resultKind: "OFFICIAL" },
  { id: "dashboard-3", userId: "fixture-user", date: "2026-06-14", event: "100 Freestyle", course: "LCM", timeSeconds: 55.9, meetName: "Championship meet", resultKind: "OFFICIAL" },
  { id: "dashboard-4", userId: "fixture-user", date: "2026-02-02", event: "50 Freestyle", course: "LCM", timeSeconds: 26.2, meetName: "Winter meet", resultKind: "OFFICIAL" },
  { id: "dashboard-5", userId: "fixture-user", date: "2026-05-20", event: "50 Freestyle", course: "LCM", timeSeconds: 25.6, meetName: "City finals", resultKind: "OFFICIAL" },
  { id: "dashboard-6", userId: "fixture-user", date: "2026-06-22", event: "100 Butterfly", course: "LCM", timeSeconds: 63.8, meetName: "Summer classic", resultKind: "OFFICIAL" }
];

const goals: Goal[] = [{
  id: "dashboard-goal",
  userId: "fixture-user",
  event: "100 Freestyle",
  course: "LCM",
  targetTime: 54.9,
  targetDate: "2026-12-01"
}];

const gymWorkouts: GymWorkout[] = [{
  id: "dashboard-workout",
  userId: "fixture-user",
  date: "2026-06-20",
  workoutType: "STRENGTH",
  durationMinutes: 45,
  intensity: 7,
  focus: "Pull strength",
  trainingLoad: 315
}];

const predictionProfile: PredictionProfile = { age: 16, sex: "MALE", taperDays: 10, swimSessionsPerWeek: 6 };
const modelPerformance: ModelPerformanceDashboard = {
  summary: {
    evaluatedPredictions: 0,
    pendingPredictions: 0,
    mae: 0,
    medianAbsoluteError: 0,
    rmse: 0,
    intervalCoverage: 0,
    probabilityEvaluations: 0,
    probabilityBrierScore: 0,
    probabilityCalibrationError: 0
  },
  byEvent: [],
  byAgeGroup: [],
  byCategory: [],
  byHorizon: [],
  byConfidence: [],
  byDataSufficiency: [],
  byModelVersion: [],
  baselines: [],
  probabilityCalibration: [],
  history: []
};

export default async function DashboardE2EPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (process.env.ENABLE_E2E_ROUTES !== "true" || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) notFound();

  return (
    <SwimSightDashboard
      analytics={buildDashboardAnalytics(swims, goals[0], gymWorkouts, predictionProfile)}
      goals={goals}
      gymWorkouts={gymWorkouts}
      modelPerformance={modelPerformance}
      predictionProfile={predictionProfile}
      swims={swims}
      viewMode="swimmer"
    />
  );
}
