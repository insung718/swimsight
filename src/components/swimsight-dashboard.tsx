"use client";

import {
  Activity,
  Gauge,
  Medal,
  Radio,
  Target,
  Timer,
  TrendingUp,
  Waves
} from "lucide-react";
import { CsvImporter } from "@/components/csv-importer";
import { CommunityHub } from "@/components/community-hub";
import { EventRankings } from "@/components/event-rankings";
import { GoalTracker } from "@/components/goal-tracker";
import { ManualTimeEntry } from "@/components/manual-time-entry";
import { MetricCard } from "@/components/metric-card";
import { MotivationPanel } from "@/components/motivation-panel";
import { PersonalBestTable } from "@/components/personal-best-table";
import { PredictionGrid } from "@/components/prediction-grid";
import { ProgressionChart } from "@/components/progression-chart";
import { SwimPowerIndexPanel } from "@/components/swim-power-index";
import { TeamDashboard } from "@/components/team-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpcomingMeetPanel } from "@/components/upcoming-meet-panel";
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
    <main className="dark min-h-screen overflow-hidden bg-stitch-bg text-stitch-text">
      <div className="pointer-events-none fixed inset-0 opacity-90">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(0,251,255,0.18),transparent_32rem),radial-gradient(circle_at_90%_10%,rgba(3,168,232,0.14),transparent_28rem),linear-gradient(180deg,#081424_0%,#040e1e_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-stitch-cyan/50" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="stitch-panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded bg-stitch-cyan text-stitch-abyss shadow-glow">
              <Waves aria-hidden className="h-6 w-6" />
            </span>
            <div>
              <p className="stitch-label">Elite aquatic intelligence</p>
              <h1 className="text-2xl font-black text-white">SwimSight</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-full border border-stitch-cyan/30 bg-stitch-cyan/10 px-3 text-xs font-bold uppercase tracking-[0.14em] text-stitch-cyan">
              <span className="h-2 w-2 rounded-full bg-stitch-cyan shadow-glow" />
              Live analytics
            </span>
            <ThemeToggle />
            <UserActions />
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
          <div className="stitch-panel relative min-h-[360px] overflow-hidden p-5 sm:p-6">
            <div className="absolute inset-0 pool-visual opacity-75" />
            <div className="absolute inset-x-8 top-[23%] h-1 rounded-full lane-rope opacity-90" />
            <div className="absolute inset-x-8 top-[39%] h-1 rounded-full lane-rope opacity-90" />
            <div className="absolute inset-x-8 top-[55%] h-1 rounded-full lane-rope opacity-90" />
            <div className="absolute inset-x-8 top-[71%] h-1 rounded-full lane-rope opacity-90" />
            <div className="absolute left-6 top-6 grid grid-cols-6 gap-2 opacity-90">
              {Array.from({ length: 6 }).map((_, index) => (
                <span className="h-8 w-10 rounded-sm border border-white/30 bg-white/12" key={index} />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-stitch-abyss via-stitch-abyss/70 to-transparent" />
            <div className="relative flex h-full max-w-2xl flex-col justify-between gap-8">
              <div>
                <p className="stitch-label text-stitch-cyan">Olympic pool command center</p>
                <h2 className="mt-3 max-w-xl text-4xl font-black leading-tight text-white sm:text-5xl">
                  Race faster with every split, goal, and friend comparison in one cockpit.
                </h2>
                <p className="mt-4 max-w-lg text-base leading-7 text-stitch-muted">
                  Account-backed analytics, manual entries, CSV imports, upcoming meets, communities, and predictions wired into the v1 backend.
                </p>
              </div>
              <div className="grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="stitch-panel-soft p-3">
                  <Timer aria-hidden className="h-5 w-5 text-stitch-cyan" />
                  <div className="stitch-data mt-3 text-2xl font-bold">{overview.totalSwims}</div>
                  <div className="mt-1 text-xs text-stitch-muted">Swims</div>
                </div>
                <div className="stitch-panel-soft p-3">
                  <Gauge aria-hidden className="h-5 w-5 text-stitch-cyan" />
                  <div className="stitch-data mt-3 text-2xl font-bold">{analytics.swimPowerIndex.score}</div>
                  <div className="mt-1 text-xs text-stitch-muted">SPI</div>
                </div>
                <div className="stitch-panel-soft p-3">
                  <Target aria-hidden className="h-5 w-5 text-stitch-cyan" />
                  <div className="stitch-data mt-3 text-2xl font-bold">{overview.yearlyImprovement}%</div>
                  <div className="mt-1 text-xs text-stitch-muted">Year gain</div>
                </div>
                <div className="stitch-panel-soft p-3">
                  <Radio aria-hidden className="h-5 w-5 text-stitch-cyan" />
                  <div className="stitch-data mt-3 text-2xl font-bold">V1</div>
                  <div className="mt-1 text-xs text-stitch-muted">Backend</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            <SwimPowerIndexPanel spi={analytics.swimPowerIndex} />
            <UpcomingMeetPanel />
          </div>
        </section>

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

        <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <MotivationPanel />
          <ProgressionChart swims={swims} />
        </div>

        <EventRankings strongestEvents={analytics.strongestEvents} weakestEvents={analytics.weakestEvents} />

        <div className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <PersonalBestTable personalBests={analytics.personalBests} />
          <PredictionGrid predictions={analytics.predictions} />
        </div>

        <GoalTracker initialGoal={goals[0]} swims={swims} />

        <ManualTimeEntry />

        <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_1fr]">
          <CsvImporter />
          <TeamDashboard members={teamMembers} />
        </div>

        <CommunityHub />
      </div>
    </main>
  );
}
