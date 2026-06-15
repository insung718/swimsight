"use client";

import { CalendarPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supportedEvents } from "@/lib/events";
import type { SwimEvent, UpcomingMeet } from "@/types/swim";

export function UpcomingMeetPanel() {
  const defaultDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  }, []);
  const [meets, setMeets] = useState<UpcomingMeet[]>([]);
  const [name, setName] = useState("Next championship meet");
  const [startDate, setStartDate] = useState(defaultDate);
  const [targetEvent, setTargetEvent] = useState<SwimEvent>("100 Butterfly");
  const [status, setStatus] = useState("Loading countdown.");

  useEffect(() => {
    fetch("/api/meets")
      .then((response) => response.json())
      .then((data) => {
        setMeets(data.meets ?? []);
        setStatus(data.mode === "account" ? "Synced to your account." : "Demo countdown active.");
      })
      .catch(() => setStatus("Could not load meets."));
  }, []);

  async function addMeet() {
    const payload = {
      name,
      startDate,
      targetEvents: [targetEvent]
    };
    const response = await fetch("/api/meets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (response.ok) {
      setMeets((current) => [result.meet, ...current]);
      setStatus("Meet saved to your account.");
      return;
    }

    const meetDate = new Date(startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    meetDate.setHours(0, 0, 0, 0);
    setMeets((current) => [
      {
        id: `draft-meet-${Date.now()}`,
        userId: "draft",
        name,
        startDate,
        targetEvents: [targetEvent],
        daysUntil: Math.ceil((meetDate.getTime() - today.getTime()) / 86_400_000)
      },
      ...current
    ]);
    setStatus(`${result.error ?? "Draft created locally."} Draft shown below.`);
  }

  return (
    <section className="min-w-0 rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04] lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-aqua-50 text-aqua-600 dark:bg-aqua-400/10 dark:text-aqua-100">
          <CalendarPlus aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Upcoming Meet</h2>
          <p className="text-sm text-navy-500 dark:text-navy-100">Countdown and target event</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
        <input
          className="h-10 rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="h-10 rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
          type="date"
          value={startDate}
          onChange={(event) => setStartDate(event.target.value)}
        />
        <select
          className="h-10 rounded-md border border-navy-100 bg-white px-3 text-sm text-navy-950 outline-none focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white sm:col-span-2"
          value={targetEvent}
          onChange={(event) => setTargetEvent(event.target.value as SwimEvent)}
        >
          {supportedEvents.map((swimEvent) => (
            <option key={swimEvent} value={swimEvent}>
              {swimEvent}
            </option>
          ))}
        </select>
        <button
          className="inline-flex h-10 items-center justify-center rounded-md bg-navy-900 px-3 text-sm font-semibold text-white transition hover:bg-navy-700 dark:bg-aqua-400 dark:text-navy-950 sm:col-span-2"
          type="button"
          onClick={addMeet}
        >
          Add Meet
        </button>
      </div>

      <p className="mt-3 text-sm text-navy-500 dark:text-navy-100">{status}</p>
      <div className="mt-3 space-y-2">
        {meets.slice(0, 3).map((meet) => (
          <div className="rounded-lg bg-navy-50 p-3 dark:bg-white/[0.08]" key={meet.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-navy-950 dark:text-white">{meet.name}</div>
                <div className="mt-1 text-sm text-navy-500 dark:text-navy-100">
                  {meet.targetEvents.join(", ")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-aqua-600 dark:text-aqua-100">
                  {Math.max(meet.daysUntil, 0)}
                </div>
                <div className="text-xs text-navy-500 dark:text-navy-100">days</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
