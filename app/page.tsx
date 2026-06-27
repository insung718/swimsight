import { LandingPage } from "@/components/landing/landing-page";
import { CoachDashboard } from "@/components/coach-dashboard";
import { RoleOnboarding } from "@/components/role-onboarding";
import { SwimSightDashboard } from "@/components/swimsight-dashboard";
import { UserActions } from "@/components/auth/user-actions";
import { getAuthContext } from "@/lib/auth-context";
import { buildDashboardAnalytics } from "@/lib/analytics";
import { hasDatabaseConfig } from "@/lib/prisma";
import { logServerError } from "@/lib/security/logging";
import { getCoachDashboard } from "@/lib/services/coach-service";
import { getGymWorkoutsForUser } from "@/lib/services/gym-service";
import { getPrimaryGoal, getSwimsForUser } from "@/lib/services/swim-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  let context;

  try {
    context = await getAuthContext();
  } catch (error) {
    logServerError("Account bootstrap failed", error);
    return <DashboardUnavailable reason="Google sign-in worked, but SwimSight could not create your account record in the database yet." />;
  }

  if (!context) {
    return <LandingPage />;
  }

  if (!hasDatabaseConfig()) {
    return <DashboardUnavailable reason="SwimSight needs a production database before accounts can save data." />;
  }

  if (!context.onboardingCompleted) {
    return <RoleOnboarding />;
  }

  try {
    if (context.role === "COACH" || context.role === "ADMIN") {
      const dashboard = await getCoachDashboard(context.userId);
      return <CoachDashboard dashboard={dashboard} />;
    }

    const [goal, swims, gymWorkouts] = await Promise.all([
      getPrimaryGoal(context.userId),
      getSwimsForUser(context.userId),
      getGymWorkoutsForUser(context.userId)
    ]);
    const analytics = buildDashboardAnalytics(swims, goal ?? undefined, gymWorkouts);

    return (
      <SwimSightDashboard
        analytics={analytics}
        gymWorkouts={gymWorkouts}
        goals={goal ? [goal] : []}
        swims={swims}
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
            Make sure Vercel has `DATABASE_URL`, then redeploy so Prisma migrations run. Once the database is ready, this page becomes your empty personal dashboard with manual entry, CSV import, goals, meets, communities, and analytics.
          </div>
        </div>
      </section>
    </main>
  );
}
