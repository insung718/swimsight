import { SwimSightDashboard } from "@/components/swimsight-dashboard";
import { buildDashboardAnalytics } from "@/lib/analytics";
import { sampleGoals, sampleSwims, sampleTeamAnalytics } from "@/lib/sample-data";

export default function Home() {
  const analytics = buildDashboardAnalytics(sampleSwims, sampleGoals[0]);

  return (
    <SwimSightDashboard
      analytics={analytics}
      goals={sampleGoals}
      swims={sampleSwims}
      teamMembers={sampleTeamAnalytics}
    />
  );
}
