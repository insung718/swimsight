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
import { Dock } from "@/components/ui/dock";
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
    <main className="dark dashboard-shell min-h-screen text-stitch-text">
      <header className="sticky top-0 z-40 border-b border-white/45 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow"><Waves aria-hidden className="h-5 w-5" /></span><div><div className="font-semibold text-stitch-abyss">SwimSight</div><div className="text-xs text-stitch-abyss/55">Performance workspace</div></div></div>
          <UserActions />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-32 pt-7 sm:px-6 lg:px-8">
        <section className="dashboard-hero dashboard-enter mb-6 overflow-hidden rounded-lg border border-white/65 p-5 text-stitch-abyss shadow-stitch sm:p-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-aqua-600">Live training workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-4xl">
              Your season, lit up by the times you enter.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stitch-abyss/64 sm:text-base">
              Add a swim, set your next meet, and SwimSight turns your own race history into trends, goals, predictions, and private comparison.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Logged" value={overview.totalSwims.toString()} />
            <MiniStat label="PB events" value={overview.personalBestCount.toString()} />
            <MiniStat label="SPI" value={analytics.swimPowerIndex.score.toString()} />
          </div>
        </section>

        {activeTab === "overview" && (
          <div className="dashboard-enter-delayed space-y-5">
            <SectionHeading eyebrow="Your season" title="Performance overview" />
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

        {activeTab === "results" && <div className="dashboard-enter-delayed space-y-5"><SectionHeading eyebrow="Race history" title="Results" /><ManualTimeEntry /><CsvImporter />{analytics.personalBests.length > 0 && <PersonalBestTable personalBests={analytics.personalBests} />}</div>}

        {activeTab === "analytics" && <div className="dashboard-enter-delayed space-y-5"><SectionHeading eyebrow="Your data" title="Analytics" />{hasResults ? <><ProgressionChart swims={swims} /><EventRankings strongestEvents={analytics.strongestEvents} weakestEvents={analytics.weakestEvents} /><PredictionGrid predictions={analytics.predictions} /></> : <EmptyState title="No analytics yet." body="Your charts and predictions will appear after you add race results." action="Add a result" onAction={() => setActiveTab("results")} />}</div>}

        {activeTab === "goals" && <div className="dashboard-enter-delayed space-y-5"><SectionHeading eyebrow="What comes next" title="Goals & meets" /><GoalTracker initialGoal={goals[0]} swims={swims} /><UpcomingMeetPanel /></div>}

        {activeTab === "community" && <div className="dashboard-enter-delayed space-y-5"><SectionHeading eyebrow="Private comparison" title="Community" /><CommunityHub /></div>}
      </div>
      <Dock
        items={tabs.map(({ id, label, icon: Icon }) => ({
          active: activeTab === id,
          icon: <Icon aria-hidden className="h-5 w-5" />,
          label,
          onClick: () => setActiveTab(id)
        }))}
      />
    </main>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-sm font-semibold text-stitch-abyss/58">{eyebrow}</p><h2 className="mt-1 text-3xl font-semibold tracking-normal text-stitch-abyss sm:text-4xl">{title}</h2></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/60 bg-white/45 p-4 backdrop-blur-xl"><div className="text-xs font-semibold uppercase text-stitch-abyss/48">{label}</div><div className="mt-1 font-mono text-3xl font-semibold text-stitch-abyss">{value}</div></div>;
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return <section className="dashboard-glass flex min-h-[420px] items-center justify-center px-6 text-center"><div className="max-w-lg"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stitch-abyss text-stitch-cyan shadow-glow"><Waves aria-hidden className="h-6 w-6" /></div><h2 className="mt-6 text-3xl font-semibold text-white">{title}</h2><p className="mt-4 leading-7 text-white/78">{body}</p><button className="mt-7 h-11 rounded-full bg-white px-6 text-sm font-semibold text-stitch-abyss transition hover:bg-stitch-cyan" type="button" onClick={onAction}>{action}</button></div></section>;
}
