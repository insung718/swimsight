import { cookies } from "next/headers";
import { LandingPage } from "@/components/landing/landing-page";
import { CoachDashboard } from "@/components/coach-dashboard";
import { RoleOnboarding } from "@/components/role-onboarding";
import { PersonalAnalyticsConsent } from "@/components/personal-analytics-consent";
import { SwimSightDashboard } from "@/components/swimsight-dashboard";
import { UserActions } from "@/components/auth/user-actions";
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
      return <DashboardUnavailable reason="Your SwimSight data has been removed. Identity deletion is still being finalized, so this session cannot recreate the account." />;
    }
    logServerError("Account bootstrap failed", error);
    return <DashboardUnavailable reason="Google sign-in worked, but SwimSight could not create your account record in the database yet." />;
  }

  if (!context) {
    return <LandingPage />;
  }

  if (!hasDatabaseConfig()) {
    return <DashboardUnavailable reason="SwimSight needs a production database before accounts can save data." />;
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
      />
    );
  } catch (error) {
    logServerError("Dashboard bootstrap failed", error);
    return <DashboardUnavailable reason="Your account is signed in, but SwimSight could not reach the dashboard database yet." />;
  }
}

function DashboardUnavailable({ reason }: { reason: string }) {
  return (
    <main className="dark min-h-screen bg-[#050b14] text-white">
      <header className="border-b border-white/10 bg-[#050b14]/85 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1180px] items-center justify-between px-5">
          <span className="text-sm font-semibold">SwimSight</span>
          <UserActions />
        </div>
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1180px] items-center px-5 py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-stitch-cyan">Signed in successfully</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            The dashboard connection needs one last backend step.
          </h1>
          <p className="mt-6 text-lg leading-8 text-white/78">{reason}</p>
          <div className="mt-8 rounded-lg border border-white/20 bg-white/10 p-5 text-sm leading-7 text-white/78">
            Make sure Vercel has `DATABASE_URL`, then redeploy so Prisma migrations run. Once the database is ready, this page becomes your empty personal dashboard with manual entry, spreadsheet import, goals, meets, communities, and analytics.
          </div>
        </div>
      </section>
    </main>
  );
}
