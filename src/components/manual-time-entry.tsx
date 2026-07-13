"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Confetti } from "@/components/ui/confetti";
import { useTranslator } from "@/components/i18n/use-language";
import { supportedEvents } from "@/lib/events";
import { parseTimeInput } from "@/lib/utils";
import { KineticLoader } from "@/components/ui/kinetic-loader";
import type { Course, SwimEvent, SwimRaceType, SwimResult, SwimResultKind } from "@/types/swim";

const courses: Course[] = ["LCM", "SCM", "SCY"];

export function ManualTimeEntry({ swims = [] }: { swims?: SwimResult[] }) {
  const router = useRouter();
  const { t } = useTranslator();
  const [date, setDate] = useState("");
  const [event, setEvent] = useState<SwimEvent | "">("");
  const [course, setCourse] = useState<Course>("LCM");
  const [resultKind, setResultKind] = useState<SwimResultKind>("OFFICIAL");
  const [raceType, setRaceType] = useState<SwimRaceType>("INDIVIDUAL");
  const [time, setTime] = useState("");
  const [meetName, setMeetName] = useState("");
  const [status, setStatus] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submitTime() {
    const timeSeconds = parseTimeInput(time);

    if (!date || !event || !meetName.trim() || !Number.isFinite(timeSeconds) || timeSeconds <= 0) {
      setStatus(t("Complete every field with a valid result."));
      return;
    }

    setSaving(true);
    const payload = {
      date,
      event,
      course,
      timeSeconds,
      meetName,
      resultKind,
      raceType
    };
    const previousBest = swims
      .filter((swim) => swim.event === event && swim.course === course && (swim.resultKind ?? "OFFICIAL") === "OFFICIAL" && (swim.raceType ?? "INDIVIDUAL") === "INDIVIDUAL")
      .reduce<number | undefined>((best, swim) => (best === undefined || swim.timeSeconds < best ? swim.timeSeconds : best), undefined);
    const isPersonalBest = resultKind === "OFFICIAL" && raceType === "INDIVIDUAL" && (previousBest === undefined || timeSeconds < previousBest);

    try {
      const response = await fetch("/api/swims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (response.ok) {
        setStatus(t(isPersonalBest ? "Official personal best saved." : resultKind === "TRAINING" ? "Training time saved." : "Official meet time saved."));
        if (isPersonalBest) {
          setShowConfetti(true);
          window.setTimeout(() => setShowConfetti(false), 10_000);
        }
        setTime("");
        setMeetName("");
        router.refresh();
        return;
      }
      setStatus(result.error ? t(result.error) : t("Could not save result."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      {showConfetti && <Confetti autoFire count={180} />}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Add A Time")}</h2>
          <p className="text-sm text-white/70">{t("Official meet times drive PBs. Training times stay separate.")}</p>
        </div>
        <button
          className="ui-press inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stitch-cyan px-3 text-sm font-semibold text-stitch-abyss hover:bg-white disabled:cursor-wait disabled:opacity-70"
          disabled={saving}
          type="button"
          onClick={submitTime}
        >
          {saving ? <KineticLoader className="h-4 text-stitch-abyss" label={t("Saving time")} /> : <Save aria-hidden className="h-4 w-4" />}
          {saving ? t("Saving") : t("Save Time")}
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
            {t(label)}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <label className="text-sm font-medium text-white/80">
          {t("Date")}
          <input
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition focus:border-stitch-cyan"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={date}
            onChange={(changeEvent) => setDate(changeEvent.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-white/80">
          {t("Race context")}
          <select
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition focus:border-stitch-cyan"
            value={raceType}
            onChange={(changeEvent) => setRaceType(changeEvent.target.value as SwimRaceType)}
          >
            <option value="INDIVIDUAL">{t("Individual race")}</option>
            <option value="RELAY_SPLIT">{t("Relay split")}</option>
            <option value="TIME_TRIAL">{t("Time trial")}</option>
            <option value="CONVERTED">{t("Converted time")}</option>
          </select>
        </label>
        <label className="text-sm font-medium text-white/80">
          {t("Event")}
          <select
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition focus:border-stitch-cyan"
            value={event}
            onChange={(changeEvent) => setEvent(changeEvent.target.value as SwimEvent | "")}
          >
            <option value="">{t("Select event")}</option>
            {supportedEvents.map((swimEvent) => (
              <option key={swimEvent} value={swimEvent}>
                {t(swimEvent)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-white/80">
          {t("Course")}
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
          {t("Time")}
          <input
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder={t("e.g. 1:03.80")}
            value={time}
            onChange={(changeEvent) => setTime(changeEvent.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-white/80">
          {t("Meet")}
          <input
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
            placeholder={t(resultKind === "OFFICIAL" ? "Meet name" : "Training set / pool")}
            value={meetName}
            onChange={(changeEvent) => setMeetName(changeEvent.target.value)}
          />
        </label>
      </div>

      <p className="mt-3 text-sm text-white/72">{status}</p>
    </section>
  );
}
