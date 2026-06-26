"use client";

import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowRight, BarChart3, CalendarClock, LayoutDashboard, ListPlus, Medal, Target, TrendingUp, Users, Waves } from "lucide-react";
import { CommunityHub } from "@/components/community-hub";
import { CsvImporter } from "@/components/csv-importer";
import { EventRankings } from "@/components/event-rankings";
import { GoalTracker } from "@/components/goal-tracker";
import { ManualTimeEntry } from "@/components/manual-time-entry";
import { MotivationPanel } from "@/components/motivation-panel";
import { PersonalBestTable } from "@/components/personal-best-table";
import { PredictionGrid } from "@/components/prediction-grid";
import { ProgressionChart } from "@/components/progression-chart";
import { SwimPowerIndexPanel } from "@/components/swim-power-index";
import { UpcomingMeetPanel } from "@/components/upcoming-meet-panel";
import { UserActions } from "@/components/auth/user-actions";
import { Dock } from "@/components/ui/dock";
import { formatTime } from "@/lib/utils";
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
  const primaryPrediction = [...analytics.predictions].sort((a, b) => b.confidence - a.confidence)[0];

  return (
    <main className="dark dashboard-shell min-h-screen text-stitch-text">
      <header className="sticky top-0 z-40 border-b border-white/45 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow"><Waves aria-hidden className="h-5 w-5" /></span><div><div className="font-semibold text-stitch-abyss">SwimSight</div><div className="text-xs text-stitch-abyss/55">Performance workspace</div></div></div>
          <UserActions />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-32 pt-7 sm:px-6 lg:px-8">
        <section className="dashboard-hero dashboard-enter mb-6 overflow-hidden rounded-lg border border-white/65 p-5 text-stitch-abyss shadow-stitch sm:p-6 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-aqua-600">Live training workspace</p>
              <h1 className="mt-2 text-balance text-3xl font-semibold tracking-normal sm:text-5xl">
                Your season, lit up by the times you enter.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-stitch-abyss/64 sm:text-base">
                Add a swim, set your next meet, and SwimSight turns your race history into trends, goals, predictions, and private comparison.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <QuickAction label="Add result" onClick={() => setActiveTab("results")} />
                <QuickAction label="View predictions" onClick={() => setActiveTab("analytics")} secondary />
              </div>
            </div>
            <PredictionSpotlight prediction={primaryPrediction} hasResults={hasResults} onAddResult={() => setActiveTab("results")} />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Logged" value={overview.totalSwims.toString()} />
            <MiniStat label="PB events" value={overview.personalBestCount.toString()} />
            <MiniStat label="SPI" value={analytics.swimPowerIndex.score.toString()} />
          </div>
        </section>

        {activeTab === "overview" && (
          <DashboardPanel>
            <SectionHeading eyebrow="Your season" title="Performance overview" />
            {!hasResults ? (
              <EmptyState title="Your dashboard is ready." body="Add your first result to unlock personal bests, trends, predictions, and your Swim Power Index." action="Add a result" onAction={() => setActiveTab("results")} />
            ) : (
              <>
                <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                  <SwimPowerIndexPanel spi={analytics.swimPowerIndex} />
                  <SeasonSnapshot overview={overview} />
                </section>
                <ProgressionChart swims={swims} />
              </>
            )}
            <MotivationPanel />
          </DashboardPanel>
        )}

        {activeTab === "results" && <DashboardPanel><SectionHeading eyebrow="Race history" title="Results" /><ManualTimeEntry /><CsvImporter />{analytics.personalBests.length > 0 && <PersonalBestTable personalBests={analytics.personalBests} />}</DashboardPanel>}

        {activeTab === "analytics" && <DashboardPanel><SectionHeading eyebrow="Your data" title="Analytics" />{hasResults ? <><PredictionGrid predictions={analytics.predictions} /><ProgressionChart swims={swims} /><EventRankings strongestEvents={analytics.strongestEvents} weakestEvents={analytics.weakestEvents} /></> : <EmptyState title="No analytics yet." body="Your charts and predictions will appear after you add race results." action="Add a result" onAction={() => setActiveTab("results")} />}</DashboardPanel>}

        {activeTab === "goals" && <DashboardPanel><SectionHeading eyebrow="What comes next" title="Goals & meets" /><GoalTracker initialGoal={goals[0]} swims={swims} /><UpcomingMeetPanel /></DashboardPanel>}

        {activeTab === "community" && <DashboardPanel><SectionHeading eyebrow="Private comparison" title="Community" /><CommunityHub /></DashboardPanel>}
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

function DashboardPanel({ children }: { children: ReactNode }) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
      initial={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><p className="text-sm font-semibold text-stitch-abyss/58">{eyebrow}</p><h2 className="mt-1 text-3xl font-semibold tracking-normal text-stitch-abyss sm:text-4xl">{title}</h2></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/60 bg-white/45 p-4 backdrop-blur-xl"><div className="text-xs font-semibold uppercase text-stitch-abyss/48">{label}</div><div className="mt-1 font-mono text-3xl font-semibold text-stitch-abyss">{value}</div></div>;
}

function QuickAction({ label, onClick, secondary = false }: { label: string; onClick: () => void; secondary?: boolean }) {
  return (
    <button
      className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
        secondary
          ? "border border-stitch-abyss/15 bg-white/45 text-stitch-abyss hover:bg-white"
          : "bg-stitch-abyss text-white shadow-[0_16px_40px_rgba(4,17,29,0.18)] hover:bg-[#10243a]"
      }`}
      type="button"
      onClick={onClick}
    >
      {label}
      <ArrowRight aria-hidden className="h-4 w-4" />
    </button>
  );
}

function PredictionSpotlight({
  hasResults,
  onAddResult,
  prediction
}: {
  hasResults: boolean;
  onAddResult: () => void;
  prediction?: DashboardAnalytics["predictions"][number];
}) {
  return (
    <motion.article
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-lg border border-white/70 bg-white/58 p-4 shadow-[0_24px_90px_rgba(4,17,29,0.10)] backdrop-blur-2xl"
      initial={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan">
            <CalendarClock aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Next prediction</p>
            <p className="text-xs text-stitch-abyss/55">{prediction ? `${prediction.confidence}% confidence` : "Waiting for your first result"}</p>
          </div>
        </div>
        {prediction && <span className="rounded-full bg-stitch-abyss px-3 py-1 font-mono text-xs font-semibold text-stitch-cyan">{prediction.event}</span>}
      </div>

      {prediction ? (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <PredictionMini label="Now" value={formatTime(prediction.currentTime)} />
          <PredictionMini label="90d" value={formatTime(prediction.predictedTimes.days90)} />
          <PredictionMini label="365d" value={formatTime(prediction.predictedTimes.days365)} />
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-stitch-abyss/15 bg-white/45 p-4">
          <p className="text-sm leading-6 text-stitch-abyss/64">
            {hasResults ? "Add another event to expand your forecast." : "Add a time and SwimSight will generate your first baseline forecast."}
          </p>
          <button className="mt-3 text-sm font-semibold text-aqua-700" type="button" onClick={onAddResult}>
            Add result
          </button>
        </div>
      )}
    </motion.article>
  );
}

function PredictionMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/60 bg-white/54 p-3">
      <div className="text-xs font-semibold uppercase text-stitch-abyss/46">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold text-stitch-abyss">{value}</div>
    </div>
  );
}

function SeasonSnapshot({ overview }: { overview: DashboardAnalytics["overview"] }) {
  return (
    <section className="dashboard-glass p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Season snapshot</h2>
          <p className="mt-1 text-sm text-white/70">The clean read before you go deeper.</p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-aqua-100">
          {overview.weeklyImprovement}% week
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <SnapshotMetric detail={`${overview.personalBestCount} PB events`} icon={Activity} label="Logged" value={overview.totalSwims.toString()} />
        <SnapshotMetric detail={overview.bestEvent ?? "No ranking yet"} icon={Medal} label="Strongest" value={overview.bestEvent ? "Top 1" : "—"} />
        <SnapshotMetric detail={overview.mostImprovedEvent ?? "No trend yet"} icon={TrendingUp} label="Year pace" value={`${overview.yearlyImprovement}%`} />
      </div>
    </section>
  );
}

function SnapshotMetric({
  detail,
  icon: Icon,
  label,
  value
}: {
  detail: string;
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.08] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/56">{label}</span>
        <Icon aria-hidden className="h-4 w-4 text-aqua-200" />
      </div>
      <div className="mt-4 font-mono text-2xl font-semibold text-white">{value}</div>
      <p className="mt-1 text-sm text-white/62">{detail}</p>
    </div>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return <section className="dashboard-glass flex min-h-[420px] items-center justify-center px-6 text-center"><div className="max-w-lg"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stitch-abyss text-stitch-cyan shadow-glow"><Waves aria-hidden className="h-6 w-6" /></div><h2 className="mt-6 text-3xl font-semibold text-white">{title}</h2><p className="mt-4 leading-7 text-white/78">{body}</p><button className="mt-7 h-11 rounded-full bg-white px-6 text-sm font-semibold text-stitch-abyss transition hover:bg-stitch-cyan" type="button" onClick={onAction}>{action}</button></div></section>;
}
