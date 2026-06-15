"use client";

import { Target } from "lucide-react";
import { useMemo, useState } from "react";
import { calculateGoalProjection } from "@/lib/analytics";
import { formatDate, formatTime, parseTimeInput } from "@/lib/utils";
import type { Goal, SwimEvent, SwimResult } from "@/types/swim";

interface GoalTrackerProps {
  swims: SwimResult[];
  initialGoal: Goal;
}

const likelihoodClasses = {
  High: "bg-mint-400/10 text-mint-500",
  Medium: "bg-aqua-50 text-aqua-600 dark:bg-aqua-400/10 dark:text-aqua-100",
  Low: "bg-coral-400/10 text-coral-500"
};

export function GoalTracker({ swims, initialGoal }: GoalTrackerProps) {
  const events = useMemo(
    () => Array.from(new Set(swims.map((swim) => swim.event))).sort(),
    [swims]
  );
  const [event, setEvent] = useState<SwimEvent>(initialGoal.event);
  const [targetTime, setTargetTime] = useState(formatTime(initialGoal.targetTime));
  const [targetDate, setTargetDate] = useState(initialGoal.targetDate);
  const parsedTargetTime = parseTimeInput(targetTime);
  const projection = useMemo(() => {
    const fallbackTime = Number.isFinite(parsedTargetTime) ? parsedTargetTime : initialGoal.targetTime;

    return calculateGoalProjection(swims, {
      ...initialGoal,
      event,
      targetTime: fallbackTime,
      targetDate
    });
  }, [event, initialGoal, parsedTargetTime, swims, targetDate]);

  return (
    <section className="rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04] lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-coral-400/10 text-coral-500">
          <Target aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Goal Tracker</h2>
          <p className="text-sm text-navy-500 dark:text-navy-100">Pace, target, and success likelihood</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-navy-700 dark:text-navy-100">
          Event
          <select
            className="mt-1 h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
            value={event}
            onChange={(changeEvent) => setEvent(changeEvent.target.value as SwimEvent)}
          >
            {events.map((swimEvent) => (
              <option key={swimEvent} value={swimEvent}>
                {swimEvent}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-navy-700 dark:text-navy-100">
          Goal Time
          <input
            className="mt-1 h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
            inputMode="decimal"
            value={targetTime}
            onChange={(changeEvent) => setTargetTime(changeEvent.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-navy-700 dark:text-navy-100">
          Goal Date
          <input
            className="mt-1 h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
            type="date"
            value={targetDate}
            onChange={(changeEvent) => setTargetDate(changeEvent.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-navy-50 p-3 dark:border-white/10">
          <div className="text-xs text-navy-500 dark:text-navy-100">Current PB</div>
          <div className="mt-1 text-2xl font-bold text-navy-950 dark:text-white">
            {formatTime(projection.currentTime)}
          </div>
        </div>
        <div className="rounded-lg border border-navy-50 p-3 dark:border-white/10">
          <div className="text-xs text-navy-500 dark:text-navy-100">Required / month</div>
          <div className="mt-1 text-2xl font-bold text-navy-950 dark:text-white">
            {projection.requiredMonthlyImprovement.toFixed(2)}s
          </div>
        </div>
        <div className="rounded-lg border border-navy-50 p-3 dark:border-white/10">
          <div className="text-xs text-navy-500 dark:text-navy-100">Current pace / month</div>
          <div className="mt-1 text-2xl font-bold text-navy-950 dark:text-white">
            {projection.currentMonthlyPace.toFixed(2)}s
          </div>
        </div>
        <div className="rounded-lg border border-navy-50 p-3 dark:border-white/10">
          <div className="text-xs text-navy-500 dark:text-navy-100">{formatDate(projection.targetDate)}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-bold text-navy-950 dark:text-white">
              {formatTime(projection.predictedAtGoalDate)}
            </span>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${likelihoodClasses[projection.likelihood]}`}>
              {projection.likelihood}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
