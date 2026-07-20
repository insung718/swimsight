"use client";

import { Target } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslator } from "@/components/i18n/use-language";
import { calculateGoalProjection } from "@/lib/analytics";
import { supportedEvents } from "@/lib/events";
import { formatDate, formatTime, parseTimeInput } from "@/lib/utils";
import type { Course, Goal, GoalProjection, SwimEvent, SwimResult } from "@/types/swim";

export function GoalTracker({ swims, initialGoal, initialProjection }: { swims: SwimResult[]; initialGoal?: Goal; initialProjection?: GoalProjection }) {
  const router = useRouter();
  const { language, t } = useTranslator();
  const [event, setEvent] = useState<SwimEvent | "">(initialGoal?.event ?? "");
  const [course, setCourse] = useState<Course>(initialGoal?.course ?? "LCM");
  const [targetTime, setTargetTime] = useState(initialGoal ? formatTime(initialGoal.targetTime) : "");
  const [qualifyingTime, setQualifyingTime] = useState(initialGoal?.qualifyingTime ? formatTime(initialGoal.qualifyingTime) : "");
  const [targetDate, setTargetDate] = useState(initialGoal?.targetDate ?? "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const parsedTargetTime = parseTimeInput(targetTime);
  const parsedQualifyingTime = qualifyingTime.trim() ? parseTimeInput(qualifyingTime) : null;
  const projection = useMemo(() => {
    if (!initialGoal || !event || !Number.isFinite(parsedTargetTime) || !swims.some((swim) => swim.event === event && swim.course === course)) return null;
    if (initialProjection && event === initialGoal.event && course === initialGoal.course && parsedTargetTime === initialGoal.targetTime && parsedQualifyingTime === (initialGoal.qualifyingTime ?? null) && targetDate === initialGoal.targetDate) return initialProjection;
    return calculateGoalProjection(swims, { ...initialGoal, event, course, targetTime: parsedTargetTime, qualifyingTime: parsedQualifyingTime, targetDate });
  }, [course, event, initialGoal, initialProjection, parsedQualifyingTime, parsedTargetTime, swims, targetDate]);

  async function saveGoal() {
    if (!event || !targetDate || !Number.isFinite(parsedTargetTime) || parsedTargetTime <= 0 || (parsedQualifyingTime !== null && (!Number.isFinite(parsedQualifyingTime) || parsedQualifyingTime <= 0))) {
      setStatus(t("Complete the event, target time, and date."));
      return;
    }
    setSaving(true);
    const response = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, course, targetTime: parsedTargetTime, qualifyingTime: parsedQualifyingTime, targetDate }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setStatus(result.error ? t(result.error) : t("Could not save goal.")); return; }
    setStatus(t("Goal saved."));
    router.refresh();
  }

  return (
    <section className="stitch-panel p-5">
      <div className="mb-5 flex items-center gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-cyan/10 text-stitch-cyan"><Target aria-hidden className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold text-white">{t("Goal tracker")}</h2><p className="text-sm text-white/70">{t("Set a target from your own results")}</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm text-white/80">{t("Event")}<select className="mt-1 h-11 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" value={event} onChange={(e) => setEvent(e.target.value as SwimEvent | "")}><option value="">{t("Select event")}</option>{supportedEvents.map((item) => <option key={item} value={item}>{t(item)}</option>)}</select></label>
        <label className="text-sm text-white/80">{t("Pool type")}<select className="mt-1 h-11 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" value={course} onChange={(e) => setCourse(e.target.value as Course)}><option value="LCM">LCM</option><option value="SCM">SCM</option><option value="SCY">SCY</option></select></label>
        <label className="text-sm text-white/80">{t("Goal time")}<input className="mt-1 h-11 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" inputMode="decimal" placeholder={t("e.g. 59.00")} value={targetTime} onChange={(e) => setTargetTime(e.target.value)} /></label>
        <label className="text-sm text-white/80">{t("Qualifying time (optional)")}<input className="mt-1 h-11 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" inputMode="decimal" placeholder={t("e.g. 58.50")} value={qualifyingTime} onChange={(e) => setQualifyingTime(e.target.value)} /></label>
        <label className="text-sm text-white/80">{t("Goal date")}<input className="mt-1 h-11 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" type="date" min={new Date().toISOString().slice(0, 10)} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label>
      </div>
      <div className="mt-4 flex items-center gap-3"><button className="ui-press h-11 rounded-full bg-stitch-cyan px-5 text-sm font-semibold text-stitch-abyss hover:bg-white disabled:opacity-50" disabled={saving} type="button" onClick={saveGoal}>{saving ? t("Saving") : t("Save goal")}</button>{status && <p className="text-sm text-white/72">{status}</p>}</div>
      {projection && <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Current PB", formatTime(projection.currentTime)], ["Required / month", `${projection.requiredMonthlyImprovement.toFixed(2)}${t("s")}`], ["Current pace / month", `${projection.currentMonthlyPace.toFixed(2)}${t("s")}`], ["Goal probability", `${projection.goalProbability.probability.toFixed(1)}%`], [formatDate(projection.targetDate, language), formatTime(projection.predictedAtGoalDate)]].map(([label, value]) => <div className="rounded-lg border border-white/15 bg-white/10 p-3" key={label}><div className="text-xs text-white/82">{t(label)}</div><div className="mt-1 font-mono text-2xl font-semibold text-white">{value}</div></div>)}</div>}
      {projection && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/66"><span className="rounded-full border border-white/12 bg-white/[0.07] px-3 py-1.5">{t(projection.feasibility)}</span><span>{t(projection.goalProbability.calibration)} · {t(projection.goalProbability.method)}</span>{projection.qualifyingProbability && <span>{t("Qualifying probability")}: {projection.qualifyingProbability.probability.toFixed(1)}%</span>}</div>}
    </section>
  );
}
