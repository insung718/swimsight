"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BarChart3, Building2, Copy, LayoutDashboard, Plus, ShieldCheck, TrendingUp, UsersRound, Waves } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserActions } from "@/components/auth/user-actions";
import { useTranslator } from "@/components/i18n/use-language";
import { LanguageToggle } from "@/components/landing/language-toggle";
import { Counter } from "@/components/ui/counter";
import { Dock } from "@/components/ui/dock";
import { FlipText } from "@/components/ui/flip-text";
import { KineticLoader } from "@/components/ui/kinetic-loader";
import { formatTime } from "@/lib/utils";
import type { CoachClubSummary, CoachDashboardData, CoachSwimmerAnalytics, Course, SwimEvent } from "@/types/swim";

type CoachTab = "overview" | "clubs" | "athletes" | "reports";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "clubs", label: "Clubs", icon: Building2 },
  { id: "athletes", label: "Athletes", icon: UsersRound },
  { id: "reports", label: "Reports", icon: BarChart3 }
] as const;

export function CoachDashboard({ dashboard }: { dashboard: CoachDashboardData }) {
  const { t } = useTranslator();
  const [activeTab, setActiveTab] = useState<CoachTab>("overview");
  const allSwimmers = useMemo(
    () => Array.from(new Map(dashboard.clubs.flatMap((club) => club.swimmers).map((swimmer) => [swimmer.id, swimmer])).values()),
    [dashboard.clubs]
  );
  const spotlight = dashboard.overview.topImprover ?? allSwimmers[0];

  return (
    <main className="dark dashboard-shell min-h-screen text-stitch-text">
      <header className="sticky top-0 z-40 border-b border-white/45 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <button className="flex items-center gap-3 text-left transition hover:opacity-80" type="button" onClick={() => setActiveTab("overview")}>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow">
              <Waves aria-hidden className="h-5 w-5" />
            </span>
            <span>
              <div className="font-semibold text-stitch-abyss">{t("SwimSight Coach")}</div>
              <div className="text-xs text-stitch-abyss/55">{t("Team performance workspace")}</div>
            </span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <UserActions />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-32 pt-7 sm:px-6 lg:px-8">
        <section className="dashboard-hero dashboard-enter mb-6 overflow-hidden rounded-lg border border-white/65 p-4 text-stitch-abyss shadow-stitch sm:p-6 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-aqua-600">{t("Coach command center")}</p>
              <h1 className="mt-2 text-balance text-3xl font-semibold tracking-normal sm:text-5xl">
                {t("Every swimmer, club, goal, and trend in one calm view.")}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-stitch-abyss/64 sm:text-base">
                {t("Create clubs, add swimmers, and see the development signal behind every athlete without losing the premium SwimSight feel.")}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <QuickAction label="Create club" onClick={() => setActiveTab("clubs")} />
                <QuickAction label="Review athletes" onClick={() => setActiveTab("athletes")} secondary />
              </div>
            </div>
            <CoachSpotlight swimmer={spotlight} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <MiniStat label="Clubs" value={dashboard.overview.clubCount.toString()} />
            <MiniStat label="Swimmers" value={dashboard.overview.swimmerCount.toString()} />
            <MiniStat label="Logged swims" value={dashboard.overview.totalSwims.toString()} />
            <MiniStat label="Avg SPI" value={dashboard.overview.averageSpi.toString()} />
          </div>
        </section>

        {activeTab === "overview" && (
          <DashboardPanel>
            <SectionHeading eyebrow="Team pulse" title="Coach overview" />
            {dashboard.clubs.length === 0 ? (
              <EmptyCoachState onCreate={() => setActiveTab("clubs")} />
            ) : (
              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <ClubGrid clubs={dashboard.clubs} />
                <DevelopmentPanel swimmers={allSwimmers} />
              </div>
            )}
          </DashboardPanel>
        )}

        {activeTab === "clubs" && (
          <DashboardPanel>
            <SectionHeading eyebrow="Club builder" title="Clubs" />
            <ClubManager clubs={dashboard.clubs} />
          </DashboardPanel>
        )}

        {activeTab === "athletes" && (
          <DashboardPanel>
            <SectionHeading eyebrow="Roster intelligence" title="Athletes" />
            <SwimmerRankingBoard swimmers={allSwimmers} />
            <AthleteRoster swimmers={allSwimmers} />
          </DashboardPanel>
        )}

        {activeTab === "reports" && (
          <DashboardPanel>
            <SectionHeading eyebrow="Development reports" title="Reports" />
            <DevelopmentPanel swimmers={allSwimmers} expanded />
            <SwimmerRankingBoard swimmers={allSwimmers} />
          </DashboardPanel>
        )}
      </div>

      <Dock
        items={tabs.map(({ id, label, icon: Icon }) => ({
          active: activeTab === id,
          icon: <Icon aria-hidden className="h-5 w-5" />,
          label,
          onClick: () => setActiveTab(id)
        }))}
      />
    </main>
  );
}

function DashboardPanel({ children }: { children: ReactNode }) {
  return (
    <motion.div animate={{ opacity: 1, y: 0 }} className="space-y-5" initial={{ opacity: 0, y: 16 }} transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { t } = useTranslator();
  const translatedTitle = t(title);

  return <div><p className="text-sm font-semibold text-stitch-abyss/58">{t(eyebrow)}</p><h2 className="mt-1 text-2xl font-semibold tracking-normal text-stitch-abyss sm:text-4xl"><FlipText key={translatedTitle}>{translatedTitle}</FlipText></h2></div>;
}

function QuickAction({ label, onClick, secondary = false }: { label: string; onClick: () => void; secondary?: boolean }) {
  const { t } = useTranslator();

  return (
    <button className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${secondary ? "border border-stitch-abyss/15 bg-white/45 text-stitch-abyss hover:bg-white" : "bg-stitch-abyss text-white shadow-[0_16px_40px_rgba(4,17,29,0.18)] hover:bg-[#10243a]"}`} type="button" onClick={onClick}>
      {t(label)}
      <TrendingUp aria-hidden className="h-4 w-4" />
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  const numericValue = Number(value);
  const shouldCount = Number.isInteger(numericValue) && /^\d+$/.test(value);

  return (
    <div className="min-w-0 rounded-lg border border-white/60 bg-white/45 p-3 backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:bg-white/58 sm:p-4">
      <div className="truncate text-[0.68rem] font-semibold uppercase text-stitch-abyss/48 sm:text-xs">{t(label)}</div>
      <div className="mt-1 font-mono text-2xl font-semibold text-stitch-abyss sm:text-3xl">
        {shouldCount ? (
          <Counter fontSize={30} fontWeight={700} gradientFrom="rgba(255,255,255,0.64)" value={numericValue} />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function CoachSpotlight({ swimmer }: { swimmer?: CoachSwimmerAnalytics }) {
  const { t } = useTranslator();

  return (
    <motion.article animate={{ opacity: 1, scale: 1 }} className="rounded-lg border border-white/70 bg-white/58 p-4 shadow-[0_24px_90px_rgba(4,17,29,0.10)] backdrop-blur-2xl" initial={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan">
            <UsersRound aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{t("Development spotlight")}</p>
            <p className="text-xs text-stitch-abyss/55">{swimmer ? `${swimmer.yearlyImprovement}% ${t("yearly improvement")}` : t("Waiting for your first swimmer")}</p>
          </div>
        </div>
        {swimmer && <span className="rounded-full bg-stitch-abyss px-3 py-1 font-mono text-xs font-semibold text-stitch-cyan">{t("SPI")} {swimmer.swimPowerIndex}</span>}
      </div>

      {swimmer ? (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <CoachMini label="Athlete" value={swimmer.name} />
          <CoachMini label="Swims" value={swimmer.totalSwims.toString()} />
          <CoachMini label="Goals" value={swimmer.activeGoals.toString()} />
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-stitch-abyss/15 bg-white/45 p-4 text-sm leading-6 text-stitch-abyss/64">
          {t("Create a club and add swimmers to unlock coach analytics.")}
        </div>
      )}
    </motion.article>
  );
}

function CoachMini({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();

  return <div className="min-w-0 rounded-md border border-white/60 bg-white/54 p-3"><div className="text-xs font-semibold uppercase text-stitch-abyss/46">{t(label)}</div><div className="mt-1 truncate font-mono text-base font-semibold text-stitch-abyss">{value}</div></div>;
}

function EmptyCoachState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslator();

  return (
    <section className="dashboard-glass flex min-h-[420px] items-center justify-center px-6 text-center">
      <div className="max-w-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stitch-abyss text-stitch-cyan shadow-glow"><Building2 aria-hidden className="h-6 w-6" /></div>
        <h2 className="mt-6 text-3xl font-semibold text-white">{t("Your coach workspace is ready.")}</h2>
        <p className="mt-4 leading-7 text-white/78">{t("Create your first swim club, share its join code, and swimmers can connect from their Community tab.")}</p>
        <button className="mt-7 h-11 rounded-full bg-white px-6 text-sm font-semibold text-stitch-abyss transition hover:bg-stitch-cyan" type="button" onClick={onCreate}>{t("Create a club")}</button>
      </div>
    </section>
  );
}

function ClubGrid({ clubs }: { clubs: CoachClubSummary[] }) {
  const { t } = useTranslator();

  return (
    <section className="dashboard-glass p-5">
      <h2 className="text-lg font-semibold text-white">{t("Active clubs")}</h2>
      <div className="mt-4 grid gap-3">
        {clubs.slice(0, 4).map((club) => (
          <div className="rounded-lg border border-white/12 bg-white/[0.08] p-4" key={club.id}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-white">{club.name}</div>
                <div className="mt-1 text-sm text-white/62">{club.memberCount} {t("swimmers")}</div>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs text-aqua-100">{club.joinCode}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClubManager({ clubs }: { clubs: CoachClubSummary[] }) {
  const { t } = useTranslator();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function createClub() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/coach/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined })
      });
      const result = await response.json();
      setStatus(response.ok ? t("Club created.") : result.error ? t(result.error) : t("Could not create club."));
      if (response.ok) {
        setName("");
        setDescription("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-glass p-5">
      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-white/12 bg-white/[0.08] p-4">
          <h2 className="text-lg font-semibold text-white">{t("Create club")}</h2>
          <input className="mt-4 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-stitch-cyan" placeholder={t("Club name")} value={name} onChange={(event) => setName(event.target.value)} />
          <textarea className="mt-3 min-h-24 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-stitch-cyan" placeholder={t("Optional description")} value={description} onChange={(event) => setDescription(event.target.value)} />
          <button className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-stitch-cyan px-4 text-sm font-semibold text-stitch-abyss transition hover:bg-white disabled:cursor-wait disabled:opacity-70" disabled={saving} type="button" onClick={createClub}>
            {saving ? <KineticLoader className="h-4 text-stitch-abyss" label={t("Creating club")} /> : <Plus aria-hidden className="h-4 w-4" />}
            {saving ? t("Creating") : t("Create club")}
          </button>
          {status && <p className="mt-3 text-sm text-white/72">{status}</p>}
        </div>
        <div className="space-y-3">
          {clubs.length === 0 && <div className="rounded-lg border border-dashed border-white/12 p-6 text-center text-sm text-white/72">{t("No clubs yet.")}</div>}
          {clubs.map((club) => (
            <div className="rounded-lg border border-white/12 bg-white/[0.08] p-4" key={club.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-white">{club.name}</div>
                  <div className="mt-1 text-sm text-white/58">{club.memberCount} {t("swimmers")} · {t("share code")} {club.joinCode}</div>
                </div>
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white transition hover:border-stitch-cyan"
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(club.joinCode);
                    setStatus(t("Club code copied. Swimmers can join from their Community tab."));
                  }}
                >
                  <Copy aria-hidden className="h-4 w-4" />
                  {t("Copy code")}
                </button>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-md border border-aqua-200/15 bg-aqua-300/10 p-3 text-sm leading-6 text-white/68">
                <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-aqua-100" />
                {t("Swimmers must join with this code before their times and goals appear here.")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AthleteRoster({ swimmers }: { swimmers: CoachSwimmerAnalytics[] }) {
  const { t } = useTranslator();

  return (
    <section className="dashboard-glass min-w-0 overflow-hidden p-5">
      {swimmers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/12 p-6 text-center text-sm text-white/72">{t("Add swimmers to a club to see roster analytics.")}</div>
      ) : (
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/15 text-xs uppercase text-white/58">
                <th className="py-3 pr-3 font-semibold">{t("Swimmer")}</th>
                <th className="px-3 py-3 font-semibold">{t("Strongest")}</th>
                <th className="px-3 py-3 font-semibold">{t("SPI")}</th>
                <th className="px-3 py-3 font-semibold">{t("Consistency")}</th>
                <th className="px-3 py-3 font-semibold">{t("Yearly")}</th>
                <th className="py-3 pl-3 font-semibold">{t("Latest")}</th>
              </tr>
            </thead>
            <tbody>
              {swimmers.map((swimmer) => (
                <tr className="border-b border-white/10 last:border-0" key={swimmer.id}>
                  <td className="py-3 pr-3"><div className="font-semibold text-white">{swimmer.name}</div><div className="text-xs text-white/54">{t("Joined")} {new Date(swimmer.joinedAt).toLocaleDateString()}</div></td>
                  <td className="px-3 py-3 text-white/72">{swimmer.strongestEvent ?? t("No event yet")}</td>
                  <td className="px-3 py-3 font-mono font-semibold text-stitch-cyan">{swimmer.swimPowerIndex}</td>
                  <td className="px-3 py-3 text-white/72">{Math.round(swimmer.consistencyScore)}</td>
                  <td className="px-3 py-3 text-mint-200">{swimmer.yearlyImprovement}%</td>
                  <td className="py-3 pl-3 text-white/72">{swimmer.latestResult ? `${swimmer.latestResult.event} ${swimmer.latestResult.course} · ${formatTime(swimmer.latestResult.timeSeconds)}` : t("No result")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SwimmerRankingBoard({ swimmers }: { swimmers: CoachSwimmerAnalytics[] }) {
  const { t } = useTranslator();
  const ranked = [...swimmers].sort((a, b) => b.swimPowerIndex - a.swimPowerIndex || b.yearlyImprovement - a.yearlyImprovement);

  return (
    <section className="dashboard-glass p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Swimmer ranking")}</h2>
          <p className="mt-1 text-sm text-white/64">{t("Ranked by SPI first, then yearly improvement. Use this as a coaching signal, not a public ego board.")}</p>
        </div>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs text-aqua-100">{ranked.length} {t("swimmers")}</span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {ranked.slice(0, 6).map((swimmer, index) => (
          <article className="rounded-lg border border-white/12 bg-white/[0.08] p-4 transition duration-300 hover:-translate-y-1 hover:border-stitch-cyan/45" key={swimmer.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold text-aqua-100">#{index + 1}</p>
                <h3 className="mt-2 font-semibold text-white">{swimmer.name}</h3>
                <p className="mt-1 text-sm text-white/58">{swimmer.strongestEvent ?? t("No strongest event yet")}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-semibold text-stitch-cyan">{swimmer.swimPowerIndex}</div>
                <div className="text-xs text-white/48">{t("SPI")}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-white/[0.08] p-2"><span className="block text-white/44">{t("Yearly")}</span><strong className="font-mono text-mint-200">{swimmer.yearlyImprovement}%</strong></div>
              <div className="rounded-md bg-white/[0.08] p-2"><span className="block text-white/44">{t("Swims")}</span><strong className="font-mono text-white">{swimmer.totalSwims}</strong></div>
            </div>
          </article>
        ))}
        {!ranked.length && <div className="rounded-lg border border-dashed border-white/12 p-6 text-center text-sm text-white/72 lg:col-span-3">{t("Swimmer rankings appear after athletes join and log results.")}</div>}
      </div>
    </section>
  );
}

function DevelopmentPanel({ swimmers, expanded = false }: { swimmers: CoachSwimmerAnalytics[]; expanded?: boolean }) {
  const { t } = useTranslator();
  const defaultSwimmer = useMemo(() => [...swimmers].sort((a, b) => b.progression.length - a.progression.length)[0], [swimmers]);
  const [selectedSwimmerId, setSelectedSwimmerId] = useState(defaultSwimmer?.id ?? "all");
  const [selectedEvent, setSelectedEvent] = useState<SwimEvent | "all">("all");
  const [selectedCourse, setSelectedCourse] = useState<Course | "all">("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const selected = swimmers.find((swimmer) => swimmer.id === selectedSwimmerId) ?? defaultSwimmer;
  const progression = selected?.progression ?? [];
  const eventOptions = useMemo(() => Array.from(new Set(progression.map((point) => point.event))).sort(), [progression]);
  const courseOptions = useMemo(() => Array.from(new Set(progression.map((point) => point.course))).sort(), [progression]);
  const yearOptions = useMemo(() => Array.from(new Set(progression.map((point) => point.date.slice(0, 4)))).sort().reverse(), [progression]);
  const filtered = progression.filter((point) => {
    const year = point.date.slice(0, 4);
    return (selectedEvent === "all" || point.event === selectedEvent) && (selectedCourse === "all" || point.course === selectedCourse) && (selectedYear === "all" || year === selectedYear);
  });
  const data = filtered.map((point) => ({ ...point, label: point.date.slice(5) }));

  return (
    <section className="dashboard-glass min-w-0 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Development graph")}</h2>
          <p className="mt-1 text-sm text-white/64">{selected ? `${selected.name} · ${t("filtered logged results")}` : t("Add swimmers with results to populate this graph.")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <CoachSelect label="Swimmer" value={selectedSwimmerId} onChange={setSelectedSwimmerId}>
            <option value="all">{t("Most active")}</option>
            {swimmers.map((swimmer) => <option key={swimmer.id} value={swimmer.id}>{swimmer.name}</option>)}
          </CoachSelect>
          <CoachSelect label="Event" value={selectedEvent} onChange={(value) => setSelectedEvent(value as SwimEvent | "all")}>
            <option value="all">{t("All events")}</option>
            {eventOptions.map((event) => <option key={event} value={event}>{event}</option>)}
          </CoachSelect>
          <CoachSelect label="Course" value={selectedCourse} onChange={(value) => setSelectedCourse(value as Course | "all")}>
            <option value="all">{t("All courses")}</option>
            {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
          </CoachSelect>
          <CoachSelect label="Year" value={selectedYear} onChange={setSelectedYear}>
            <option value="all">{t("All years")}</option>
            {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </CoachSelect>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs text-aqua-100">{data.length} {t("points")}</span>
      </div>
      <div className={`${expanded ? "h-[460px]" : "h-[320px]"} mt-5`}>
        {data.length > 1 ? (
          <ResponsiveContainer height="100%" width="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="coachDevelopment" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#4ee8ff" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#4ee8ff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" tickLine={false} />
              <YAxis domain={["dataMin - 1", "dataMax + 1"]} stroke="rgba(255,255,255,0.45)" tickFormatter={(value) => formatTime(Number(value))} tickLine={false} />
              <Tooltip formatter={(value) => formatTime(Number(value))} labelStyle={{ color: "#04111d" }} />
              <Area dataKey="timeSeconds" fill="url(#coachDevelopment)" stroke="#4ee8ff" strokeWidth={3} type="monotone" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/[0.05] px-4 text-center text-sm text-white/72">{t("Need at least two results from one swimmer.")}</div>
        )}
      </div>
    </section>
  );
}

function CoachSelect({
  children,
  label,
  onChange,
  value
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const { t } = useTranslator();

  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/44">{t(label)}</span>
      <select
        className="h-10 w-full rounded-md border border-white/12 bg-stitch-abyss px-3 text-sm text-white outline-none transition focus:border-stitch-cyan"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}
