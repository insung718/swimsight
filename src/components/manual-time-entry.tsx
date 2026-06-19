"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supportedEvents } from "@/lib/events";
import { parseTimeInput } from "@/lib/utils";
import type { Course, SwimEvent } from "@/types/swim";

const courses: Course[] = ["LCM", "SCM", "SCY"];

export function ManualTimeEntry() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [event, setEvent] = useState<SwimEvent | "">("");
  const [course, setCourse] = useState<Course>("LCM");
  const [time, setTime] = useState("");
  const [meetName, setMeetName] = useState("");
  const [status, setStatus] = useState("");

  async function submitTime() {
    const timeSeconds = parseTimeInput(time);

    if (!date || !event || !meetName.trim() || !Number.isFinite(timeSeconds) || timeSeconds <= 0) {
      setStatus("Complete every field with a valid result.");
      return;
    }

    const payload = {
      date,
      event,
      course,
      timeSeconds,
      meetName
    };
    const response = await fetch("/api/swims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (response.ok) {
      setStatus("Saved to your SwimSight account.");
      setTime("");
      setMeetName("");
      router.refresh();
      return;
    }
    setStatus(result.error ?? "Could not save result.");
  }

  return (
    <section className="min-w-0 rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04] lg:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Add A Time</h2>
          <p className="text-sm text-navy-500 dark:text-navy-100">Manual entry stays beside CSV import</p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-navy-900 px-3 text-sm font-semibold text-white transition hover:bg-navy-700 dark:bg-aqua-400 dark:text-navy-950"
          type="button"
          onClick={submitTime}
        >
          <Save aria-hidden className="h-4 w-4" />
          Save Time
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm font-medium text-navy-700 dark:text-navy-100">
          Date
          <input
            className="mt-1 h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
            type="date"
            value={date}
            onChange={(changeEvent) => setDate(changeEvent.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-navy-700 dark:text-navy-100">
          Event
          <select
            className="mt-1 h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
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
        <label className="text-sm font-medium text-navy-700 dark:text-navy-100">
          Course
          <select
            className="mt-1 h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
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
        <label className="text-sm font-medium text-navy-700 dark:text-navy-100">
          Time
          <input
            className="mt-1 h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
            placeholder="e.g. 1:03.80"
            value={time}
            onChange={(changeEvent) => setTime(changeEvent.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-navy-700 dark:text-navy-100">
          Meet
          <input
            className="mt-1 h-10 w-full rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
            placeholder="Meet name"
            value={meetName}
            onChange={(changeEvent) => setMeetName(changeEvent.target.value)}
          />
        </label>
      </div>

      <p className="mt-3 text-sm text-navy-500 dark:text-navy-100">{status}</p>
    </section>
  );
}
