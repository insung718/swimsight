"use client";

import { Save } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supportedEvents } from "@/lib/events";
import { parseTimeInput } from "@/lib/utils";
import { KineticLoader } from "@/components/ui/kinetic-loader";
import type { Course, SwimEvent, SwimResult, SwimResultKind } from "@/types/swim";

const courses: Course[] = ["LCM", "SCM", "SCY"];

export function ManualTimeEntry({ swims = [] }: { swims?: SwimResult[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [event, setEvent] = useState<SwimEvent | "">("");
  const [course, setCourse] = useState<Course>("LCM");
  const [resultKind, setResultKind] = useState<SwimResultKind>("OFFICIAL");
  const [time, setTime] = useState("");
  const [meetName, setMeetName] = useState("");
  const [status, setStatus] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submitTime() {
    const timeSeconds = parseTimeInput(time);

    if (!date || !event || !meetName.trim() || !Number.isFinite(timeSeconds) || timeSeconds <= 0) {
      setStatus("Complete every field with a valid result.");
      return;
    }

    setSaving(true);
    const payload = {
      date,
      event,
      course,
      timeSeconds,
      meetName,
      resultKind
    };
    const previousBest = swims
      .filter((swim) => swim.event === event && swim.course === course && (swim.resultKind ?? "OFFICIAL") === "OFFICIAL")
      .reduce<number | undefined>((best, swim) => (best === undefined || swim.timeSeconds < best ? swim.timeSeconds : best), undefined);
    const isPersonalBest = resultKind === "OFFICIAL" && (previousBest === undefined || timeSeconds < previousBest);

    try {
      const response = await fetch("/api/swims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (response.ok) {
        setStatus(isPersonalBest ? "Official personal best saved." : resultKind === "TRAINING" ? "Training time saved." : "Official meet time saved.");
        if (isPersonalBest) {
          setShowConfetti(true);
          window.setTimeout(() => setShowConfetti(false), 10_000);
        }
        setTime("");
        setMeetName("");
        router.refresh();
        return;
      }
      setStatus(result.error ?? "Could not save result.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      {showConfetti && <PbConfetti />}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Add A Time</h2>
          <p className="text-sm text-white/70">Official meet times drive PBs. Training times stay separate.</p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stitch-cyan px-3 text-sm font-semibold text-stitch-abyss transition hover:bg-white disabled:cursor-wait disabled:opacity-70"
          disabled={saving}
          type="button"
          onClick={submitTime}
        >
          {saving ? <KineticLoader className="h-4 text-stitch-abyss" label="Saving time" /> : <Save aria-hidden className="h-4 w-4" />}
          {saving ? "Saving" : "Save Time"}
        </button>
      </div>

      <div className="mb-4 inline-flex rounded-md border border-white/10 bg-stitch-abyss p-1">
        {[
          ["OFFICIAL", "Official meet"],
          ["TRAINING", "Training / unofficial"]
        ].map(([value, label]) => (
          <button
            className={`h-9 rounded px-3 text-xs font-semibold transition ${resultKind === value ? "bg-stitch-cyan text-stitch-abyss" : "text-white/64 hover:text-white"}`}
            key={value}
            type="button"
            onClick={() => setResultKind(value as SwimResultKind)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-medium text-white/80">
          Date
          <input
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition focus:border-stitch-cyan"
            type="date"
            value={date}
            onChange={(changeEvent) => setDate(changeEvent.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-white/80">
          Event
          <select
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition focus:border-stitch-cyan"
            value={event}
            onChange={(changeEvent) => setEvent(changeEvent.target.value as SwimEvent | "")}
          >
            <option value="">Select event</option>
            {supportedEvents.map((swimEvent) => (
              <option key={swimEvent} value={swimEvent}>
                {swimEvent}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-white/80">
          Course
          <select
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition focus:border-stitch-cyan"
            value={course}
            onChange={(changeEvent) => setCourse(changeEvent.target.value as Course)}
          >
            {courses.map((courseValue) => (
              <option key={courseValue} value={courseValue}>
                {courseValue}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-white/80">
          Time
          <input
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder="e.g. 1:03.80"
            value={time}
            onChange={(changeEvent) => setTime(changeEvent.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-white/80">
          Meet
          <input
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder={resultKind === "OFFICIAL" ? "Meet name" : "Training set / pool"}
            value={meetName}
            onChange={(changeEvent) => setMeetName(changeEvent.target.value)}
          />
        </label>
      </div>

      <p className="mt-3 text-sm text-white/72">{status}</p>
    </section>
  );
}

function PbConfetti() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {Array.from({ length: 96 }, (_, index) => (
        <span
          className="pb-confetti-piece"
          key={index}
          style={{
            "--confetti-color": ["#ff3b30", "#ff9500", "#ffd60a", "#34c759", "#32ade6", "#5856d6", "#ff2d55", "#ffffff"][index % 8],
            "--confetti-delay": `${(index % 16) * 55}ms`,
            "--confetti-left": `${(index * 17) % 100}%`,
            "--confetti-rotate": `${(index % 11) * 31}deg`,
            "--confetti-size": `${10 + (index % 5) * 3}px`
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
