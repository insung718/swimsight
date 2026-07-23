import { cookies } from "next/headers";
import { LandingPage } from "@/components/landing/landing-page";
import { PredictionGateway } from "@/components/landing/prediction-gateway";
import { CoachDashboard } from "@/components/coach-dashboard";
import { RoleOnboarding } from "@/components/role-onboarding";
import { PersonalAnalyticsConsent } from "@/components/personal-analytics-consent";
import { SwimSightDashboard } from "@/components/swimsight-dashboard";
import { DashboardUnavailable } from "@/components/dashboard-unavailable";
import { AccountDeletionPendingError, getAuthContext } from "@/lib/auth-context";
import { buildDashboardAnalytics } from "@/lib/analytics";
import { dashboardViewModeCookie, isDashboardViewMode } from "@/lib/dashboard-view-mode";
import { hasDatabaseConfig } from "@/lib/prisma";
import { logServerError } from "@/lib/security/logging";
import { getCoachDashboard } from "@/lib/services/coach-service";
import { getGymWorkoutsForUser } from "@/lib/services/gym-service";
import { listUpcomingMeets } from "@/lib/services/meet-service";
import { getApprovedHundredFreeChampionReleases } from "@/lib/services/model-governance-service";
import { getPredictionEvaluationDashboard, syncPredictionSnapshots } from "@/lib/services/prediction-evaluation-service";
import { getPrimaryGoal, getSwimsForUser } from "@/lib/services/swim-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  let context;

  try {
    context = await getAuthContext();
  } catch (error) {
    if (error instanceof AccountDeletionPendingError) {
      return <DashboardUnavailable reason="account-removed" />;
    }
    logServerError("Account bootstrap failed", error);
    return <DashboardUnavailable reason="account-bootstrap" />;
  }

  if (!context) {
    return <LandingPage lead={<PredictionGateway />} />;
  }

  if (!hasDatabaseConfig()) {
    return <DashboardUnavailable reason="database-config" />;
  }

  if (!context.onboardingCompleted || (context.role === "ATHLETE" && !context.age)) {
    return <RoleOnboarding />;
  }

  if (!context.personalAnalyticsConsentActive) {
    return <PersonalAnalyticsConsent />;
  }

  try {
    const cookieStore = await cookies();
    const savedViewMode = cookieStore.get(dashboardViewModeCookie)?.value;
    const defaultViewMode = context.role === "COACH" || context.role === "ADMIN" ? "coach" : "swimmer";
    const viewMode = isDashboardViewMode(savedViewMode) ? savedViewMode : defaultViewMode;

    if (viewMode === "coach") {
      const dashboard = await getCoachDashboard(context.userId);
      return <CoachDashboard dashboard={dashboard} viewMode="coach" />;
    }

    const [goal, swims, gymWorkouts, meets, hundredFreeChampionReleases] = await Promise.all([
      getPrimaryGoal(context.userId),
      getSwimsForUser(context.userId),
      getGymWorkoutsForUser(context.userId),
      listUpcomingMeets(context.userId),
      getApprovedHundredFreeChampionReleases()
    ]);
    const predictionProfile = {
      age: context.age,
      sex: context.sex,
      taperDays: context.taperDays,
      swimSessionsPerWeek: context.swimSessionsPerWeek
    };
    const analytics = buildDashboardAnalytics(swims, goal ?? undefined, gymWorkouts, predictionProfile, { hundredFreeChampionReleases });
    await syncPredictionSnapshots({
      userId: context.userId,
      predictions: analytics.predictions,
      swims,
      profile: predictionProfile,
      goal: goal ?? undefined,
      meets
    });
    const modelPerformance = await getPredictionEvaluationDashboard(context.userId);

    return (
      <SwimSightDashboard
        analytics={analytics}
        gymWorkouts={gymWorkouts}
        goals={goal ? [goal] : []}
        predictionProfile={predictionProfile}
        modelPerformance={modelPerformance}
        swims={swims}
        viewMode="swimmer"
        athleteName={context.name}
        athleteImageUrl={context.imageUrl}
      />
    );
  } catch (error) {
    logServerError("Dashboard bootstrap failed", error);
    return <DashboardUnavailable reason="database-unreachable" />;
  }
}
