"use client";

import { Target } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateGoalProjection } from "@/lib/analytics";
import { supportedEvents } from "@/lib/events";
import { formatDate, formatTime, parseTimeInput } from "@/lib/utils";
import type { Goal, SwimEvent, SwimResult } from "@/types/swim";

export function GoalTracker({ swims, initialGoal }: { swims: SwimResult[]; initialGoal?: Goal }) {
  const router = useRouter();
  const [event, setEvent] = useState<SwimEvent | "">(initialGoal?.event ?? "");
  const [targetTime, setTargetTime] = useState(initialGoal ? formatTime(initialGoal.targetTime) : "");
  const [targetDate, setTargetDate] = useState(initialGoal?.targetDate ?? "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const parsedTargetTime = parseTimeInput(targetTime);
  const projection = useMemo(() => {
    if (!initialGoal || !event || !Number.isFinite(parsedTargetTime) || !swims.some((swim) => swim.event === event)) return null;
    return calculateGoalProjection(swims, { ...initialGoal, event, targetTime: parsedTargetTime, targetDate });
  }, [event, initialGoal, parsedTargetTime, swims, targetDate]);

  async function saveGoal() {
    if (!event || !targetDate || !Number.isFinite(parsedTargetTime) || parsedTargetTime <= 0) {
      setStatus("Complete the event, target time, and date.");
      return;
    }
    setSaving(true);
    const response = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, targetTime: parsedTargetTime, targetDate }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { setStatus(result.error ?? "Could not save goal."); return; }
    setStatus("Goal saved.");
    router.refresh();
  }

  return (
    <section className="stitch-panel p-5">
      <div className="mb-5 flex items-center gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-cyan/10 text-stitch-cyan"><Target aria-hidden className="h-5 w-5" /></span><div><h2 className="text-lg font-semibold text-white">Goal tracker</h2><p className="text-sm text-white/42">Set a target from your own results</p></div></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm text-white/65">Event<select className="mt-1 h-11 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" value={event} onChange={(e) => setEvent(e.target.value as SwimEvent | "")}><option value="">Select event</option>{supportedEvents.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label className="text-sm text-white/65">Goal time<input className="mt-1 h-11 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" inputMode="decimal" placeholder="e.g. 59.00" value={targetTime} onChange={(e) => setTargetTime(e.target.value)} /></label>
        <label className="text-sm text-white/65">Goal date<input className="mt-1 h-11 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} /></label>
      </div>
      <div className="mt-4 flex items-center gap-3"><button className="h-11 rounded-full bg-stitch-cyan px-5 text-sm font-semibold text-stitch-abyss transition hover:bg-white disabled:opacity-50" disabled={saving} type="button" onClick={saveGoal}>{saving ? "Saving…" : "Save goal"}</button>{status && <p className="text-sm text-white/48">{status}</p>}</div>
      {projection && <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Current PB", formatTime(projection.currentTime)], ["Required / month", `${projection.requiredMonthlyImprovement.toFixed(2)}s`], ["Current pace / month", `${projection.currentMonthlyPace.toFixed(2)}s`], [formatDate(projection.targetDate), formatTime(projection.predictedAtGoalDate)]].map(([label, value]) => <div className="rounded-lg border border-white/8 bg-white/[0.035] p-3" key={label}><div className="text-xs text-white/40">{label}</div><div className="mt-1 font-mono text-2xl font-semibold text-white">{value}</div></div>)}</div>}
    </section>
  );
}
