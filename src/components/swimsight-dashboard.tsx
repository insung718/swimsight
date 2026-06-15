"use client";

import { Activity, Medal, TrendingUp, Waves } from "lucide-react";
import { CsvImporter } from "@/components/csv-importer";
import { EventRankings } from "@/components/event-rankings";
import { GoalTracker } from "@/components/goal-tracker";
import { MetricCard } from "@/components/metric-card";
import { PersonalBestTable } from "@/components/personal-best-table";
import { PredictionGrid } from "@/components/prediction-grid";
import { ProgressionChart } from "@/components/progression-chart";
import { SwimPowerIndexPanel } from "@/components/swim-power-index";
import { TeamDashboard } from "@/components/team-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserActions } from "@/components/auth/user-actions";
import type { DashboardAnalytics, Goal, SwimResult, TeamMemberAnalytics } from "@/types/swim";

interface SwimSightDashboardProps {
  analytics: DashboardAnalytics;
  goals: Goal[];
  swims: SwimResult[];
  teamMembers: TeamMemberAnalytics[];
}

export function SwimSightDashboard({
  analytics,
  goals,
  swims,
  teamMembers
}: SwimSightDashboardProps) {
  const overview = analytics.overview;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,201,232,0.16),transparent_32rem),linear-gradient(180deg,#f8fbfd_0%,#eef6fa_100%)] text-navy-950 dark:bg-[radial-gradient(circle_at_top_left,rgba(34,201,232,0.14),transparent_28rem),linear-gradient(180deg,#04111d_0%,#061827_100%)] dark:text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="flex flex-col gap-4 rounded-lg border border-white/70 bg-white/80 p-4 shadow-panel backdrop-blur dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-navy-950 text-aqua-400 dark:bg-aqua-400 dark:text-navy-950">
              <Waves aria-hidden className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-navy-950 dark:text-white">SwimSight</h1>
              <p className="text-sm text-navy-500 dark:text-navy-100">Competitive swim analytics dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserActions />
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            detail={`${overview.personalBestCount} events with PBs`}
            icon={Activity}
            label="Swims Logged"
            tone="aqua"
            value={overview.totalSwims.toString()}
          />
          <MetricCard
            detail={overview.bestEvent}
            icon={Medal}
            label="Strongest Event"
            tone="mint"
            value="Top 1"
          />
          <MetricCard
            detail={overview.mostImprovedEvent}
            icon={TrendingUp}
            label="Most Improved"
            tone="coral"
            value={`${overview.yearlyImprovement}%`}
          />
          <MetricCard
            detail={`${overview.monthlyImprovement}% monthly · ${overview.weeklyImprovement}% weekly`}
            icon={Waves}
            label="PB Count"
            tone="navy"
            value={overview.personalBestCount.toString()}
          />
        </section>

        <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
          <SwimPowerIndexPanel spi={analytics.swimPowerIndex} />
          <ProgressionChart swims={swims} />
        </div>

        <EventRankings strongestEvents={analytics.strongestEvents} weakestEvents={analytics.weakestEvents} />

        <div className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <PersonalBestTable personalBests={analytics.personalBests} />
          <PredictionGrid predictions={analytics.predictions} />
        </div>

        <GoalTracker initialGoal={goals[0]} swims={swims} />

        <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_1fr]">
          <CsvImporter />
          <TeamDashboard members={teamMembers} />
        </div>
      </div>
    </main>
  );
}
