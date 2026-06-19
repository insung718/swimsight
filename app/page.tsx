import { LandingPage } from "@/components/landing/landing-page";
import { SwimSightDashboard } from "@/components/swimsight-dashboard";
import { getAuthContext } from "@/lib/auth-context";
import { hasDatabaseConfig } from "@/lib/prisma";
import { getDashboardAnalyticsForUser, getPrimaryGoal, getSwimsForUser } from "@/lib/services/swim-service";

export const dynamic = "force-dynamic";

export default async function Home() {
  const context = await getAuthContext();

  if (!context || !hasDatabaseConfig()) {
    return <LandingPage />;
  }

  const [analytics, goal, swims] = await Promise.all([
    getDashboardAnalyticsForUser(context.userId),
    getPrimaryGoal(context.userId),
    getSwimsForUser(context.userId)
  ]);

  return (
    <SwimSightDashboard
      analytics={analytics}
      goals={goal ? [goal] : []}
      swims={swims}
    />
  );
}
