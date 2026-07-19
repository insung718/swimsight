"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Download,
  Gauge,
  Pause,
  PencilLine,
  Play,
  RotateCcw,
  Save,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  TableProperties,
  Target,
  Trash2,
  Waves
} from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import {
  DEFAULT_SIMULATION_SETTINGS,
  RACE_LAB_ENGINE_VERSION,
  RACE_SHAPE_THRESHOLDS,
  RaceLabValidationError,
  analyzeRaceShape,
  buildSegmentsFromCumulative,
  compareRaceSegments,
  estimateRaceSegments,
  generateGoalRace,
  getCourseLength,
  getRaceReplayPosition,
  getSegmentCount,
  isRaceLabEvent,
  rebuildEditableGoal,
  simulateRace,
  validateStoredSegmentGeometry,
  type RaceLabState,
  type RacePacingStrategy,
  type RaceSegment,
  type RaceSplitSource,
  type SavedRaceLabScenario,
  type SimulationSettings,
  type StoredRaceSplit
} from "@/lib/race-lab";
import { cn, parseTimeInput } from "@/lib/utils";
import type { DashboardAnalytics, Goal, SwimResult } from "@/types/swim";

type LabMode = "replay" | "analysis" | "build";
type ReferenceKey = "pb" | "previous" | "prediction" | "goal";

interface RaceLabProps {
  analytics: DashboardAnalytics;
  goals: Goal[];
  swims: SwimResult[];
  initialState?: RaceLabState;
  disablePersistence?: boolean;
}

const emptyState: RaceLabState = { splits: [], scenarios: [] };

function sourcePriority(source: RaceSplitSource) {
  if (source === "OFFICIAL") return 0;
  if (source === "MANUAL") return 1;
  if (source === "ESTIMATED") return 2;
  return 3;
}

function raceSegments(race: SwimResult, rows: StoredRaceSplit[], referenceShapes: RaceSegment[][] = []) {
  const segmentCount = getSegmentCount(race.event, race.course);
  if (segmentCount === 1) {
    return buildSegmentsFromCumulative({
      event: race.event,
      course: race.course,
      cumulativeTimes: [race.timeSeconds],
      source: "OFFICIAL",
      totalTime: race.timeSeconds,
      note: "The finish time is the only pool-length segment for this race."
    });
  }
  const grouped = [...rows]
    .filter((row) => row.raceId === race.id)
    .sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source) || a.segmentIndex - b.segmentIndex);
  for (const source of ["OFFICIAL", "MANUAL", "ESTIMATED"] as const) {
    const sourceRows = grouped.filter((row) => row.source === source);
    if (!sourceRows.length) continue;
    try {
      validateStoredSegmentGeometry({ event: race.event, course: race.course, segments: sourceRows });
      return buildSegmentsFromCumulative({
        event: race.event,
        course: race.course,
        cumulativeTimes: sourceRows.map((row) => row.cumulativeTime),
        source,
        precision: sourceRows[0].precision,
        totalTime: race.timeSeconds,
        note: sourceRows[0].note
      });
    } catch {
      continue;
    }
  }
  return estimateRaceSegments({
    event: race.event,
    course: race.course,
    totalTime: race.timeSeconds,
    referenceShapes,
    note: "Estimated from the finish time; not an official split."
  });
}

function dateForDisplay(value: string) {
  const calendarDate = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return new Date(calendarDate ? `${calendarDate}T12:00:00` : value);
}

function safeEstimatedSegments(input: Parameters<typeof estimateRaceSegments>[0]) {
  try {
    return estimateRaceSegments(input);
  } catch {
    return undefined;
  }
}

function formatRaceTime(totalSeconds: number, approximate = false, digits = 2) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const formatted = minutes > 0
    ? `${minutes}:${seconds.toFixed(digits).padStart(digits + 3, "0")}`
    : seconds.toFixed(digits);
  return approximate ? `~${formatted}` : formatted;
}

function displayTime(value: number | undefined, source?: RaceSplitSource) {
  if (value === undefined) return "--";
  return formatRaceTime(value, source === "ESTIMATED", source === "ESTIMATED" ? 1 : 2);
}

function signedSeconds(value: number | undefined, approximate = false) {
  if (value === undefined) return "--";
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${approximate ? "~" : ""}${prefix}${Math.abs(value).toFixed(2)}s`;
}

function readErrorMessage() {
  return "Race Lab could not save that change. Check the values and try again.";
}

export function RaceLab({ analytics, goals, swims, initialState, disablePersistence = false }: RaceLabProps) {
  const { language, t } = useTranslator();
  const reducedMotion = useReducedMotion();
  const eligibleRaces = useMemo(() => swims
    .filter((race) => (race.resultKind ?? "OFFICIAL") === "OFFICIAL")
    .filter((race) => race.raceType !== "RELAY_SPLIT" && race.raceType !== "CONVERTED")
    .filter((race) => isRaceLabEvent(race.event))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [swims]);
  const [selectedRaceId, setSelectedRaceId] = useState(eligibleRaces[0]?.id ?? "");
  const [mode, setMode] = useState<LabMode>("replay");
  const [state, setState] = useState<RaceLabState>(initialState ?? emptyState);
  const [loading, setLoading] = useState(!initialState && eligibleRaces.length > 0);
  const [status, setStatus] = useState<string | null>(null);
  const selectedRace = eligibleRaces.find((race) => race.id === selectedRaceId) ?? eligibleRaces[0];

  useEffect(() => {
    if (eligibleRaces[0] && !eligibleRaces.some((race) => race.id === selectedRaceId)) {
      setSelectedRaceId(eligibleRaces[0].id);
    }
  }, [eligibleRaces, selectedRaceId]);

  const related = useMemo(() => {
    if (!selectedRace) return { same: [], pb: undefined, previous: undefined, previousPb: undefined };
    const same = eligibleRaces
      .filter((race) => race.event === selectedRace.event && race.course === selectedRace.course)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const selectedIndex = same.findIndex((race) => race.id === selectedRace.id);
    return {
      same,
      pb: [...same].sort((a, b) => a.timeSeconds - b.timeSeconds)[0],
      previous: selectedIndex > 0 ? same[selectedIndex - 1] : undefined,
      previousPb: selectedIndex > 0 ? [...same.slice(0, selectedIndex)].sort((a, b) => a.timeSeconds - b.timeSeconds)[0] : undefined
    };
  }, [eligibleRaces, selectedRace]);

  useEffect(() => {
    if (initialState || disablePersistence || !selectedRace) return;
    const raceIds = Array.from(new Set([selectedRace.id, related.pb?.id, related.previous?.id, related.previousPb?.id].filter(Boolean) as string[]));
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/race-lab?raceIds=${encodeURIComponent(raceIds.join(","))}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("request failed");
        return response.json() as Promise<RaceLabState>;
      })
      .then((next) => setState(next))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus(readErrorMessage());
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [disablePersistence, initialState, related.pb?.id, related.previous?.id, related.previousPb?.id, selectedRace]);

  async function mutate(payload: Record<string, unknown>, successMessage: string) {
    if (disablePersistence) {
      setStatus(successMessage);
      return true;
    }
    setStatus(null);
    try {
      const response = await fetch("/api/race-lab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("request failed");
      const next = await response.json() as RaceLabState;
      setState((current) => ({
        splits: [...current.splits.filter((row) => !next.splits.some((updated) => updated.raceId === row.raceId)), ...next.splits],
        scenarios: next.scenarios
      }));
      setStatus(successMessage);
      return true;
    } catch {
      setStatus(readErrorMessage());
      return false;
    }
  }

  if (!selectedRace) {
    return (
      <section className="race-lab-shell min-h-[520px] p-5 sm:p-8">
        <div className="mx-auto flex min-h-[440px] max-w-xl flex-col items-center justify-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-stitch-abyss text-stitch-cyan"><Waves aria-hidden className="h-6 w-6" /></span>
          <h2 className="mt-5 text-2xl font-semibold text-stitch-abyss sm:text-4xl">{t("Race Lab needs an official race.")}</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-stitch-abyss/60">{t("Add an official 50, 100, 200, or 400 result. Race Lab never fills your account with demo races.")}</p>
        </div>
      </section>
    );
  }

  const explicitShapes = related.same.flatMap((race) => {
    const rows = state.splits.filter((row) => row.raceId === race.id && row.source !== "ESTIMATED");
    if (!rows.length) return [];
    try { return [raceSegments(race, rows)]; } catch { return []; }
  }).sort((left, right) => left.at(-1)!.cumulativeTime - right.at(-1)!.cumulativeTime);
  const previousPb = related.previousPb;
  const actual = raceSegments(selectedRace, state.splits, explicitShapes);
  const pbSegments = related.pb ? raceSegments(related.pb, state.splits, explicitShapes) : undefined;
  const previousPbSegments = previousPb ? raceSegments(previousPb, state.splits, explicitShapes) : undefined;
  const previousSegments = related.previous ? raceSegments(related.previous, state.splits, explicitShapes) : undefined;
  const prediction = analytics.predictions.find((item) => item.event === selectedRace.event && item.course === selectedRace.course);
  const predictionSegments = prediction ? safeEstimatedSegments({
    event: selectedRace.event,
    course: selectedRace.course,
    totalTime: prediction.predictedTimes.days90,
    referenceShapes: [actual],
    note: "Estimated pace shape for the existing 90-day prediction."
  }) : undefined;
  const goal = goals.find((item) => item.event === selectedRace.event && item.course === selectedRace.course);
  const goalSegments = goal ? safeEstimatedSegments({
    event: selectedRace.event,
    course: selectedRace.course,
    totalTime: goal.targetTime,
    referenceShapes: [actual],
    note: "Estimated pace shape for the saved goal time."
  }) : undefined;
  const source = actual[0]?.source ?? "ESTIMATED";
  const shape = analyzeRaceShape(actual);

  const modes: { id: LabMode; label: string; icon: typeof Play }[] = [
    { id: "replay", label: "Replay", icon: Play },
    { id: "analysis", label: "Split analysis", icon: TableProperties },
    { id: "build", label: "Build a race", icon: SlidersHorizontal }
  ];

  return (
    <section className="race-lab-shell overflow-hidden rounded-lg border border-stitch-abyss/10">
      <div className="border-b border-stitch-abyss/8 bg-white/72 px-4 py-4 backdrop-blur-2xl sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-aqua-700"><Gauge aria-hidden className="h-4 w-4" />{t("Race Lab")}</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-normal text-stitch-abyss sm:text-4xl">{t("Replay the race. Change the plan.")}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stitch-abyss/58">{t("Official timing stays untouched. Estimates and simulations are always labeled.")}</p>
          </div>
          <label className="block min-w-0 lg:w-[360px]">
            <span className="mb-1.5 block text-xs font-semibold text-stitch-abyss/56">{t("Source race")}</span>
            <select
              aria-label={t("Source race")}
              className="h-11 w-full rounded-md border border-stitch-abyss/12 bg-white px-3 text-sm font-semibold text-stitch-abyss outline-none transition focus:border-aqua-500 focus:ring-4 focus:ring-aqua-200/40"
              value={selectedRace.id}
              onChange={(event) => { setSelectedRaceId(event.target.value); setStatus(null); }}
            >
              {eligibleRaces.map((race) => (
                <option key={race.id} value={race.id}>{t(race.event)} · {race.course} · {formatRaceTime(race.timeSeconds)} · {new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : language === "vi" ? "vi-VN" : "en", { month: "short", day: "numeric", year: "numeric" }).format(dateForDisplay(race.date))}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1 rounded-md bg-stitch-abyss/[0.055] p-1" role="tablist" aria-label={t("Race Lab views")}>
          {modes.map(({ id, label, icon: Icon }) => (
            <button
              aria-selected={mode === id}
              className={cn("ui-press inline-flex min-h-12 min-w-0 items-center justify-center gap-1 rounded px-1 text-[0.7rem] font-semibold leading-tight sm:min-h-11 sm:gap-2 sm:px-3 sm:text-sm", mode === id ? "bg-white text-stitch-abyss shadow-[0_4px_12px_rgba(5,24,42,0.08)]" : "text-stitch-abyss/65 hover:text-stitch-abyss")}
              key={id}
              role="tab"
              type="button"
              onClick={() => setMode(id)}
            ><Icon aria-hidden className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" /><span className="min-w-0 text-center">{t(label)}</span></button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-5 lg:p-6">
        {loading && <div className="mb-3 h-1 overflow-hidden rounded-full bg-stitch-abyss/8"><div className="h-full w-1/3 animate-pulse rounded-full bg-aqua-500" /></div>}
        {status && <div aria-live="polite" className="mb-4 rounded-md border border-stitch-abyss/10 bg-white/65 px-3 py-2 text-sm text-stitch-abyss/70">{t(status)}</div>}
        {mode === "replay" && (
          <ReplayView
            actual={actual}
            animationDefault={!reducedMotion}
            goal={goalSegments}
            key={selectedRace.id}
            mutate={mutate}
            pb={related.pb?.id === selectedRace.id ? previousPbSegments : pbSegments}
            prediction={predictionSegments}
            race={selectedRace}
            source={source}
          />
        )}
        {mode === "analysis" && (
          <AnalysisView
            actual={actual}
            goal={goal}
            goalSegments={goalSegments}
            key={selectedRace.id}
            pbIsSelected={related.pb?.id === selectedRace.id}
            pbSegments={pbSegments}
            predictionSegments={predictionSegments}
            previousPb={previousPb}
            previousSegments={previousSegments}
            race={selectedRace}
            shape={shape}
          />
        )}
        {mode === "build" && (
          <BuildView
            actual={actual}
            goal={goal}
            historicalShapes={explicitShapes}
            key={selectedRace.id}
            mutate={mutate}
            pb={related.pb}
            race={selectedRace}
            scenarios={state.scenarios.filter((scenario) => !scenario.baseResultId || scenario.baseResultId === selectedRace.id)}
          />
        )}
      </div>
    </section>
  );
}

function SourceBadge({ source }: { source: RaceSplitSource }) {
  const { t } = useTranslator();
  const labels: Record<RaceSplitSource, string> = {
    OFFICIAL: "Official splits",
    MANUAL: "Manual splits",
    ESTIMATED: "Estimated splits",
    SIMULATED: "Simulation"
  };
  return <span className={cn("inline-flex rounded-full border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em]", source === "ESTIMATED" ? "border-amber-500/25 bg-amber-100/65 text-amber-900" : source === "OFFICIAL" ? "border-emerald-500/20 bg-emerald-100/65 text-emerald-900" : "border-aqua-500/20 bg-aqua-100/65 text-aqua-900")}>{t(labels[source])}</span>;
}

function ReplayView({ actual, animationDefault, goal, mutate, pb, prediction, race, source }: {
  actual: RaceSegment[];
  animationDefault: boolean;
  goal?: RaceSegment[];
  mutate: (payload: Record<string, unknown>, successMessage: string) => Promise<boolean>;
  pb?: RaceSegment[];
  prediction?: RaceSegment[];
  race: SwimResult;
  source: RaceSplitSource;
}) {
  const { t } = useTranslator();
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(animationDefault);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const originRef = useRef(0);
  const total = actual.at(-1)?.cumulativeTime ?? race.timeSeconds;
  const distance = actual.at(-1)?.cumulativeDistance ?? Number.parseInt(race.event, 10);
  const [splitInputs, setSplitInputs] = useState(() => actual.map((segment) => segment.cumulativeTime.toFixed(2)));

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setEditing(false);
    setSplitInputs(actual.map((segment) => segment.cumulativeTime.toFixed(2)));
  }, [actual, race.id]);

  useEffect(() => {
    if (!animationDefault) {
      setMotionEnabled(false);
      setPlaying(false);
    }
  }, [animationDefault]);

  useEffect(() => {
    if (!playing || !motionEnabled) return;
    startRef.current = performance.now();
    originRef.current = progress;
    const tick = (now: number) => {
      const next = Math.min(1, originRef.current + (now - startRef.current) / 8_000);
      setProgress(next);
      if (next >= 1) setPlaying(false);
      else frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [motionEnabled, playing]);

  const tracks = [
    { label: "Actual", segments: actual, color: "#08aecb", source },
    ...(pb ? [{ label: "Personal best", segments: pb, color: "#18a96b", source: pb[0].source }] : []),
    ...(prediction ? [{ label: "Prediction", segments: prediction, color: "#6576d8", source: "ESTIMATED" as const }] : []),
    ...(goal ? [{ label: "Goal race", segments: goal, color: "#f59e0b", source: "ESTIMATED" as const }] : [])
  ];
  const replayTotal = Math.max(...tracks.map((track) => track.segments.at(-1)?.cumulativeTime ?? 0), total);
  const replayElapsed = replayTotal * progress;
  const actualElapsed = Math.min(total, replayElapsed);
  const actualPosition = getRaceReplayPosition(actual, actualElapsed);
  const checkpoints = Array.from(new Set([
    0,
    ...actual.map((segment) => Math.min(1, segment.cumulativeTime / replayTotal)),
    1
  ])).sort((left, right) => left - right);
  const parsedSplitInputs = splitInputs.map(parseTimeInput);
  let manualSplitError: string | undefined;
  if (parsedSplitInputs.some((value) => !Number.isFinite(value))) {
    manualSplitError = "Enter every cumulative split before saving.";
  } else {
    try {
      buildSegmentsFromCumulative({
        event: race.event,
        course: race.course,
        cumulativeTimes: parsedSplitInputs,
        source: "MANUAL",
        totalTime: race.timeSeconds
      });
    } catch {
      manualSplitError = "Split values must increase, remain plausible, and match the recorded finish time.";
    }
  }

  async function saveSplits() {
    if (manualSplitError) return;
    setSaving(true);
    const success = await mutate({ mode: "SAVE_SPLITS", raceId: race.id, cumulativeTimes: parsedSplitInputs }, "Manual splits saved separately from the official result.");
    setSaving(false);
    if (success) setEditing(false);
  }

  async function saveEstimate() {
    setSaving(true);
    await mutate({ mode: "GENERATE_ESTIMATE", raceId: race.id }, "Estimated replay saved with an estimated-data label.");
    setSaving(false);
  }

  function seekLength(direction: "previous" | "next") {
    setPlaying(false);
    const threshold = 0.002;
    const target = direction === "previous"
      ? [...checkpoints].reverse().find((checkpoint) => checkpoint < progress - threshold) ?? 0
      : checkpoints.find((checkpoint) => checkpoint > progress + threshold) ?? 1;
    setProgress(target);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2"><SourceBadge source={source} /><span className="text-xs text-stitch-abyss/52">{source === "ESTIMATED" ? t("Approximate to the nearest tenth. No official split was supplied.") : t("Pool-length timing from the selected source.")}</span></div>
        <div className="flex flex-wrap items-center gap-2">
          {source === "ESTIMATED" && <button className="race-lab-button race-lab-button-secondary" disabled={saving} type="button" onClick={saveEstimate}><Save aria-hidden className="h-4 w-4" />{t("Save estimate")}</button>}
          {actual.length > 1 && source !== "OFFICIAL" && <button className="race-lab-button race-lab-button-secondary" type="button" onClick={() => setEditing((value) => {
            if (!value) setSplitInputs(actual.map((segment) => segment.cumulativeTime.toFixed(2)));
            return !value;
          })}><PencilLine aria-hidden className="h-4 w-4" />{t("Enter splits")}</button>}
        </div>
      </div>

      <div className="race-pool overflow-hidden rounded-lg border border-stitch-abyss/10 bg-[#e9f9fb] p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-2xl font-semibold text-stitch-abyss" data-replay-clock={actualElapsed.toFixed(2)}>{formatRaceTime(actualElapsed)}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-medium text-stitch-abyss/60">
              <span>{Math.round(actualPosition.cumulativeDistance)}{race.course === "SCY" ? " yd" : " m"} / {distance}{race.course === "SCY" ? " yd" : " m"}</span>
              <span aria-hidden>·</span>
              <span>{actualPosition.completed ? t("Finished") : `${t("Length")} ${actualPosition.lengthIndex + 1}/${actualPosition.lengthCount}`}</span>
            </div>
          </div>
          <label className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-stitch-abyss/65"><input checked={motionEnabled} className="accent-aqua-600" type="checkbox" onChange={(event) => { setMotionEnabled(event.target.checked); if (!event.target.checked) setPlaying(false); }} />{t("Animate replay")}</label>
        </div>
        <div className="space-y-2.5">
          {tracks.map((track) => {
            const trackTotal = track.segments.at(-1)?.cumulativeTime ?? 0;
            const trackElapsed = Math.min(trackTotal, replayElapsed);
            const trackPosition = getRaceReplayPosition(track.segments, trackElapsed);
            const directionLabel = trackPosition.direction === "OUTBOUND" ? "Outbound" : "Return length";
            return (
              <div className="grid grid-cols-[86px_1fr_72px] items-center gap-2 sm:grid-cols-[118px_1fr_104px]" data-race-track={track.label} key={track.label}>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-stitch-abyss">{t(track.label)}</div>
                  <div className="truncate text-[0.62rem] font-medium text-stitch-abyss/55">{trackPosition.completed ? t("Finished") : <>{t("Length")} {trackPosition.lengthIndex + 1}/{trackPosition.lengthCount}<span className="hidden sm:inline"> · {t(directionLabel)}</span></>}</div>
                </div>
                <div className="relative h-10 overflow-hidden rounded-sm border border-stitch-abyss/10 bg-white/70 shadow-inner">
                  <div className="absolute inset-y-0 left-0 w-1 bg-stitch-abyss/14" /><div className="absolute inset-y-0 right-0 w-1 bg-stitch-abyss/14" />
                  <div className="absolute inset-y-0 left-1/4 border-l border-dashed border-stitch-abyss/10" /><div className="absolute inset-y-0 left-1/2 border-l border-dashed border-stitch-abyss/10" /><div className="absolute inset-y-0 left-3/4 border-l border-dashed border-stitch-abyss/10" />
                  <div
                    className="pointer-events-none absolute inset-y-0 left-3 will-change-transform"
                    data-lane-position={trackPosition.laneProgress.toFixed(4)}
                    data-length-index={trackPosition.lengthIndex}
                    style={{ transform: `translate3d(${trackPosition.laneProgress * 100}%, 0, 0)`, width: "calc(100% - 1.5rem)" }}
                  >
                    <span className="absolute left-0 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white shadow-[0_4px_10px_rgba(5,24,42,0.18)]" style={{ backgroundColor: track.color }}>
                      <ArrowRight aria-hidden className={cn("h-3.5 w-3.5 text-white transition-transform duration-150", trackPosition.direction === "RETURN" && "rotate-180")} />
                    </span>
                  </div>
                </div>
                <div className="min-w-0 text-right" data-live-time={trackElapsed.toFixed(2)}>
                  <div className="font-mono text-xs font-semibold text-stitch-abyss sm:text-sm">{displayTime(trackElapsed, track.source)}</div>
                  <div className="mt-0.5 truncate font-mono text-[0.58rem] text-stitch-abyss/48">/ {displayTime(trackTotal, track.source)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="flex gap-2">
          <button aria-label={t("Previous length")} className="race-lab-icon-button" disabled={progress <= 0} title={t("Previous length")} type="button" onClick={() => seekLength("previous")}><SkipBack aria-hidden className="h-4 w-4" /></button>
          <button aria-label={playing ? t("Pause replay") : t("Play replay")} className="race-lab-icon-button" disabled={!motionEnabled} type="button" onClick={() => { if (progress >= 1) setProgress(0); setPlaying((value) => !value); }}>{playing ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}</button>
          <button aria-label={t("Next length")} className="race-lab-icon-button" disabled={progress >= 1} title={t("Next length")} type="button" onClick={() => seekLength("next")}><SkipForward aria-hidden className="h-4 w-4" /></button>
          <button aria-label={t("Reset replay")} className="race-lab-icon-button" type="button" onClick={() => { setPlaying(false); setProgress(0); }}><RotateCcw aria-hidden className="h-4 w-4" /></button>
        </div>
        <input aria-label={t("Race replay position")} className="min-h-11 w-full accent-aqua-600" max="1" min="0" step="0.001" type="range" value={progress} onChange={(event) => { setPlaying(false); setProgress(Number(event.target.value)); }} />
        <div className="text-right font-mono text-xs text-stitch-abyss/55">{Math.round(progress * 100)}%</div>
      </div>

      {editing && (
        <div className="rounded-lg border border-stitch-abyss/10 bg-white/66 p-4">
          <div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-stitch-abyss">{t("Enter cumulative splits")}</h3><p className="mt-1 text-xs leading-5 text-stitch-abyss/52">{t("The final time is locked to the source result. Manual splits never replace official splits.")}</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {actual.map((segment, index) => (
              <label className="block" key={segment.cumulativeDistance}><span className="mb-1 block text-xs font-semibold text-stitch-abyss/65">{segment.cumulativeDistance}{race.course === "SCY" ? " yd" : " m"}</span><input aria-describedby={manualSplitError ? "manual-split-error" : undefined} aria-invalid={Boolean(manualSplitError)} className="race-lab-input" disabled={index === actual.length - 1} inputMode="decimal" value={index === actual.length - 1 ? race.timeSeconds.toFixed(2) : splitInputs[index]} onChange={(event) => setSplitInputs((current) => current.map((value, position) => position === index ? event.target.value : value))} /></label>
            ))}
          </div>
          {manualSplitError && <p aria-live="polite" className="mt-3 text-sm text-rose-700" id="manual-split-error">{t(manualSplitError)}</p>}
          <div className="mt-4 flex justify-end gap-2"><button className="race-lab-button race-lab-button-secondary" type="button" onClick={() => { setSplitInputs(actual.map((segment) => segment.cumulativeTime.toFixed(2))); setEditing(false); }}>{t("Cancel")}</button><button className="race-lab-button" disabled={saving || Boolean(manualSplitError)} type="button" onClick={saveSplits}><Save aria-hidden className="h-4 w-4" />{saving ? t("Saving") : t("Save splits")}</button></div>
        </div>
      )}
    </div>
  );
}

function AnalysisView({ actual, goal, goalSegments, pbIsSelected, pbSegments, predictionSegments, previousPb, previousSegments, race, shape }: {
  actual: RaceSegment[];
  goal?: Goal;
  goalSegments?: RaceSegment[];
  pbIsSelected: boolean;
  pbSegments?: RaceSegment[];
  predictionSegments?: RaceSegment[];
  previousPb?: SwimResult;
  previousSegments?: RaceSegment[];
  race: SwimResult;
  shape: ReturnType<typeof analyzeRaceShape>;
}) {
  const { t } = useTranslator();
  const preferredReference: ReferenceKey = previousSegments
    ? "previous"
    : pbSegments && !pbIsSelected
      ? "pb"
      : predictionSegments
        ? "prediction"
        : goalSegments
          ? "goal"
          : "pb";
  const [reference, setReference] = useState<ReferenceKey>(preferredReference);
  const [exportState, setExportState] = useState<"idle" | "exporting" | "success" | "error">("idle");
  const references: Record<ReferenceKey, RaceSegment[] | undefined> = { pb: pbSegments, previous: previousSegments, prediction: predictionSegments, goal: goalSegments };
  const labels: Record<ReferenceKey, string> = { pb: "Personal best", previous: "Previous race", prediction: "Prediction", goal: "Goal race" };
  const selectedReference = references[reference];
  const comparison = selectedReference ? compareRaceSegments(actual, selectedReference) : compareRaceSegments(actual, []);
  const exportCard = async () => {
    setExportState("exporting");
    const exported = await downloadRaceCard({ t, race, shape, previousPb, goal });
    setExportState(exported ? "success" : "error");
  };

  useEffect(() => {
    setReference(preferredReference);
  }, [pbIsSelected, preferredReference, race.id]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <QuietMetric label="Race shape" value={t(shape.primary)} />
        <QuietMetric label="Strongest segment" value={`${actual[shape.strongestSegment].cumulativeDistance}${race.course === "SCY" ? " yd" : " m"}`} />
        <QuietMetric label="Weakest segment" value={`${actual[shape.weakestSegment].cumulativeDistance}${race.course === "SCY" ? " yd" : " m"}`} />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-stitch-abyss/10 bg-white/62 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="font-semibold text-stitch-abyss">{t("Race-shape read")}</h3><p className="mt-1 text-sm text-stitch-abyss/56">{shape.patterns.map((pattern) => t(pattern)).join(" · ")}</p></div>
        <div className="shrink-0"><button className="race-lab-button w-full" disabled={exportState === "exporting"} type="button" onClick={exportCard}><Download aria-hidden className="h-4 w-4" />{exportState === "exporting" ? t("Exporting") : t("Export race card")}</button>{exportState === "success" && <p aria-live="polite" className="mt-1.5 text-center text-xs text-emerald-700">{t("Race card downloaded.")}</p>}{exportState === "error" && <p aria-live="polite" className="mt-1.5 text-center text-xs text-rose-700">{t("Race card could not be exported.")}</p>}</div>
      </div>

      <div className="rounded-lg border border-stitch-abyss/10 bg-white/66">
        <div className="flex flex-col gap-3 border-b border-stitch-abyss/8 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div><h3 className="font-semibold text-stitch-abyss">{t("Split comparison")}</h3><p className="mt-1 text-xs text-stitch-abyss/52">{t("Positive numbers lost time. Negative numbers gained time.")}</p></div>
          <label><span className="sr-only">{t("Comparison race")}</span><select className="race-lab-select" value={reference} onChange={(event) => setReference(event.target.value as ReferenceKey)}>{(Object.keys(labels) as ReferenceKey[]).map((key) => <option disabled={!references[key]} key={key} value={key}>{t(labels[key])}</option>)}</select></label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead><tr className="text-xs text-stitch-abyss/60"><th className="px-4 py-3 font-semibold">{t("Segment")}</th><th className="px-4 py-3 font-semibold">{t("Actual segment")}</th><th className="px-4 py-3 font-semibold">{t("Reference")}</th><th className="px-4 py-3 font-semibold">{t("Gain / loss")}</th><th className="px-4 py-3 font-semibold">{t("Cumulative")}</th><th className="px-4 py-3 font-semibold">{t("Cumulative gain / loss")}</th><th className="px-4 py-3 font-semibold">{t("Read")}</th></tr></thead>
            <tbody>
              {comparison.map((row) => {
                const approximate = row.source === "ESTIMATED" || row.referenceSource === "ESTIMATED";
                const isStrongest = row.segmentIndex === shape.strongestSegment;
                const isWeakest = row.segmentIndex === shape.weakestSegment;
                const segmentDeltaClass = row.segmentDelta === undefined || Math.abs(row.segmentDelta) < 0.005 ? "text-stitch-abyss/60" : row.segmentDelta < 0 ? "text-emerald-700" : "text-rose-700";
                const cumulativeDeltaClass = row.cumulativeDelta === undefined || Math.abs(row.cumulativeDelta) < 0.005 ? "text-stitch-abyss/60" : row.cumulativeDelta < 0 ? "text-emerald-700" : "text-rose-700";
                return <tr className="border-t border-stitch-abyss/7 text-stitch-abyss" key={row.segmentIndex}><td className="px-4 py-3 font-semibold">{row.cumulativeDistance}{race.course === "SCY" ? " yd" : " m"}</td><td className="px-4 py-3 font-mono">{displayTime(row.segmentTime, row.source)}</td><td className="px-4 py-3 font-mono text-stitch-abyss/65">{displayTime(row.referenceSegmentTime, row.referenceSource)}</td><td className={cn("px-4 py-3 font-mono font-semibold", segmentDeltaClass)}>{signedSeconds(row.segmentDelta, approximate)}</td><td className="px-4 py-3 font-mono">{displayTime(row.cumulativeTime, row.source)}</td><td className={cn("px-4 py-3 font-mono font-semibold", cumulativeDeltaClass)}>{signedSeconds(row.cumulativeDelta, approximate)}</td><td className="px-4 py-3">{isStrongest && isWeakest ? <span className="race-read-badge text-aqua-900">{t("Only segment")}</span> : isStrongest ? <span className="race-read-badge text-emerald-800">{t("Strongest")}</span> : isWeakest ? <span className="race-read-badge text-rose-800">{t("Weakest")}</span> : <span className="text-stitch-abyss/35">--</span>}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
        {!selectedReference && <p className="border-t border-stitch-abyss/8 p-4 text-sm text-stitch-abyss/55">{t("No matching reference race is available yet.")}</p>}
      </div>

      <details className="rounded-lg border border-stitch-abyss/10 bg-white/52 p-4 text-sm text-stitch-abyss/62"><summary className="cursor-pointer font-semibold text-stitch-abyss">{t("How Race Lab classifies race shape")}</summary><p className="mt-3 leading-6">{t("Rules compare pool-length pace and race halves: start 3%, even halves 1.5%, positive or negative split 2%, finish change 3–4%, and middle variation 4%. These are descriptive rules, not medical or physiological claims.")}</p><p className="mt-2 text-xs text-stitch-abyss/45">{t("Threshold version")}: {RACE_LAB_ENGINE_VERSION} · {RACE_SHAPE_THRESHOLDS.splitDifference * 100}%</p></details>
    </div>
  );
}

function QuietMetric({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  return <div className="rounded-lg border border-stitch-abyss/10 bg-white/58 p-4"><div className="text-xs font-semibold text-stitch-abyss/45">{t(label)}</div><div className="mt-2 text-xl font-semibold text-stitch-abyss">{value}</div></div>;
}

function BuildView({ actual, goal, historicalShapes, mutate, pb, race, scenarios }: {
  actual: RaceSegment[];
  goal?: Goal;
  historicalShapes: RaceSegment[][];
  mutate: (payload: Record<string, unknown>, successMessage: string) => Promise<boolean>;
  pb?: SwimResult;
  race: SwimResult;
  scenarios: SavedRaceLabScenario[];
}) {
  const { t } = useTranslator();
  const [builderMode, setBuilderMode] = useState<"simulation" | "goal">("simulation");
  const [settings, setSettings] = useState<SimulationSettings>({ ...DEFAULT_SIMULATION_SETTINGS });
  const [scenarioName, setScenarioName] = useState(() => t("Race adjustment"));
  const [targetTime, setTargetTime] = useState((goal?.targetTime ?? race.timeSeconds).toFixed(2));
  const [strategy, setStrategy] = useState<RacePacingStrategy>("BALANCED");
  const [goalInputs, setGoalInputs] = useState<string[]>([]);
  const [goalEdited, setGoalEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScenarioName(t("Race adjustment"));
  }, [t]);

  let simulation: ReturnType<typeof simulateRace> | undefined;
  let simulationError: string | undefined;
  try { simulation = simulateRace({ event: race.event, course: race.course, baseSegments: actual, settings }); }
  catch (error) { simulationError = error instanceof RaceLabValidationError ? error.message : "Simulation values are invalid."; }

  const numericTarget = parseTimeInput(targetTime);
  const generatedGoal = useMemo(() => {
    try { return generateGoalRace({ event: race.event, course: race.course, targetTime: numericTarget, strategy, historicalShapes }); }
    catch { return undefined; }
  }, [historicalShapes, numericTarget, race.course, race.event, strategy]);

  useEffect(() => {
    setGoalInputs(generatedGoal ? generatedGoal.segments.map((segment) => segment.segmentTime.toFixed(2)) : []);
    setGoalEdited(false);
  }, [generatedGoal]);

  const goalTimes = goalInputs.map(parseTimeInput);
  const goalInputsReady = goalTimes.length === getSegmentCount(race.event, race.course) && goalTimes.every(Number.isFinite);
  const editableTotal = goalInputsReady ? goalTimes.reduce((total, value) => total + value, 0) : undefined;
  let editableGoal: RaceSegment[] | undefined;
  try {
    if (goalInputsReady && Number.isFinite(numericTarget)) {
      editableGoal = rebuildEditableGoal({ event: race.event, course: race.course, targetTime: numericTarget, segmentTimes: goalTimes });
    }
  } catch { editableGoal = undefined; }

  async function saveSimulation() {
    if (!simulation) return;
    setSaving(true);
    await mutate({ mode: "SAVE_SIMULATION", raceId: race.id, name: scenarioName.trim(), settings }, "Simulation snapshot saved. The official race was not changed.");
    setSaving(false);
  }

  async function saveGoal() {
    if (!editableGoal) return;
    setSaving(true);
    await mutate({
      mode: "SAVE_GOAL_RACE",
      raceId: race.id,
      name: t("Goal race"),
      targetTime: numericTarget,
      strategy,
      ...(goalEdited ? { segmentTimes: goalTimes } : {})
    }, "Goal race snapshot saved.");
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md bg-stitch-abyss/[0.055] p-1">
        <button className={cn("ui-press min-h-11 rounded px-3 text-sm font-semibold", builderMode === "simulation" ? "bg-white text-stitch-abyss shadow-sm" : "text-stitch-abyss/65")} type="button" onClick={() => setBuilderMode("simulation")}>{t("What-if simulator")}</button>
        <button className={cn("ui-press min-h-11 rounded px-3 text-sm font-semibold", builderMode === "goal" ? "bg-white text-stitch-abyss shadow-sm" : "text-stitch-abyss/65")} type="button" onClick={() => setBuilderMode("goal")}>{t("Goal race builder")}</button>
      </div>

      {builderMode === "simulation" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.72fr)]">
          <div className="rounded-lg border border-stitch-abyss/10 bg-white/64 p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-stitch-abyss">{t("Adjust the race")}</h3><p className="mt-1 text-xs leading-5 text-stitch-abyss/65">{t("Every output below is a deterministic simulation, not a prediction.")}</p></div><button className="race-lab-button race-lab-button-secondary shrink-0" type="button" onClick={() => setSettings({ ...DEFAULT_SIMULATION_SETTINGS })}><RotateCcw aria-hidden className="h-4 w-4" />{t("Reset adjustments")}</button></div>
            <div className="mt-5 space-y-5">
              <Control label="Reaction time" max={1.5} min={0.45} step={0.01} suffix="s" value={settings.reactionTime} onChange={(value) => setSettings({ ...settings, reactionTime: value })} />
              <Control label="First segment" max={3} min={-2} step={0.05} suffix="s" value={settings.firstSegmentAdjustment} signed onChange={(value) => setSettings({ ...settings, firstSegmentAdjustment: value })} />
              {actual.length > 2 && <Control label="Middle segments" max={2} min={-1.25} step={0.05} suffix="s" value={settings.middleSegmentAdjustment} signed onChange={(value) => setSettings({ ...settings, middleSegmentAdjustment: value })} />}
              <Control label="Final segment" max={2.5} min={-1.5} step={0.05} suffix="s" value={settings.finalSegmentAdjustment} signed onChange={(value) => setSettings({ ...settings, finalSegmentAdjustment: value })} />
              {actual.length > 1 && <Control label="Turn time per turn" max={0.8} min={-0.4} step={0.02} suffix="s" value={settings.turnAdjustment} signed onChange={(value) => setSettings({ ...settings, turnAdjustment: value })} />}
              {actual.length > 1 && <Control label="Underwater efficiency proxy" max={1} min={-1} step={0.05} suffix="" value={settings.underwaterEfficiency} signed onChange={(value) => setSettings({ ...settings, underwaterEfficiency: value })} />}
            </div>
          </div>
          <div className="rounded-lg border border-stitch-abyss/10 bg-stitch-abyss p-5 text-white">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-stitch-cyan">{t("Simulation")}</div>
            <div className="mt-3 font-mono text-4xl font-semibold">{simulation ? formatRaceTime(simulation.projectedTime) : "--"}</div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-y border-white/12 py-4"><Difference label="From PB" value={simulation && pb ? simulation.projectedTime - pb.timeSeconds : undefined} /><Difference label="From goal" value={simulation && goal ? simulation.projectedTime - goal.targetTime : undefined} /></div>
            {simulationError && <p className="mt-4 text-sm leading-6 text-rose-200">{t("A setting produces an unrealistic segment. Move it back inside the safe range.")}</p>}
            {simulation && <details className="mt-4 border-b border-white/12 pb-4"><summary className="cursor-pointer text-sm font-semibold text-white">{t("Simulated splits")}</summary><div className="mt-3 max-h-56 overflow-y-auto pr-1">{simulation.segments.map((segment) => <div className="flex items-center justify-between gap-4 border-t border-white/8 py-2 text-xs first:border-t-0" key={segment.segmentIndex}><span className="text-white/65">{segment.cumulativeDistance}{race.course === "SCY" ? " yd" : " m"}</span><span className="font-mono text-white">{formatRaceTime(segment.segmentTime)} <span className="text-white/45">· {formatRaceTime(segment.cumulativeTime)}</span></span></div>)}</div></details>}
            <label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold text-white/70">{t("Scenario name")}</span><input className="h-11 w-full rounded-md border border-white/20 bg-white/10 px-3 text-sm text-white outline-none focus:border-stitch-cyan" maxLength={80} value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} /></label>
            <button className="race-lab-button race-lab-button-accent mt-4 w-full" disabled={!simulation || saving || !scenarioName.trim()} type="button" onClick={saveSimulation}><Save aria-hidden className="h-4 w-4" />{saving ? t("Saving") : t("Save simulation")}</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-lg border border-stitch-abyss/10 bg-white/64 p-4 sm:p-5">
            <h3 className="font-semibold text-stitch-abyss">{t("Set the target")}</h3>
            <label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-stitch-abyss/65">{t("Goal time")}</span><input aria-describedby="goal-time-format" aria-invalid={!generatedGoal} className="race-lab-input" inputMode="decimal" placeholder="1:00.00" value={targetTime} onChange={(event) => setTargetTime(event.target.value)} /></label>
            <p className="mt-1.5 text-xs text-stitch-abyss/60" id="goal-time-format">{t("Use seconds or minutes and seconds, for example 59.80 or 1:02.40.")}</p>
            <fieldset className="mt-4"><legend className="mb-2 text-xs font-semibold text-stitch-abyss/65">{t("Pacing strategy")}</legend><div className="grid grid-cols-3 gap-1 rounded-md bg-stitch-abyss/[0.055] p-1">{(["AGGRESSIVE", "BALANCED", "CONSERVATIVE"] as const).map((item) => <button className={cn("ui-press min-h-11 min-w-0 rounded px-1 py-2 text-[0.68rem] font-semibold", strategy === item ? "bg-white text-stitch-abyss shadow-sm" : "text-stitch-abyss/60")} key={item} type="button" onClick={() => setStrategy(item)}>{t(item === "AGGRESSIVE" ? "Aggressive" : item === "BALANCED" ? "Balanced" : "Conservative")}</button>)}</div></fieldset>
            <p className="mt-4 text-xs leading-5 text-stitch-abyss/65">{!generatedGoal ? t("Enter a plausible goal time to generate split targets.") : generatedGoal.usedHistoricalShape ? t("Built from your explicit recent race shape and an event template.") : t("Built from an event template because explicit historical splits are unavailable.")}</p>
            <button className="race-lab-button mt-5 w-full" disabled={!editableGoal || saving} type="button" onClick={saveGoal}><Target aria-hidden className="h-4 w-4" />{saving ? t("Saving") : t("Save goal race")}</button>
          </div>
          <div className="rounded-lg border border-stitch-abyss/10 bg-white/64 p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-semibold text-stitch-abyss">{t("Editable split targets")}</h3><p className="mt-1 text-xs text-stitch-abyss/65">{t("Adjust any segment. The total must still equal the goal time.")}</p></div><div className={cn("font-mono text-sm font-semibold", editableGoal ? "text-emerald-700" : "text-rose-700")}>{t("Total")}: {editableTotal === undefined ? "--" : formatRaceTime(editableTotal)}{editableTotal === undefined || !Number.isFinite(numericTarget) ? "" : ` · ${signedSeconds(editableTotal - numericTarget)}`}</div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{goalInputs.map((value, index) => <label className="block" key={index}><span className="mb-1 block text-xs font-semibold text-stitch-abyss/65">{getCourseLength(race.course) * (index + 1)}{race.course === "SCY" ? " yd" : " m"}</span><input aria-invalid={!editableGoal} className="race-lab-input" inputMode="decimal" value={value} onChange={(event) => { setGoalEdited(true); setGoalInputs((current) => current.map((item, position) => position === index ? event.target.value : item)); }} /></label>)}</div>
            {!editableGoal && <p className="mt-4 text-sm text-rose-700">{t("Split targets must be plausible and add up to the goal time.")}</p>}
          </div>
        </div>
      )}

      {scenarios.length > 0 && <SavedScenarios mutate={mutate} scenarios={scenarios} />}
    </div>
  );
}

function Control({ label, max, min, onChange, signed = false, step, suffix, value }: { label: string; max: number; min: number; onChange: (value: number) => void; signed?: boolean; step: number; suffix: string; value: number }) {
  const { t } = useTranslator();
  return <label className="grid grid-cols-[1fr_74px] items-center gap-x-3 gap-y-1"><span className="text-sm font-semibold text-stitch-abyss/75">{t(label)}</span><span className="text-right font-mono text-sm font-semibold text-stitch-abyss">{signed && value > 0 ? "+" : ""}{value.toFixed(step < 0.05 ? 2 : 1)}{suffix}</span><input className="col-span-2 min-h-11 w-full accent-aqua-600" max={max} min={min} step={step} type="range" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function Difference({ label, value }: { label: string; value?: number }) {
  const { t } = useTranslator();
  return <div><div className="text-xs text-white/48">{t(label)}</div><div className="mt-1 font-mono text-lg font-semibold">{signedSeconds(value)}</div></div>;
}

function SavedScenarios({ mutate, scenarios }: { mutate: (payload: Record<string, unknown>, successMessage: string) => Promise<boolean>; scenarios: SavedRaceLabScenario[] }) {
  const { language, t } = useTranslator();
  const [open, setOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function deleteScenario(scenarioId: string) {
    setDeletingId(scenarioId);
    const success = await mutate({ mode: "DELETE_SCENARIO", scenarioId }, "Scenario deleted.");
    setDeletingId(null);
    if (success) setConfirmingId(null);
  }

  return (
    <div className="rounded-lg border border-stitch-abyss/10 bg-white/52">
      <button aria-expanded={open} className="flex min-h-14 w-full items-center justify-between gap-3 p-4 text-left" type="button" onClick={() => setOpen((value) => !value)}>
        <span><span className="block font-semibold text-stitch-abyss">{t("Saved scenarios")}</span><span className="mt-1 block text-xs text-stitch-abyss/65">{scenarios.length} {t("immutable snapshots")}</span></span>
        <Sparkles aria-hidden className="h-4 w-4 text-aqua-700" />
      </button>
      {open && (
        <div className="border-t border-stitch-abyss/8 p-2">
          {scenarios.map((scenario) => (
            <div className="rounded-md px-2 py-3 transition-colors hover:bg-white/70" key={scenario.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0"><div className="truncate text-sm font-semibold text-stitch-abyss">{scenario.name}</div><div className="mt-1 text-xs text-stitch-abyss/65">{t(scenario.kind === "SIMULATION" ? "Simulation" : "Goal race")} · {formatRaceTime(scenario.projectedTime)} · {new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : language === "vi" ? "vi-VN" : "en", { month: "short", day: "numeric" }).format(dateForDisplay(scenario.createdAt))}</div></div>
                <button aria-label={t("Delete scenario")} className="race-lab-icon-button shrink-0" disabled={deletingId === scenario.id} type="button" onClick={() => setConfirmingId(scenario.id)}><Trash2 aria-hidden className="h-4 w-4" /></button>
              </div>
              {confirmingId === scenario.id && (
                <div className="mt-3 flex flex-col gap-3 border-t border-stitch-abyss/8 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-stitch-abyss">{t("Delete this snapshot?")}</p>
                  <div className="flex gap-2"><button className="race-lab-button race-lab-button-secondary flex-1 sm:flex-none" disabled={deletingId === scenario.id} type="button" onClick={() => setConfirmingId(null)}>{t("Keep")}</button><button className="race-lab-button flex-1 bg-rose-700 sm:flex-none" disabled={deletingId === scenario.id} type="button" onClick={() => deleteScenario(scenario.id)}>{deletingId === scenario.id ? t("Deleting") : t("Delete")}</button></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function downloadRaceCard({ goal, previousPb, race, shape, t }: {
  goal?: Goal;
  previousPb?: SwimResult;
  race: SwimResult;
  shape: ReturnType<typeof analyzeRaceShape>;
  t: (value: string) => string;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1500;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(false);
  context.fillStyle = "#04111d";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#083449";
  context.fillRect(0, 0, canvas.width, 18);
  context.strokeStyle = "rgba(78,232,255,0.18)";
  context.lineWidth = 2;
  for (let y = 340; y < 1280; y += 155) {
    context.beginPath();
    context.moveTo(90, y);
    context.lineTo(1110, y);
    context.stroke();
  }
  context.fillStyle = "#4ee8ff";
  context.font = "600 34px system-ui";
  context.fillText(t("SWIMSIGHT RACE LAB"), 90, 120);
  context.fillStyle = "#ffffff";
  context.font = "600 72px system-ui";
  context.fillText(`${t(race.event)} · ${race.course}`, 90, 245);
  context.font = "700 190px ui-monospace, monospace";
  context.fillText(formatRaceTime(race.timeSeconds), 82, 500);
  const pbImprovement = previousPb
    ? race.timeSeconds < previousPb.timeSeconds
      ? signedSeconds(previousPb.timeSeconds - race.timeSeconds)
      : t("Not a personal best")
    : t("First recorded PB");
  const metrics = [
    [t("PB improvement"), pbImprovement],
    [t("Race shape"), t(shape.primary)],
    [t("Strongest segment"), `${getCourseLength(race.course) * (shape.strongestSegment + 1)} ${race.course === "SCY" ? "yd" : "m"}`],
    [t("Weakest segment"), `${getCourseLength(race.course) * (shape.weakestSegment + 1)} ${race.course === "SCY" ? "yd" : "m"}`],
    [t("Goal progress"), goal ? signedSeconds(race.timeSeconds - goal.targetTime) : t("No goal set")]
  ];
  metrics.forEach(([label, value], index) => {
    const y = 670 + index * 155;
    context.fillStyle = "rgba(255,255,255,0.52)";
    context.font = "600 28px system-ui";
    context.fillText(label, 90, y);
    context.fillStyle = "#ffffff";
    context.font = "600 46px system-ui";
    context.fillText(value, 90, y + 62);
  });
  context.fillStyle = "rgba(255,255,255,0.42)";
  context.font = "500 25px system-ui";
  context.fillText(t("Private account details excluded by default."), 90, 1420);
  return new Promise<boolean>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.download = `swimsight-race-lab-${race.event.toLowerCase().replaceAll(" ", "-")}-${race.course.toLowerCase()}.png`;
      anchor.href = url;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      resolve(true);
    }, "image/png");
  });
}
