"use client";

import { type ReactNode, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, AlertTriangle, ArrowRight, BarChart3, Dumbbell, Gauge, LayoutDashboard, ListPlus, Medal, Sparkles, Target, TimerReset, TrendingUp, UserRound, Waves } from "lucide-react";
import { AthleteProfilePanel } from "@/components/athlete-profile-panel";
import { CommunityHub } from "@/components/community-hub";
import { CsvImporter } from "@/components/csv-importer";
import { DataPrivacyPanel } from "@/components/data-privacy-panel";
import { useTranslator } from "@/components/i18n/use-language";
import { EventRankings } from "@/components/event-rankings";
import { GoalTracker } from "@/components/goal-tracker";
import { GymWorkoutPanel } from "@/components/gym-workout-panel";
import { LanguageToggle } from "@/components/landing/language-toggle";
import { ManualTimeEntry } from "@/components/manual-time-entry";
import { MeetDatabasePanel } from "@/components/meet-database-panel";
import { ModelPerformancePanel } from "@/components/model-performance-panel";
import { MotivationPanel } from "@/components/motivation-panel";
import { PersonalBestTable } from "@/components/personal-best-table";
import { PredictionGrid } from "@/components/prediction-grid";
import { ProgressionChart } from "@/components/progression-chart";
import { RaceLab } from "@/components/race-lab/race-lab";
import { SwimPowerIndexPanel } from "@/components/swim-power-index";
import { StrokeSpecialtyPentagon } from "@/components/stroke-specialty-pentagon";
import { UpcomingMeetPanel } from "@/components/upcoming-meet-panel";
import { UserActions } from "@/components/auth/user-actions";
import { DashboardViewToggle } from "@/components/dashboard-view-toggle";
import { Counter } from "@/components/ui/counter";
import { DashboardOptionWheel } from "@/components/ui/dashboard-option-wheel";
import { useProductEvent } from "@/hooks/use-product-event";
import type { DashboardViewMode } from "@/lib/dashboard-view-mode";
import { isOfficialResult } from "@/lib/analytics";
import { formatTime } from "@/lib/utils";
import type { DashboardAnalytics, Goal, GymWorkout, ModelPerformanceDashboard, PredictionProfile, SwimResult } from "@/types/swim";

type DashboardTab = "overview" | "results" | "analytics" | "raceLab" | "model" | "training" | "goals" | "profile";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "results", label: "Results", icon: ListPlus },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "raceLab", label: "Race Lab", icon: TimerReset },
  { id: "model", label: "Model", icon: Gauge },
  { id: "training", label: "Training", icon: Dumbbell },
  { id: "goals", label: "Goals & Meets", icon: Target },
  { id: "profile", label: "Profile", icon: UserRound }
] as const;

export function SwimSightDashboard({
  analytics,
  gymWorkouts,
  goals,
  modelPerformance,
  predictionProfile,
  swims,
  viewMode
}: {
  analytics: DashboardAnalytics;
  gymWorkouts: GymWorkout[];
  goals: Goal[];
  modelPerformance: ModelPerformanceDashboard;
  predictionProfile: PredictionProfile;
  swims: SwimResult[];
  viewMode: DashboardViewMode;
}) {
  const { t } = useTranslator();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const overview = analytics.overview;
  const officialSwims = swims.filter(isOfficialResult);
  const trainingSwims = swims.filter((swim) => (swim.resultKind ?? "OFFICIAL") === "TRAINING");
  const hasResults = officialSwims.length > 0;
  const primaryPrediction = [...analytics.predictions].sort((a, b) => b.confidence - a.confidence)[0];
  useProductEvent("RETURN_VISIT");

  return (
    <main className="dark dashboard-shell min-h-screen w-full overflow-x-clip text-stitch-text">
      <header className="dashboard-topbar sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-3 py-2 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-0 lg:px-8">
          <button className="ui-press flex min-w-0 items-center gap-3 rounded-lg text-left hover:opacity-80" type="button" onClick={() => setActiveTab("overview")}>
            <span className="dashboard-brand-mark inline-flex h-9 w-9 items-center justify-center rounded-md text-stitch-cyan"><Waves aria-hidden className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block truncate font-semibold text-stitch-abyss">{t("SwimSight")}</span><span className="block truncate text-xs text-stitch-abyss/55 max-[420px]:hidden">{t("Performance workspace")}</span></span>
          </button>
          <div className="flex w-full min-w-0 items-center justify-between gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
            <DashboardViewToggle mode={viewMode} />
            <LanguageToggle compact />
            <UserActions compact />
          </div>
        </div>
      </header>

      <div className="dashboard-content mx-auto w-full max-w-[1440px] min-w-0 px-3 pb-24 pt-5 sm:px-6 sm:pb-28 sm:pt-7 lg:px-8">
        {activeTab === "overview" && <section className="dashboard-hero dashboard-enter mb-5 overflow-hidden rounded-lg border border-white/65 p-4 text-stitch-abyss sm:p-6 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch">
            <div className="max-w-4xl lg:py-2">
              <h1 className="text-balance text-3xl font-semibold tracking-normal sm:text-5xl">
                {t("Your season, lit up by the times you enter.")}
              </h1>
              <div className="mt-5 flex flex-wrap gap-2">
                <QuickAction label="Add result" onClick={() => setActiveTab("results")} />
                <QuickAction label="Log gym" onClick={() => setActiveTab("training")} secondary />
                <QuickAction label="View predictions" onClick={() => setActiveTab("analytics")} secondary />
              </div>
            </div>
            <DashboardSignal prediction={primaryPrediction} hasResults={hasResults} />
          </div>
          <div className="mt-6 grid grid-cols-3 divide-x divide-stitch-abyss/10 border-t border-stitch-abyss/10 pt-2">
            <MiniStat label="Logged" value={overview.totalSwims.toString()} />
            <MiniStat label="PB events" value={overview.personalBestCount.toString()} />
            <MiniStat label="SPI" value={analytics.swimPowerIndex.score.toString()} />
          </div>
        </section>}

        {activeTab === "overview" && (
          <DashboardPanel>
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

        {activeTab === "results" && <DashboardPanel><SectionHeading title="Results" /><ResultSplitSummary officialCount={officialSwims.length} trainingCount={trainingSwims.length} /><ManualTimeEntry swims={swims} /><CsvImporter /><MeetDatabasePanel swims={swims} />{analytics.personalBests.length > 0 && <PersonalBestTable personalBests={analytics.personalBests} />}</DashboardPanel>}

        {activeTab === "analytics" && <DashboardPanel><SectionHeading title="Analytics" />{hasResults ? <><section className="grid gap-4 lg:grid-cols-3"><SpiExplainer analytics={analytics} /><DataQualityPanel swims={officialSwims} /><EventIntelligencePanel analytics={analytics} /></section><PredictionGrid predictions={analytics.predictions} profile={predictionProfile} /><StrokeSpecialtyPentagon profile={analytics.specialtyProfile} /><ProgressionChart swims={officialSwims} /><EventRankings strongestEvents={analytics.strongestEvents} weakestEvents={analytics.weakestEvents} /></> : <EmptyState title="No official meet results yet." body="Training times are saved separately. Add an official meet result to unlock PBs, SPI, predictions, and awards." action="Add official result" onAction={() => setActiveTab("results")} />}</DashboardPanel>}

        {activeTab === "raceLab" && <DashboardPanel><RaceLab analytics={analytics} goals={goals} swims={swims} /></DashboardPanel>}

        {activeTab === "model" && <DashboardPanel><SectionHeading title="Model performance" /><ModelPerformancePanel performance={modelPerformance} /></DashboardPanel>}

        {activeTab === "training" && <DashboardPanel><SectionHeading title="Training" /><GymWorkoutPanel trainingLoad={analytics.trainingLoad} workouts={gymWorkouts} /></DashboardPanel>}

        {activeTab === "goals" && <DashboardPanel><SectionHeading title="Goals & meets" /><GoalTracker initialGoal={goals[0]} initialProjection={analytics.goalProjection} swims={swims} /><UpcomingMeetPanel /></DashboardPanel>}

        {activeTab === "profile" && <DashboardPanel><SectionHeading title="Profile & community" /><AthleteProfilePanel analytics={analytics} goals={goals} swims={swims} workouts={gymWorkouts} /><CommunityHub /><DataPrivacyPanel /></DashboardPanel>}
      </div>
      <DashboardOptionWheel
        activeId={activeTab}
        items={tabs.map(({ id, label, icon: Icon }) => ({
          id,
          icon: <Icon aria-hidden className="h-5 w-5" />,
          label
        }))}
        onChange={setActiveTab}
      />
    </main>
  );
}

function DashboardPanel({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      animate={{ y: 0 }}
      className="space-y-4"
      initial={reducedMotion ? false : { y: 6 }}
      transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ title }: { title: string }) {
  const { t } = useTranslator();
  return <h2 className="text-2xl font-semibold tracking-normal text-stitch-abyss sm:text-3xl">{t(title)}</h2>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  const numericValue = Number(value);
  const shouldCount = Number.isInteger(numericValue) && /^\d+$/.test(value);

  return (
    <div className="min-w-0 px-2 py-3 sm:px-4">
      <div className="truncate text-[0.68rem] font-semibold text-stitch-abyss/58 sm:text-xs">{t(label)}</div>
      <div className="mt-1 font-mono text-2xl font-semibold text-stitch-abyss sm:text-3xl">
        {shouldCount ? (
          <Counter fontSize={30} fontWeight={700} gradientFrom="rgba(255,255,255,0.64)" value={numericValue} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function DashboardSignal({
  hasResults,
  prediction
}: {
  hasResults: boolean;
  prediction?: DashboardAnalytics["predictions"][number];
}) {
  const { t } = useTranslator();

  return (
    <div className="dashboard-signal">
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-aqua-100/70">{t("Season signal")}</p>
          <p className="mt-2 truncate text-sm font-semibold text-white">
            {prediction ? `${t(prediction.event)} · ${prediction.course}` : t(hasResults ? "Forecast calibrating" : "Awaiting first result")}
          </p>
        </div>
        <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${hasResults ? "bg-mint-300 shadow-[0_0_0_5px_rgba(110,231,183,0.12)]" : "bg-white/32"}`} />
      </div>
      <div className="relative z-10 mt-7 grid grid-cols-3 divide-x divide-white/12">
        <PredictionMini label="Now" value={prediction ? formatTime(prediction.currentTime) : "--"} />
        <PredictionMini label="365d" value={prediction ? formatTime(prediction.predictedTimes.days365) : "--"} />
        <PredictionMini label="Confidence" value={prediction ? `${prediction.confidence}%` : "--"} />
      </div>
      <span aria-hidden className="dashboard-signal__line" />
    </div>
  );
}

function ResultSplitSummary({ officialCount, trainingCount }: { officialCount: number; trainingCount: number }) {
  const { t } = useTranslator();

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <div className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-white/60 bg-white/55 p-4 text-stitch-abyss backdrop-blur-xl">
        <div><p className="text-sm font-semibold">{t("Official meet times")}</p><p className="mt-1 text-xs text-stitch-abyss/62">{t("Counts toward PBs, SPI, predictions, rewards, and awards.")}</p></div>
        <div className="shrink-0 font-mono text-3xl font-semibold">{officialCount}</div>
      </div>
      <div className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-white/45 bg-white/35 p-4 text-stitch-abyss backdrop-blur-xl">
        <div><p className="text-sm font-semibold">{t("Training / unofficial")}</p><p className="mt-1 text-xs text-stitch-abyss/62">{t("Stored for context, but kept out of official rankings and badges.")}</p></div>
        <div className="shrink-0 font-mono text-3xl font-semibold">{trainingCount}</div>
      </div>
    </section>
  );
}

function QuickAction({ label, onClick, secondary = false }: { label: string; onClick: () => void; secondary?: boolean }) {
  const { t } = useTranslator();

  return (
    <button
      className={`ui-press inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
        secondary
          ? "border border-stitch-abyss/15 bg-white/45 text-stitch-abyss hover:bg-white"
          : "bg-stitch-abyss text-white hover:bg-[#10243a]"
      }`}
      type="button"
      onClick={onClick}
    >
      {t(label)}
      <ArrowRight aria-hidden className="h-4 w-4" />
    </button>
  );
}

function PredictionMini({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();

  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-4">
      <div className="text-[0.68rem] font-semibold text-white/52">{t(label)}</div>
      <div className="mt-1 truncate font-mono text-lg font-semibold text-white">{value}</div>
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
    <section className="dashboard-glass overflow-hidden p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">{t("Season intelligence")}</h2>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-aqua-100">
          {overview.weeklyImprovement}% {t("week")}
        </span>
      </div>
      <motion.button
          className="group ui-press mt-5 block w-full border-y border-white/12 py-5 text-left"
          type="button"
          whileTap={{ scale: 0.995 }}
          onClick={onViewPredictions}
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-aqua-100">{t("Prediction lane")}</span>
              <ArrowRight aria-hidden className="h-4 w-4 text-aqua-100 transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5" />
          </div>
          <div className="mt-3 truncate text-xl font-semibold text-white sm:text-2xl">
            {prediction ? `${t(prediction.event)} · ${prediction.course}` : t("Forecast locked.")}
          </div>
          <div className="mt-5 grid grid-cols-3 divide-x divide-white/12">
              <PredictionMini label="Now" value={prediction ? formatTime(prediction.currentTime) : "--"} />
              <PredictionMini label="90d" value={prediction ? formatTime(prediction.predictedTimes.days90) : "--"} />
              <PredictionMini label="365d" value={prediction ? formatTime(prediction.predictedTimes.days365) : "--"} />
          </div>
      </motion.button>
      <div className="grid grid-cols-3 divide-x divide-white/12 pt-5">
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
    <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-4">
      <div className="flex items-center gap-1.5">
        <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-aqua-200" />
        <span className="truncate text-[0.66rem] font-semibold text-white/56 sm:text-xs">{t(label)}</span>
      </div>
      <div className="mt-2 truncate font-mono text-lg font-semibold text-white sm:text-2xl">{value}</div>
      <p className="mt-1 truncate text-[0.65rem] text-white/58 sm:text-xs" title={detail}>{detail}</p>
    </div>
  );
}

function buildDataQualityWarnings(swims: SwimResult[]) {
  const groups = swims.reduce<Map<string, SwimResult[]>>((current, swim) => {
    const key = `${swim.event}__${swim.course}`;
    current.set(key, [...(current.get(key) ?? []), swim]);
    return current;
  }, new Map());
  const warnings: (
    | { type: "thin"; event: string; course: string; count: number }
    | { type: "jump"; event: string; course: string; percent: string }
    | { type: "steady" }
  )[] = [];

  for (const groupSwims of groups.values()) {
    const sorted = [...groupSwims].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = sorted[sorted.length - 1];
    if (sorted.length < 3) {
      warnings.push({
        type: "thin",
        event: latest.event,
        course: latest.course,
        count: sorted.length
      });
    }

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const jump = Math.abs(current.timeSeconds - previous.timeSeconds) / previous.timeSeconds;
      if (jump >= 0.12) {
        warnings.push({
          type: "jump",
          event: current.event,
          course: current.course,
          percent: (jump * 100).toFixed(1)
        });
        break;
      }
    }
  }

  if (!warnings.length) {
    warnings.push({ type: "steady" });
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
        {warnings.map((warning, index) => (
          <article className="rounded-lg border border-white/12 bg-white/[0.08] p-3" key={`${warning.type}-${index}`}>
            <p className="text-sm font-semibold text-white">
              {warning.type === "thin" ? `${t(warning.event)} ${t("needs more data")}` : warning.type === "jump" ? t("Large time jump detected") : t("Data looks steady")}
            </p>
            <p className="mt-1 text-sm leading-6 text-white/64">
              {warning.type === "thin"
                ? `${warning.course} · ${warning.count} ${t(warning.count === 1 ? "result" : "results")}. ${t("Predictions get stronger after 3 or more swims.")}`
                : warning.type === "jump"
                  ? `${t(warning.event)} ${warning.course} · ${warning.percent}%. ${t("Check course, event, and time format.")}`
                  : t("No large jumps or thin event samples were found in the current view.")}
            </p>
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
  const performanceAverage = analytics.rankings.length
    ? Math.round(analytics.rankings.reduce((sum, ranking) => sum + ranking.performanceScore, 0) / analytics.rankings.length)
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
        <div className="rounded-md bg-white/[0.10] p-3"><span className="block text-white/48">{t("Speed score")}</span><strong className="font-mono text-stitch-cyan">{performanceAverage}/100</strong></div>
        <div className="rounded-md bg-white/[0.10] p-3"><span className="block text-white/48">{t("Strongest")}</span><strong className="truncate font-mono text-stitch-cyan">{analytics.overview.bestEvent ? t(analytics.overview.bestEvent) : t("None")}</strong></div>
        <div className="col-span-2 rounded-md bg-white/[0.10] p-3"><span className="block text-white/48">{t("Consistency")}</span><strong className="font-mono text-stitch-cyan">{consistencyAverage}/100 {t(consistencyLabel)}</strong></div>
      </div>
    </section>
  );
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  const { t } = useTranslator();

  return <section className="dashboard-glass flex min-h-[420px] items-center justify-center px-6 text-center"><div className="max-w-lg"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stitch-abyss text-stitch-cyan shadow-glow"><Waves aria-hidden className="h-6 w-6" /></div><h2 className="mt-6 text-3xl font-semibold text-white">{t(title)}</h2><p className="mt-4 leading-7 text-white/78">{t(body)}</p><button className="ui-press mt-7 h-11 rounded-full bg-white px-6 text-sm font-semibold text-stitch-abyss hover:bg-stitch-cyan" type="button" onClick={onAction}>{t(action)}</button></div></section>;
}
