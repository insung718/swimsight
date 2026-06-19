"use client";

import { useState } from "react";
import { Activity, BarChart3, LayoutDashboard, ListPlus, Medal, Target, TrendingUp, Users, Waves } from "lucide-react";
import { CommunityHub } from "@/components/community-hub";
import { CsvImporter } from "@/components/csv-importer";
import { EventRankings } from "@/components/event-rankings";
import { GoalTracker } from "@/components/goal-tracker";
import { ManualTimeEntry } from "@/components/manual-time-entry";
import { MetricCard } from "@/components/metric-card";
import { MotivationPanel } from "@/components/motivation-panel";
import { PersonalBestTable } from "@/components/personal-best-table";
import { PredictionGrid } from "@/components/prediction-grid";
import { ProgressionChart } from "@/components/progression-chart";
import { SwimPowerIndexPanel } from "@/components/swim-power-index";
import { UpcomingMeetPanel } from "@/components/upcoming-meet-panel";
import { UserActions } from "@/components/auth/user-actions";
import { cn } from "@/lib/utils";
import type { DashboardAnalytics, Goal, SwimResult } from "@/types/swim";

type DashboardTab = "overview" | "results" | "analytics" | "goals" | "community";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "results", label: "Results", icon: ListPlus },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "goals", label: "Goals & Meets", icon: Target },
  { id: "community", label: "Community", icon: Users }
] as const;

export function SwimSightDashboard({ analytics, goals, swims }: { analytics: DashboardAnalytics; goals: Goal[]; swims: SwimResult[] }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const overview = analytics.overview;
  const hasResults = swims.length > 0;

  return (
    <main className="dark min-h-screen bg-[#050b14] text-stitch-text">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#050b14]/88 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-cyan text-stitch-abyss"><Waves aria-hidden className="h-5 w-5" /></span><div><div className="font-semibold text-white">SwimSight</div><div className="text-xs text-white/40">Performance workspace</div></div></div>
          <UserActions />
        </div>
        <div className="mx-auto max-w-[1440px] overflow-x-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex min-w-max gap-1" aria-label="Dashboard sections">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setActiveTab(id)} className={cn("inline-flex h-12 items-center gap-2 border-b-2 px-4 text-sm transition", activeTab === id ? "border-stitch-cyan text-white" : "border-transparent text-white/45 hover:text-white/80")}>
                <Icon aria-hidden className="h-4 w-4" />{label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "overview" && (
          <div className="space-y-5">
            <div><p className="text-sm text-stitch-cyan">Your season</p><h1 className="mt-1 text-3xl font-semibold text-white sm:text-4xl">Performance overview</h1></div>
            {!hasResults ? (
              <EmptyState title="Your dashboard is ready." body="Add your first result to unlock personal bests, trends, predictions, and your Swim Power Index." action="Add a result" onAction={() => setActiveTab("results")} />
            ) : (
              <>
                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard detail={`${overview.personalBestCount} events with PBs`} icon={Activity} label="Swims Logged" value={overview.totalSwims.toString()} />
                  <MetricCard detail={overview.bestEvent ?? "No ranking yet"} icon={Medal} label="Strongest Event" tone="mint" value={overview.bestEvent ? "Top 1" : "—"} />
                  <MetricCard detail={overview.mostImprovedEvent ?? "No trend yet"} icon={TrendingUp} label="Most Improved" tone="coral" value={`${overview.yearlyImprovement}%`} />
                  <MetricCard detail={`${overview.monthlyImprovement}% monthly`} icon={Waves} label="PB Count" tone="navy" value={overview.personalBestCount.toString()} />
                </section>
                <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]"><SwimPowerIndexPanel spi={analytics.swimPowerIndex} /><ProgressionChart swims={swims} /></div>
              </>
            )}
            <MotivationPanel />
          </div>
        )}

        {activeTab === "results" && <div className="space-y-5"><div><p className="text-sm text-stitch-cyan">Race history</p><h1 className="mt-1 text-3xl font-semibold text-white">Results</h1></div><ManualTimeEntry /><CsvImporter />{analytics.personalBests.length > 0 && <PersonalBestTable personalBests={analytics.personalBests} />}</div>}

        {activeTab === "analytics" && <div className="space-y-5"><div><p className="text-sm text-stitch-cyan">Your data</p><h1 className="mt-1 text-3xl font-semibold text-white">Analytics</h1></div>{hasResults ? <><ProgressionChart swims={swims} /><EventRankings strongestEvents={analytics.strongestEvents} weakestEvents={analytics.weakestEvents} /><PredictionGrid predictions={analytics.predictions} /></> : <EmptyState title="No analytics yet." body="Your charts and predictions will appear after you add race results." action="Add a result" onAction={() => setActiveTab("results")} />}</div>}

        {activeTab === "goals" && <div className="space-y-5"><div><p className="text-sm text-stitch-cyan">What comes next</p><h1 className="mt-1 text-3xl font-semibold text-white">Goals & meets</h1></div><GoalTracker initialGoal={goals[0]} swims={swims} /><UpcomingMeetPanel /></div>}

        {activeTab === "community" && <div className="space-y-5"><div><p className="text-sm text-stitch-cyan">Private comparison</p><h1 className="mt-1 text-3xl font-semibold text-white">Community</h1></div><CommunityHub /></div>}
      </div>
    </main>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return <section className="flex min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-6 text-center"><div className="max-w-lg"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stitch-cyan/10 text-stitch-cyan"><Waves aria-hidden className="h-6 w-6" /></div><h2 className="mt-6 text-3xl font-semibold text-white">{title}</h2><p className="mt-4 leading-7 text-white/48">{body}</p><button className="mt-7 h-11 rounded-full bg-stitch-cyan px-6 text-sm font-semibold text-stitch-abyss transition hover:bg-white" type="button" onClick={onAction}>{action}</button></div></section>;
}
