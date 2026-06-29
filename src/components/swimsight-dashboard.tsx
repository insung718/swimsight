"use client";

import { type ReactNode, useState } from "react";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, ArrowRight, BarChart3, CalendarClock, Dumbbell, Gauge, LayoutDashboard, ListPlus, Medal, Sparkles, Target, TrendingUp, UserRound, Waves } from "lucide-react";
import { AthleteProfilePanel } from "@/components/athlete-profile-panel";
import { CommunityHub } from "@/components/community-hub";
import { CsvImporter } from "@/components/csv-importer";
import { useTranslator } from "@/components/i18n/use-language";
import { EventRankings } from "@/components/event-rankings";
import { GoalTracker } from "@/components/goal-tracker";
import { GymWorkoutPanel } from "@/components/gym-workout-panel";
import { LanguageToggle } from "@/components/landing/language-toggle";
import { ManualTimeEntry } from "@/components/manual-time-entry";
import { MeetDatabasePanel } from "@/components/meet-database-panel";
import { MotivationPanel } from "@/components/motivation-panel";
import { PersonalBestTable } from "@/components/personal-best-table";
import { PredictionGrid } from "@/components/prediction-grid";
import { ProgressionChart } from "@/components/progression-chart";
import { SwimPowerIndexPanel } from "@/components/swim-power-index";
import { StrokeSpecialtyPentagon } from "@/components/stroke-specialty-pentagon";
import { UpcomingMeetPanel } from "@/components/upcoming-meet-panel";
import { UserActions } from "@/components/auth/user-actions";
import { Counter } from "@/components/ui/counter";
import { Dock } from "@/components/ui/dock";
import { FlipText } from "@/components/ui/flip-text";
import { formatTime } from "@/lib/utils";
import type { DashboardAnalytics, Goal, GymWorkout, SwimResult } from "@/types/swim";

type DashboardTab = "overview" | "results" | "analytics" | "training" | "goals" | "profile";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "results", label: "Results", icon: ListPlus },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "training", label: "Training", icon: Dumbbell },
  { id: "goals", label: "Goals & Meets", icon: Target },
  { id: "profile", label: "Profile", icon: UserRound }
] as const;

export function SwimSightDashboard({
  analytics,
  gymWorkouts,
  goals,
  swims
}: {
  analytics: DashboardAnalytics;
  gymWorkouts: GymWorkout[];
  goals: Goal[];
  swims: SwimResult[];
}) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const overview = analytics.overview;
  const officialSwims = swims.filter((swim) => (swim.resultKind ?? "OFFICIAL") === "OFFICIAL");
  const trainingSwims = swims.filter((swim) => (swim.resultKind ?? "OFFICIAL") === "TRAINING");
  const hasResults = officialSwims.length > 0;
  const primaryPrediction = [...analytics.predictions].sort((a, b) => b.confidence - a.confidence)[0];

  return (
    <main className="dark dashboard-shell min-h-screen text-stitch-text">
      <header className="sticky top-0 z-40 border-b border-white/45 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button className="flex items-center gap-3 text-left transition hover:opacity-80" type="button" onClick={() => setActiveTab("overview")}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow"><Waves aria-hidden className="h-5 w-5" /></span>
            <span><span className="block font-semibold text-stitch-abyss">SwimSight</span><span className="block text-xs text-stitch-abyss/55">Performance workspace</span></span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <UserActions />
          </div>
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
              <p className="mt-4 max-w-2xl text-sm leading-6 text-stitch-abyss/64 sm:text-base">Log. Read. Adjust.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <QuickAction label="Add result" onClick={() => setActiveTab("results")} />
                <QuickAction label="Log gym" onClick={() => setActiveTab("training")} secondary />
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
                  <SeasonSnapshot overview={overview} prediction={primaryPrediction} trainingLoad={analytics.trainingLoad} onViewPredictions={() => setActiveTab("analytics")} />
                </section>
                <ProgressionChart swims={officialSwims} />
              </>
            )}
            <MotivationPanel />
          </DashboardPanel>
        )}

        {activeTab === "results" && <DashboardPanel><SectionHeading eyebrow="Race history" title="Results" /><ResultSplitSummary officialCount={officialSwims.length} trainingCount={trainingSwims.length} /><ManualTimeEntry swims={swims} /><CsvImporter /><MeetDatabasePanel swims={swims} />{analytics.personalBests.length > 0 && <PersonalBestTable personalBests={analytics.personalBests} />}</DashboardPanel>}

        {activeTab === "analytics" && <DashboardPanel><SectionHeading eyebrow="Your data" title="Analytics" />{hasResults ? <><section className="grid gap-4 lg:grid-cols-3"><SpiExplainer analytics={analytics} /><DataQualityPanel swims={officialSwims} /><EventIntelligencePanel analytics={analytics} /></section><PredictionGrid predictions={analytics.predictions} /><StrokeSpecialtyPentagon profile={analytics.specialtyProfile} /><ProgressionChart swims={officialSwims} /><EventRankings strongestEvents={analytics.strongestEvents} weakestEvents={analytics.weakestEvents} /></> : <EmptyState title="No official meet results yet." body="Training times are saved separately. Add an official meet result to unlock PBs, SPI, predictions, and awards." action="Add official result" onAction={() => setActiveTab("results")} />}</DashboardPanel>}

        {activeTab === "training" && <DashboardPanel><SectionHeading eyebrow="Dryland signal" title="Training" /><GymWorkoutPanel trainingLoad={analytics.trainingLoad} workouts={gymWorkouts} /></DashboardPanel>}

        {activeTab === "goals" && <DashboardPanel><SectionHeading eyebrow="What comes next" title="Goals & meets" /><GoalTracker initialGoal={goals[0]} swims={swims} /><UpcomingMeetPanel /></DashboardPanel>}

        {activeTab === "profile" && <DashboardPanel><SectionHeading eyebrow="Athlete page" title="Profile & community" /><AthleteProfilePanel analytics={analytics} goals={goals} swims={swims} workouts={gymWorkouts} /><CommunityHub /></DashboardPanel>}
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
  const { t } = useTranslator();
  const translatedTitle = t(title);
  return <div data-no-translate><p className="text-sm font-semibold text-stitch-abyss/58">{t(eyebrow)}</p><h2 className="mt-1 text-3xl font-semibold tracking-normal text-stitch-abyss sm:text-4xl"><FlipText key={translatedTitle}>{translatedTitle}</FlipText></h2></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  const numericValue = Number(value);
  const shouldCount = Number.isInteger(numericValue) && /^\d+$/.test(value);

  return (
    <div className="rounded-lg border border-white/60 bg-white/45 p-4 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-white/58">
      <div className="text-xs font-semibold uppercase text-stitch-abyss/48">{t(label)}</div>
      <div className="mt-1 font-mono text-3xl font-semibold text-stitch-abyss">
        {shouldCount ? (
          <Counter fontSize={30} fontWeight={700} gradientFrom="rgba(255,255,255,0.64)" value={numericValue} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function ResultSplitSummary({ officialCount, trainingCount }: { officialCount: number; trainingCount: number }) {
  const { t } = useTranslator();

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-white/60 bg-white/55 p-4 text-stitch-abyss shadow-[0_18px_55px_rgba(4,17,29,0.07)] backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stitch-abyss/46">{t("Official meet times")}</p>
        <div className="mt-2 font-mono text-3xl font-semibold">{officialCount}</div>
        <p className="mt-2 text-sm text-stitch-abyss/58">{t("Counts toward PBs, SPI, predictions, rewards, and awards.")}</p>
      </div>
      <div className="rounded-lg border border-white/45 bg-white/35 p-4 text-stitch-abyss backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stitch-abyss/46">{t("Training / unofficial")}</p>
        <div className="mt-2 font-mono text-3xl font-semibold">{trainingCount}</div>
        <p className="mt-2 text-sm text-stitch-abyss/58">{t("Stored for context, but kept out of official rankings and badges.")}</p>
      </div>
    </section>
  );
}

function QuickAction({ label, onClick, secondary = false }: { label: string; onClick: () => void; secondary?: boolean }) {
  const { t } = useTranslator();

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
      {t(label)}
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
  const { t } = useTranslator();

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
            <p className="text-sm font-semibold">{t("Next prediction")}</p>
            <p className="text-xs text-stitch-abyss/55">{prediction ? `${prediction.confidence}% ${t("confidence")}` : t("Waiting for your first result")}</p>
          </div>
        </div>
        {prediction && <span className="rounded-full bg-stitch-abyss px-3 py-1 font-mono text-xs font-semibold text-stitch-cyan">{t(prediction.event)} · {prediction.course}</span>}
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
            {hasResults ? t("Add another event to expand your forecast.") : t("Add a time and SwimSight will generate your first baseline forecast.")}
          </p>
          <button className="mt-3 text-sm font-semibold text-aqua-700" type="button" onClick={onAddResult}>
            {t("Add result")}
          </button>
        </div>
      )}
    </motion.article>
  );
}

function PredictionMini({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();

  return (
    <div className="rounded-md border border-white/60 bg-white/54 p-3">
      <div className="text-xs font-semibold uppercase text-stitch-abyss/46">{t(label)}</div>
      <div className="mt-1 font-mono text-lg font-semibold text-stitch-abyss">{value}</div>
    </div>
  );
}

function SeasonSnapshot({
  onViewPredictions,
  overview,
  prediction,
  trainingLoad
}: {
  onViewPredictions: () => void;
  overview: DashboardAnalytics["overview"];
  prediction?: DashboardAnalytics["predictions"][number];
  trainingLoad: DashboardAnalytics["trainingLoad"];
}) {
  const { t } = useTranslator();

  return (
    <section className="dashboard-glass overflow-hidden p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Season intelligence")}</h2>
          <p className="mt-1 text-sm text-white/62">{t("What matters first.")}</p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-aqua-100">
          {overview.weeklyImprovement}% week
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <motion.button
          className="group relative overflow-hidden rounded-lg border border-aqua-200/20 bg-aqua-300/10 p-4 text-left sm:col-span-2 xl:row-span-2"
          type="button"
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.99 }}
          onClick={onViewPredictions}
        >
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(78,232,255,0.28),transparent_34%)] opacity-80 transition group-hover:opacity-100" />
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-aqua-100">{t("Prediction lane")}</span>
              <ArrowRight aria-hidden className="h-4 w-4 text-aqua-100 transition group-hover:translate-x-0.5" />
            </div>
            <div className="mt-10 text-3xl font-semibold leading-tight text-white">
              {prediction ? `${t(prediction.event)} · ${prediction.course}` : t("Forecast locked.")}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <PredictionMini label="Now" value={prediction ? formatTime(prediction.currentTime) : "--"} />
              <PredictionMini label="90d" value={prediction ? formatTime(prediction.predictedTimes.days90) : "--"} />
              <PredictionMini label="365d" value={prediction ? formatTime(prediction.predictedTimes.days365) : "--"} />
            </div>
          </div>
        </motion.button>
        <SnapshotMetric detail={`${overview.personalBestCount} ${t("PB events")}`} icon={Activity} label="Logged" value={overview.totalSwims.toString()} />
        <SnapshotMetric detail={overview.bestEvent ? t(overview.bestEvent) : t("No ranking yet")} icon={Medal} label="Strongest" value={overview.bestEvent ? t("Top 1") : "—"} />
        <SnapshotMetric detail={overview.mostImprovedEvent ? t(overview.mostImprovedEvent) : t("No trend yet")} icon={TrendingUp} label="Year pace" value={`${overview.yearlyImprovement}%`} />
        <SnapshotMetric detail={t(trainingLoad.label)} icon={Dumbbell} label="Gym load" value={trainingLoad.weeklyLoad ? `${trainingLoad.weeklyLoad}` : "—"} />
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
  const { t } = useTranslator();

  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.08] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/56">{t(label)}</span>
        <Icon aria-hidden className="h-4 w-4 text-aqua-200" />
      </div>
      <div className="mt-4 font-mono text-2xl font-semibold text-white">{value}</div>
      <p className="mt-1 text-sm text-white/62">{detail}</p>
    </div>
  );
}

function buildDataQualityWarnings(swims: SwimResult[]) {
  const groups = swims.reduce<Map<string, SwimResult[]>>((current, swim) => {
    const key = `${swim.event}__${swim.course}`;
    current.set(key, [...(current.get(key) ?? []), swim]);
    return current;
  }, new Map());
  const warnings: { title: string; body: string }[] = [];

  for (const groupSwims of groups.values()) {
    const sorted = [...groupSwims].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1];
    if (sorted.length < 3) {
      warnings.push({
        title: `${latest.event} needs more data`,
        body: `${latest.course} has ${sorted.length} result${sorted.length === 1 ? "" : "s"}. Predictions get stronger after 3 or more swims.`
      });
    }

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const jump = Math.abs(current.timeSeconds - previous.timeSeconds) / previous.timeSeconds;
      if (jump >= 0.12) {
        warnings.push({
          title: "Large time jump detected",
          body: `${current.event} ${current.course} changed by ${(jump * 100).toFixed(1)}%. Check course, event, and time format.`
        });
        break;
      }
    }
  }

  if (!warnings.length) {
    warnings.push({
      title: "Data looks steady",
      body: "No large jumps or thin event samples were found in the current view."
    });
  }

  return warnings.slice(0, 3);
}

function DataQualityPanel({ swims }: { swims: SwimResult[] }) {
  const { t } = useTranslator();
  const warnings = buildDataQualityWarnings(swims);

  return (
    <section className="dashboard-glass premium-hover p-5 text-white">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan">
          <AlertTriangle aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{t("Data quality")}</h2>
          <p className="mt-1 text-sm text-white/66">{t("Forecast confidence depends on clean, repeated data.")}</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {warnings.map((warning) => (
          <article className="rounded-lg border border-white/12 bg-white/[0.08] p-3" key={`${warning.title}-${warning.body}`}>
            <p className="text-sm font-semibold text-white">{t(warning.title)}</p>
            <p className="mt-1 text-sm leading-6 text-white/64">{t(warning.body)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function EventIntelligencePanel({ analytics }: { analytics: DashboardAnalytics }) {
  const { t } = useTranslator();
  const strongest = analytics.strongestEvents[0] ?? analytics.rankings[0];
  const event = strongest?.event;
  const isFly = event?.includes("Butterfly");
  const isSprint = event?.startsWith("50") || event?.startsWith("100");
  const isDistance = event?.startsWith("800") || event?.startsWith("1500");
  const title = isFly ? "Fly volatility" : isDistance ? "Distance endurance" : isSprint ? "Sprint speed" : "Pacing stability";
  const body = isFly
    ? "Butterfly reads are sensitive to fatigue. Watch late-race consistency and avoid overreacting to one rough swim."
    : isDistance
      ? "Distance events reward steady drop-off control. Look for gradual trend movement instead of huge short-term predictions."
      : isSprint
        ? "Sprint events move through starts, turns, breakout speed, and repeatability. Tiny improvements matter."
        : "Middle-distance events depend on pacing stability. The best signal is a trend that keeps moving without wild swings.";

  return (
    <section className="dashboard-glass premium-hover p-5 text-white">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan">
          <Sparkles aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{t("Event intelligence")}</h2>
          <p className="mt-1 text-sm text-white/66">{event ? `${t(event)} · ${strongest.course}` : t("Waiting for event data")}</p>
        </div>
      </div>
      <div className="mt-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-aqua-100">{t(title)}</p>
        <p className="mt-3 text-sm leading-6 text-white/70">{t(body)}</p>
      </div>
    </section>
  );
}

function SpiExplainer({ analytics }: { analytics: DashboardAnalytics }) {
  const { t } = useTranslator();
  const consistencyAverage = analytics.rankings.length
    ? Math.round(analytics.rankings.reduce((sum, ranking) => sum + ranking.consistencyScore, 0) / analytics.rankings.length)
    : 0;
  const consistencyLabel = consistencyAverage >= 80 ? "bonus" : consistencyAverage >= 60 ? "neutral" : "penalty";

  return (
    <section className="dashboard-glass premium-hover p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md bg-stitch-abyss px-2.5 py-1 text-xs font-bold text-stitch-cyan shadow-glow">
            <Gauge aria-hidden className="h-4 w-4" />
            {t("SPI model")}
          </div>
          <h2 className="mt-4 text-lg font-semibold">{t("Why your score moved")}</h2>
        </div>
        <div className="font-mono text-3xl font-semibold text-stitch-cyan">{analytics.swimPowerIndex.score}</div>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/68">
        {t("Swim Power Index combines speed, improvement rate, consistency, and event difficulty into one 0-100 performance score.")}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-white/[0.10] p-3"><span className="block text-white/48">{t("This month")}</span><strong className="font-mono text-stitch-cyan">{analytics.overview.monthlyImprovement}%</strong></div>
        <div className="rounded-md bg-white/[0.10] p-3"><span className="block text-white/48">{t("Strongest")}</span><strong className="truncate font-mono text-stitch-cyan">{analytics.overview.bestEvent ? t(analytics.overview.bestEvent) : t("None")}</strong></div>
        <div className="col-span-2 rounded-md bg-white/[0.10] p-3"><span className="block text-white/48">{t("Consistency")}</span><strong className="font-mono text-stitch-cyan">{consistencyAverage}/100 {t(consistencyLabel)}</strong></div>
      </div>
    </section>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  const { t } = useTranslator();

  return <section className="dashboard-glass flex min-h-[420px] items-center justify-center px-6 text-center"><div className="max-w-lg"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stitch-abyss text-stitch-cyan shadow-glow"><Waves aria-hidden className="h-6 w-6" /></div><h2 className="mt-6 text-3xl font-semibold text-white">{t(title)}</h2><p className="mt-4 leading-7 text-white/78">{t(body)}</p><button className="mt-7 h-11 rounded-full bg-white px-6 text-sm font-semibold text-stitch-abyss transition hover:bg-stitch-cyan" type="button" onClick={onAction}>{t(action)}</button></div></section>;
}
