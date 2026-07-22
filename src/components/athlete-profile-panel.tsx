"use client";

import { Activity, Award, CalendarClock, Medal, Sparkles, Target, Trophy, UserRound } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import { formatTime } from "@/lib/utils";
import type { DashboardAnalytics, Goal, GymWorkout, SwimResult } from "@/types/swim";

interface AwardEntry {
  id: string;
  meet: string;
  medal: string;
  trophy?: string;
}

function badgeCatalog(analytics: DashboardAnalytics, swims: SwimResult[], workouts: GymWorkout[]) {
  const officialSwims = swims.filter((swim) => (swim.resultKind ?? "OFFICIAL") === "OFFICIAL");
  const best50Free = officialSwims.filter((swim) => swim.event === "50 Freestyle").sort((a, b) => a.timeSeconds - b.timeSeconds)[0];
  const best100Free = officialSwims.filter((swim) => swim.event === "100 Freestyle").sort((a, b) => a.timeSeconds - b.timeSeconds)[0];
  const best100Fly = officialSwims.filter((swim) => swim.event === "100 Butterfly").sort((a, b) => a.timeSeconds - b.timeSeconds)[0];

  return [
    { name: "First official splash", detail: "Logged your first official meet result.", active: officialSwims.length >= 1 },
    { name: "Sub-30 breaker", detail: "50 Free under 30 seconds.", active: Boolean(best50Free && best50Free.timeSeconds < 30) },
    { name: "Minute hunter", detail: "100 Free under 1:00.", active: Boolean(best100Free && best100Free.timeSeconds < 60) },
    { name: "Fly engine", detail: "100 Fly under 1:05.", active: Boolean(best100Fly && best100Fly.timeSeconds < 65) },
    { name: "Century logger", detail: "100 official swims entered.", active: officialSwims.length >= 100 },
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
  athleteAge,
  athleteImageUrl,
  athleteName,
  goals,
  swims,
  workouts
}: {
  analytics: DashboardAnalytics;
  athleteAge?: number | null;
  athleteImageUrl?: string | null;
  athleteName: string;
  goals: Goal[];
  swims: SwimResult[];
  workouts: GymWorkout[];
}) {
  const { t } = useTranslator();
  const [awards, setAwards] = useState<AwardEntry[]>([]);
  const [meet, setMeet] = useState("");
  const [medal, setMedal] = useState("");
  const [trophy, setTrophy] = useState("");
  const badges = useMemo(() => badgeCatalog(analytics, swims, workouts), [analytics, swims, workouts]);
  const officialSwims = useMemo(() => swims.filter((swim) => (swim.resultKind ?? "OFFICIAL") === "OFFICIAL"), [swims]);
  const trainingSwims = swims.length - officialSwims.length;
  const officialMeetNames = useMemo(() => new Set(officialSwims.map((swim) => swim.meetName.toLowerCase())), [officialSwims]);
  const memory = useMemo(() => findMemory(officialSwims), [officialSwims]);
  const activeBadges = badges.filter((badge) => badge.active).length;
  const totalDistanceSignal = officialSwims.reduce((sum, swim) => sum + Number(swim.event.split(" ")[0] || 0), 0);
  const athleteInitials = athleteName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "SS";
  const strongestSwim = analytics.overview.bestEvent
    ? officialSwims.filter((swim) => swim.event === analytics.overview.bestEvent).sort((a, b) => a.timeSeconds - b.timeSeconds)[0]
    : undefined;
  const primaryGoal = goals[0];
  const [awardStatus, setAwardStatus] = useState("");

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
    if (!officialMeetNames.has(meet.trim().toLowerCase())) {
      setAwardStatus(t("Awards attach to official meet results only."));
      return;
    }
    const next = [{ id: crypto.randomUUID(), meet: meet.trim(), medal: medal.trim(), trophy: trophy.trim() || undefined }, ...awards].slice(0, 12);
    setAwards(next);
    window.localStorage.setItem("swimsight-awards", JSON.stringify(next));
    setMeet("");
    setMedal("");
    setTrophy("");
    setAwardStatus(t("Award saved."));
  }

  return (
    <section className="space-y-4">
      <article className="athlete-identity-card">
        <div aria-hidden className="athlete-identity-card__image" />
        <div aria-hidden className="athlete-identity-card__veil" />
        <div className="relative z-10 grid min-h-[30rem] gap-8 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:p-9">
          <div className="min-w-0 self-end">
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-black/20 px-3 py-1.5 text-xs font-semibold text-aqua-100 backdrop-blur-xl">
                <Activity aria-hidden className="h-4 w-4" />
                {t("Competitive swimmer profile")}
              </span>
              <span className="rounded-full border border-mint-300/22 bg-mint-300/12 px-3 py-1.5 font-mono text-xs font-semibold text-mint-100">{t("SPI")} {analytics.swimPowerIndex.score}</span>
            </div>
            <div className="mt-8 flex items-end gap-4">
              {athleteImageUrl ? (
                <Image alt={athleteName} className="h-16 w-16 shrink-0 rounded-full border-2 border-white/75 object-cover shadow-[0_12px_30px_rgba(0,0,0,0.26)] sm:h-20 sm:w-20" height={80} src={athleteImageUrl} unoptimized width={80} />
              ) : (
                <span aria-hidden className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/75 bg-stitch-cyan font-mono text-xl font-bold text-stitch-abyss shadow-[0_12px_30px_rgba(0,0,0,0.26)] sm:h-20 sm:w-20 sm:text-2xl">{athleteInitials}</span>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white/58">{athleteAge ? `${t("Age")} ${athleteAge}` : t("Athlete")}</p>
                <h2 className="mt-1 break-words text-4xl font-semibold leading-none text-white sm:text-6xl">{athleteName}</h2>
                <p className="mt-3 text-sm font-semibold text-aqua-100">{analytics.overview.bestEvent ? t(analytics.overview.bestEvent) : t("Build your strongest event")}</p>
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 divide-x divide-y divide-white/14 border-y border-white/14 sm:grid-cols-4 sm:divide-y-0">
              <AthleteHeroMetric label="Official races" value={officialSwims.length.toString()} />
              <AthleteHeroMetric label="PB events" value={analytics.personalBests.length.toString()} />
              <AthleteHeroMetric label="Official meters" value={`${totalDistanceSignal}m`} />
              <AthleteHeroMetric label="Badges" value={`${activeBadges}/${badges.length}`} />
            </div>
          </div>

          <div className="self-stretch border-t border-white/16 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
            <div className="flex h-full flex-col justify-end">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/48">{t("Season card")}</p>
              <div className="mt-5 divide-y divide-white/12 border-y border-white/12">
                <AthleteSignalRow icon={<Trophy className="h-4 w-4" />} label="Strongest result" value={strongestSwim ? `${t(strongestSwim.event)} · ${strongestSwim.course} · ${formatTime(strongestSwim.timeSeconds)}` : t("No official result yet")} />
                <AthleteSignalRow icon={<Target className="h-4 w-4" />} label="Primary goal" value={primaryGoal ? `${t(primaryGoal.event)} · ${primaryGoal.course} · ${formatTime(primaryGoal.targetTime)}` : t("No goal set")} />
                <AthleteSignalRow icon={<CalendarClock className="h-4 w-4" />} label="On this day" value={memory ? `${t(memory.label)} · ${t(memory.swim.event)} · ${formatTime(memory.swim.timeSeconds)}` : t("Keep logging to unlock season memories.")} />
                <AthleteSignalRow icon={<UserRound className="h-4 w-4" />} label="Training entries" value={trainingSwims.toString()} />
              </div>
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
            <h2 className="text-xl font-semibold">{t("Rewards")}</h2>
            <p className="text-sm text-white/58">{t("Unlocked by official meet results.")}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {badges.map((badge) => (
            <div className={`rounded-lg border p-3 ${badge.active ? "border-stitch-cyan/45 bg-aqua-300/10" : "border-white/10 bg-white/[0.05] opacity-[0.62]"}`} key={badge.name}>
              <Trophy aria-hidden className={`h-5 w-5 ${badge.active ? "text-stitch-cyan" : "text-white/36"}`} />
              <h3 className="mt-3 text-sm font-semibold text-white">{t(badge.name)}</h3>
              <p className="mt-1 text-xs leading-5 text-white/52">{t(badge.detail)}</p>
            </div>
          ))}
        </div>
      </article>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="dashboard-glass p-5 text-white">
          <div className="flex items-center gap-3">
            <Medal aria-hidden className="h-5 w-5 text-stitch-cyan" />
            <h2 className="text-xl font-semibold">{t("Awards")}</h2>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <input className="h-10 rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-stitch-cyan" placeholder={t("Meet name")} value={meet} onChange={(event) => setMeet(event.target.value)} />
            <input className="h-10 rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-stitch-cyan" placeholder={t("Medal")} value={medal} onChange={(event) => setMedal(event.target.value)} />
            <input className="h-10 rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-stitch-cyan" placeholder={t("Trophy optional")} value={trophy} onChange={(event) => setTrophy(event.target.value)} />
          </div>
          <button className="ui-press mt-3 h-10 rounded-md bg-stitch-cyan px-4 text-sm font-semibold text-stitch-abyss hover:bg-white" type="button" onClick={addAward}>{t("Add award")}</button>
          {awardStatus && <p className="mt-2 text-sm text-white/62">{awardStatus}</p>}
          <div className="mt-4 space-y-2">
            {awards.length === 0 && <div className="rounded-md border border-dashed border-white/12 p-4 text-center text-sm text-white/58">{t("No awards saved yet.")}</div>}
            {awards.map((award) => (
              <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.07] p-3" key={award.id}>
                <div><p className="font-semibold text-white">{award.meet}</p><p className="text-xs text-white/50">{award.medal}{award.trophy ? ` · ${award.trophy}` : ""}</p></div>
                <Award aria-hidden className="h-5 w-5 text-aqua-100" />
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-glass p-5 text-white">
          <h2 className="text-xl font-semibold">{t("Year rewind")}</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <ProfileMetric label="Total races" value={swims.length.toString()} />
            <ProfileMetric label="PB count" value={analytics.personalBests.length.toString()} />
            <ProfileMetric label="Best event" value={analytics.overview.bestEvent ? t(analytics.overview.bestEvent) : t("None")} />
            <ProfileMetric label="Most improved" value={analytics.overview.mostImprovedEvent ? t(analytics.overview.mostImprovedEvent) : t("None")} />
          </div>
          <p className="mt-5 text-sm leading-6 text-white/58">
            {t("End-of-year wrap is warming up. Once your season has more entries, this becomes a funny but useful recap of distance, PBs, strongest event, and training personality.")}
          </p>
        </article>
      </div>
    </section>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.07] p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/38">{t(label)}</div>
      <div className="mt-1 truncate font-mono text-lg font-semibold text-stitch-cyan">{value}</div>
    </div>
  );
}

function AthleteHeroMetric({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  return (
    <div className="min-w-0 px-3 py-4 first:pl-0 sm:px-4 sm:first:pl-0">
      <div className="truncate text-xs font-semibold text-white/50">{t(label)}</div>
      <div className="mt-1 truncate font-mono text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function AthleteSignalRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  const { t } = useTranslator();
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 py-4">
      <span aria-hidden className="mt-0.5 text-aqua-100">{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-white/48">{t(label)}</div>
        <div className="mt-1 break-words text-sm font-semibold leading-5 text-white">{value}</div>
      </div>
    </div>
  );
}
