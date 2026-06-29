"use client";

import { Award, CalendarClock, Medal, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatTime } from "@/lib/utils";
import type { DashboardAnalytics, Goal, GymWorkout, SwimResult } from "@/types/swim";

interface AwardEntry {
  id: string;
  meet: string;
  medal: string;
  trophy?: string;
}

function badgeCatalog(analytics: DashboardAnalytics, swims: SwimResult[], workouts: GymWorkout[]) {
  const best50Free = swims.filter((swim) => swim.event === "50 Freestyle").sort((a, b) => a.timeSeconds - b.timeSeconds)[0];
  const best100Free = swims.filter((swim) => swim.event === "100 Freestyle").sort((a, b) => a.timeSeconds - b.timeSeconds)[0];
  const best100Fly = swims.filter((swim) => swim.event === "100 Butterfly").sort((a, b) => a.timeSeconds - b.timeSeconds)[0];

  return [
    { name: "First splash", detail: "Logged your first race.", active: swims.length >= 1 },
    { name: "Sub-30 breaker", detail: "50 Free under 30 seconds.", active: Boolean(best50Free && best50Free.timeSeconds < 30) },
    { name: "Minute hunter", detail: "100 Free under 1:00.", active: Boolean(best100Free && best100Free.timeSeconds < 60) },
    { name: "Fly engine", detail: "100 Fly under 1:05.", active: Boolean(best100Fly && best100Fly.timeSeconds < 65) },
    { name: "Century logger", detail: "100 swims entered.", active: swims.length >= 100 },
    { name: "Steady lane", detail: "Consistency above 85.", active: analytics.rankings.some((ranking) => ranking.consistencyScore >= 85) },
    { name: "Dryland disciplined", detail: "10 gym sessions logged.", active: workouts.length >= 10 },
    { name: "SPI climb", detail: "SPI reached 75+.", active: analytics.swimPowerIndex.score >= 75 }
  ];
}

function findMemory(swims: SwimResult[]) {
  const today = new Date();
  const targets = [
    { label: "Exactly one week ago", days: 7 },
    { label: "Exactly one month ago", days: 30 },
    { label: "Exactly one year ago", days: 365 }
  ];

  for (const target of targets) {
    const date = new Date(today);
    date.setDate(today.getDate() - target.days);
    const iso = date.toISOString().slice(0, 10);
    const swim = swims.find((result) => result.date === iso);
    if (swim) return { label: target.label, swim };
  }

  return undefined;
}

export function AthleteProfilePanel({
  analytics,
  goals,
  swims,
  workouts
}: {
  analytics: DashboardAnalytics;
  goals: Goal[];
  swims: SwimResult[];
  workouts: GymWorkout[];
}) {
  const [awards, setAwards] = useState<AwardEntry[]>([]);
  const [meet, setMeet] = useState("");
  const [medal, setMedal] = useState("");
  const [trophy, setTrophy] = useState("");
  const badges = useMemo(() => badgeCatalog(analytics, swims, workouts), [analytics, swims, workouts]);
  const memory = useMemo(() => findMemory(swims), [swims]);
  const activeBadges = badges.filter((badge) => badge.active).length;
  const totalDistanceSignal = swims.reduce((sum, swim) => sum + Number(swim.event.split(" ")[0] || 0), 0);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("swimsight-awards");
      if (saved) setAwards(JSON.parse(saved));
    } catch {
      setAwards([]);
    }
  }, []);

  function addAward() {
    if (!meet.trim() || !medal.trim()) return;
    const next = [{ id: crypto.randomUUID(), meet: meet.trim(), medal: medal.trim(), trophy: trophy.trim() || undefined }, ...awards].slice(0, 12);
    setAwards(next);
    window.localStorage.setItem("swimsight-awards", JSON.stringify(next));
    setMeet("");
    setMedal("");
    setTrophy("");
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="dashboard-glass p-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Profile</h2>
              <p className="mt-1 text-sm text-white/58">A compact athlete page for progress, badges, and memories.</p>
            </div>
            <span className="rounded-full border border-aqua-200/20 bg-aqua-300/10 px-3 py-1 font-mono text-xs text-aqua-100">SPI {analytics.swimPowerIndex.score}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <ProfileMetric label="Badges" value={`${activeBadges}/${badges.length}`} />
            <ProfileMetric label="Goals" value={goals.length.toString()} />
            <ProfileMetric label="Swims" value={swims.length.toString()} />
            <ProfileMetric label="Distance signal" value={`${totalDistanceSignal}m`} />
          </div>
          <div className="mt-5 rounded-lg border border-white/12 bg-white/[0.08] p-4">
            <div className="flex items-start gap-3">
              <CalendarClock aria-hidden className="mt-0.5 h-5 w-5 text-aqua-100" />
              <div>
                <h3 className="font-semibold text-white">On this day</h3>
                <p className="mt-1 text-sm leading-6 text-white/62">
                  {memory ? `${memory.label}: ${memory.swim.event} ${memory.swim.course} in ${formatTime(memory.swim.timeSeconds)}.` : "No exact week/month/year memory yet. Keep logging and this gets fun."}
                </p>
              </div>
            </div>
          </div>
        </article>

        <article className="dashboard-glass p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan">
              <Sparkles aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Rewards</h2>
              <p className="text-sm text-white/58">Unlocked by real entries.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {badges.map((badge) => (
              <div className={`rounded-lg border p-3 ${badge.active ? "border-stitch-cyan/45 bg-aqua-300/10" : "border-white/10 bg-white/[0.05] opacity-[0.62]"}`} key={badge.name}>
                <Trophy aria-hidden className={`h-5 w-5 ${badge.active ? "text-stitch-cyan" : "text-white/36"}`} />
                <h3 className="mt-3 text-sm font-semibold text-white">{badge.name}</h3>
                <p className="mt-1 text-xs leading-5 text-white/52">{badge.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="dashboard-glass p-5 text-white">
          <div className="flex items-center gap-3">
            <Medal aria-hidden className="h-5 w-5 text-stitch-cyan" />
            <h2 className="text-xl font-semibold">Awards</h2>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <input className="h-10 rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-stitch-cyan" placeholder="Meet name" value={meet} onChange={(event) => setMeet(event.target.value)} />
            <input className="h-10 rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-stitch-cyan" placeholder="Medal" value={medal} onChange={(event) => setMedal(event.target.value)} />
            <input className="h-10 rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-stitch-cyan" placeholder="Trophy optional" value={trophy} onChange={(event) => setTrophy(event.target.value)} />
          </div>
          <button className="mt-3 h-10 rounded-md bg-stitch-cyan px-4 text-sm font-semibold text-stitch-abyss transition hover:bg-white" type="button" onClick={addAward}>Add award</button>
          <div className="mt-4 space-y-2">
            {awards.length === 0 && <div className="rounded-md border border-dashed border-white/12 p-4 text-center text-sm text-white/58">No awards saved yet.</div>}
            {awards.map((award) => (
              <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.07] p-3" key={award.id}>
                <div><p className="font-semibold text-white">{award.meet}</p><p className="text-xs text-white/50">{award.medal}{award.trophy ? ` · ${award.trophy}` : ""}</p></div>
                <Award aria-hidden className="h-5 w-5 text-aqua-100" />
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-glass p-5 text-white">
          <h2 className="text-xl font-semibold">Year rewind</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <ProfileMetric label="Total races" value={swims.length.toString()} />
            <ProfileMetric label="PB count" value={analytics.personalBests.length.toString()} />
            <ProfileMetric label="Best event" value={analytics.overview.bestEvent ?? "None"} />
            <ProfileMetric label="Most improved" value={analytics.overview.mostImprovedEvent ?? "None"} />
          </div>
          <p className="mt-5 text-sm leading-6 text-white/58">
            End-of-year wrap is warming up. Once your season has more entries, this becomes a funny but useful recap of distance, PBs, strongest event, and training personality.
          </p>
        </article>
      </div>
    </section>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.07] p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/38">{label}</div>
      <div className="mt-1 truncate font-mono text-lg font-semibold text-stitch-cyan">{value}</div>
    </div>
  );
}
