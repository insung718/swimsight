"use client";

import { Dumbbell, Save, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslator } from "@/components/i18n/use-language";
import { KineticLoader } from "@/components/ui/kinetic-loader";
import type { DashboardAnalytics, GymWorkout, GymWorkoutType } from "@/types/swim";

const workoutTypes: { label: string; value: GymWorkoutType }[] = [
  { label: "Strength", value: "STRENGTH" },
  { label: "Core", value: "CORE" },
  { label: "Mobility", value: "MOBILITY" },
  { label: "Dryland", value: "DRYLAND" },
  { label: "Cardio", value: "CARDIO" },
  { label: "Recovery", value: "RECOVERY" }
];

export function GymWorkoutPanel({
  trainingLoad,
  workouts
}: {
  trainingLoad: DashboardAnalytics["trainingLoad"];
  workouts: GymWorkout[];
}) {
  const router = useRouter();
  const { t } = useTranslator();
  const [date, setDate] = useState("");
  const [workoutType, setWorkoutType] = useState<GymWorkoutType>("STRENGTH");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [intensity, setIntensity] = useState("6");
  const [focus, setFocus] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveWorkout() {
    const duration = Number(durationMinutes);
    const effort = Number(intensity);
    if (!date || !Number.isInteger(duration) || duration <= 0 || !Number.isInteger(effort) || effort < 1 || effort > 10) {
      setStatus(t("Add a valid date, duration, and 1-10 intensity."));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/gym", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          workoutType,
          durationMinutes: duration,
          intensity: effort,
          focus: focus.trim() || undefined
        })
      });
      const result = await response.json();
      if (!response.ok) {
        setStatus(result.error ? t(result.error) : t("Could not save workout."));
        return;
      }
      setStatus(t("Workout saved. Predictions will refresh with this training load."));
      setDurationMinutes("");
      setFocus("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-glass overflow-hidden p-5">
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow">
              <Dumbbell aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">{t("Gym training")}</h2>
              <p className="text-sm text-white/70">{t("Strength and dryland load now informs predictions.")}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <LoadMetric label="Weekly load" value={trainingLoad.weeklyLoad.toString()} />
            <LoadMetric label="Last 28 days" value={`${trainingLoad.sessionsLast28Days} ${t("sessions")}`} />
            <LoadMetric label="Load ratio" value={`${trainingLoad.loadRatio}x`} />
            <LoadMetric label="Model signal" value={t(trainingLoad.label)} />
          </div>

          <div className="mt-5 rounded-lg border border-white/12 bg-white/[0.08] p-4">
            <div className="flex gap-3">
              <ShieldCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-aqua-200" />
              <p className="text-sm leading-6 text-white/72">
                {t("Gym work adjusts projections conservatively. Consistent moderate training can slightly strengthen an improving trend; high recent load lowers confidence as fatigue risk.")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/12 bg-white/[0.08] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-white/80">
              {t("Date")}
              <input className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none focus:border-stitch-cyan" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-white/80">
              {t("Type")}
              <select className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none focus:border-stitch-cyan" value={workoutType} onChange={(event) => setWorkoutType(event.target.value as GymWorkoutType)}>
                {workoutTypes.map((type) => <option key={type.value} value={type.value}>{t(type.label)}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-white/80">
              {t("Duration")}
              <input className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-stitch-cyan" inputMode="numeric" placeholder="45 minutes" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-white/80">
              {t("Intensity")}
              <input className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none focus:border-stitch-cyan" inputMode="numeric" max={10} min={1} type="number" value={intensity} onChange={(event) => setIntensity(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-white/80 sm:col-span-2">
              {t("Focus")}
              <input className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-stitch-cyan" placeholder={t("Pull strength, core stability, mobility...")} value={focus} onChange={(event) => setFocus(event.target.value)} />
            </label>
          </div>
          <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-stitch-cyan px-4 text-sm font-semibold text-stitch-abyss transition hover:bg-white disabled:cursor-wait disabled:opacity-70" disabled={saving} type="button" onClick={saveWorkout}>
            {saving ? <KineticLoader className="h-4 text-stitch-abyss" label={t("Saving workout")} /> : <Save aria-hidden className="h-4 w-4" />}
            {saving ? t("Saving") : t("Save workout")}
          </button>
          {status && <p className="mt-3 text-sm text-white/72">{status}</p>}

          <div className="mt-5 space-y-2">
            {workouts.length === 0 && <div className="rounded-lg border border-dashed border-white/12 p-4 text-sm text-white/72">{t("No gym workouts logged yet.")}</div>}
            {workouts.slice(-4).reverse().map((workout) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2 text-sm" key={workout.id}>
                <div>
                  <div className="font-semibold text-white">{t(formatWorkoutType(workout.workoutType))}</div>
                  <div className="text-white/58">{workout.date}{workout.focus ? ` · ${workout.focus}` : ""}</div>
                </div>
                <div className="text-right font-mono text-aqua-100">
                  {workout.trainingLoad}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LoadMetric({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.08] p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/48">{t(label)}</div>
      <div className="mt-2 font-mono text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function formatWorkoutType(type: GymWorkoutType) {
  return type.toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}
