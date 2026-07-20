"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, Building2, Copy, LayoutDashboard, Plus, ShieldCheck, TrendingUp, UsersRound, Waves } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { UserActions } from "@/components/auth/user-actions";
import { CoachOperationsPanel } from "@/components/coach-operations-panel";
import { CoachRosterImport } from "@/components/coach-roster-import";
import { DashboardViewToggle } from "@/components/dashboard-view-toggle";
import { useTranslator } from "@/components/i18n/use-language";
import { LanguageToggle } from "@/components/landing/language-toggle";
import { Counter } from "@/components/ui/counter";
import { DashboardOptionWheel } from "@/components/ui/dashboard-option-wheel";
import { KineticLoader } from "@/components/ui/kinetic-loader";
import type { DashboardViewMode } from "@/lib/dashboard-view-mode";
import { formatDate, formatShortDate, formatTime } from "@/lib/utils";
import type { CoachClubSummary, CoachDashboardData, CoachSwimmerAnalytics, Course, SwimEvent } from "@/types/swim";

type CoachTab = "overview" | "clubs" | "athletes" | "reports";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "clubs", label: "Clubs", icon: Building2 },
  { id: "athletes", label: "Athletes", icon: UsersRound },
  { id: "reports", label: "Reports", icon: BarChart3 }
] as const;

export function CoachDashboard({ dashboard, viewMode }: { dashboard: CoachDashboardData; viewMode: DashboardViewMode }) {
  const { t } = useTranslator();
  const [activeTab, setActiveTab] = useState<CoachTab>("overview");
  const allSwimmers = useMemo(
    () => Array.from(new Map(dashboard.clubs.flatMap((club) => club.swimmers).map((swimmer) => [swimmer.id, swimmer])).values()),
    [dashboard.clubs]
  );
  const spotlight = dashboard.overview.topImprover ?? allSwimmers[0];

  return (
    <main className="dark dashboard-shell min-h-screen w-full overflow-x-clip text-stitch-text">
      <header className="dashboard-topbar sticky top-0 z-40">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-3 py-2 sm:min-h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-0 lg:px-8">
          <button className="ui-press flex min-w-0 items-center gap-3 rounded-lg text-left hover:opacity-80" type="button" onClick={() => setActiveTab("overview")}>
            <span className="dashboard-brand-mark inline-flex h-9 w-9 items-center justify-center rounded-md text-stitch-cyan">
              <Waves aria-hidden className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <div className="truncate font-semibold text-stitch-abyss">{t("SwimSight Coach")}</div>
              <div className="truncate text-xs text-stitch-abyss/55 max-[420px]:hidden">{t("Team performance workspace")}</div>
            </span>
          </button>
          <div className="flex w-full min-w-0 items-center justify-between gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
            <DashboardViewToggle mode={viewMode} />
            <LanguageToggle compact />
            <UserActions compact />
          </div>
        </div>
      </header>

      <div className="dashboard-content mx-auto w-full max-w-[1440px] min-w-0 px-3 pb-24 pt-5 sm:px-6 sm:pb-28 sm:pt-7 lg:px-8">
        {activeTab === "overview" && <section className="dashboard-hero dashboard-enter mb-5 overflow-hidden rounded-lg border border-white/65 p-4 text-stitch-abyss sm:p-6 lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div className="max-w-3xl">
              <h1 className="text-balance text-3xl font-semibold tracking-normal sm:text-5xl">
                {t("Every swimmer, club, goal, and trend in one calm view.")}
              </h1>
              <div className="mt-5 flex flex-wrap gap-2">
                <QuickAction label="Create club" onClick={() => setActiveTab("clubs")} />
                <QuickAction label="Review athletes" onClick={() => setActiveTab("athletes")} secondary />
              </div>
            </div>
            <CoachSpotlight swimmer={spotlight} />
          </div>
          <div className="mt-6 grid grid-cols-2 divide-x divide-y divide-stitch-abyss/10 border-t border-stitch-abyss/10 pt-2 sm:grid-cols-4 sm:divide-y-0">
            <MiniStat label="Clubs" value={dashboard.overview.clubCount.toString()} />
            <MiniStat label="Swimmers" value={dashboard.overview.swimmerCount.toString()} />
            <MiniStat label="Logged swims" value={dashboard.overview.totalSwims.toString()} />
            <MiniStat label="Avg SPI" value={dashboard.overview.averageSpi.toString()} />
          </div>
        </section>}

        {activeTab === "overview" && (
          <DashboardPanel>
            {dashboard.clubs.length === 0 ? (
              <EmptyCoachState onCreate={() => setActiveTab("clubs")} />
            ) : (
              <div className="grid items-start gap-5 xl:grid-cols-[0.82fr_1.18fr]">
                <div className="grid gap-5">
                  <ClubGrid clubs={dashboard.clubs} />
                  <CoachPulse swimmers={allSwimmers} />
                </div>
                <DevelopmentPanel swimmers={allSwimmers} />
              </div>
            )}
          </DashboardPanel>
        )}

        {activeTab === "clubs" && (
          <DashboardPanel>
            <SectionHeading title="Clubs" />
            <ClubManager clubs={dashboard.clubs} />
            <CoachRosterImport clubs={dashboard.clubs} />
          </DashboardPanel>
        )}

        {activeTab === "athletes" && (
          <DashboardPanel>
            <SectionHeading title="Athletes" />
            <CoachOperationsPanel clubs={dashboard.clubs} />
            <SwimmerRankingBoard swimmers={allSwimmers} />
            <AthleteRoster swimmers={allSwimmers} />
          </DashboardPanel>
        )}

        {activeTab === "reports" && (
          <DashboardPanel>
            <SectionHeading title="Reports" />
            <DevelopmentPanel swimmers={allSwimmers} expanded />
            <SwimmerRankingBoard swimmers={allSwimmers} />
          </DashboardPanel>
        )}
      </div>

      <DashboardOptionWheel
        activeId={activeTab}
        items={tabs.map(({ id, label, icon: Icon }) => ({
          id,
          icon: <Icon aria-hidden className="h-5 w-5" />,
          label
        }))}
        onChange={setActiveTab}
      />
    </main>
  );
}

function DashboardPanel({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div animate={{ opacity: 1, y: 0 }} className="space-y-4" initial={reducedMotion ? false : { opacity: 0.72, y: 7 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}>
      {children}
    </motion.div>
  );
}

function SectionHeading({ title }: { title: string }) {
  const { t } = useTranslator();
  return <h2 className="text-2xl font-semibold tracking-normal text-stitch-abyss sm:text-3xl">{t(title)}</h2>;
}

function QuickAction({ label, onClick, secondary = false }: { label: string; onClick: () => void; secondary?: boolean }) {
  const { t } = useTranslator();

  return (
    <button className={`ui-press inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${secondary ? "border border-stitch-abyss/15 bg-white/45 text-stitch-abyss hover:bg-white" : "bg-stitch-abyss text-white hover:bg-[#10243a]"}`} type="button" onClick={onClick}>
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
    <div className="min-w-0 px-3 py-3 sm:px-4">
      <div className="truncate text-[0.68rem] font-semibold text-stitch-abyss/58 sm:text-xs">{t(label)}</div>
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
  const reducedMotion = useReducedMotion();

  return (
    <motion.article animate={{ opacity: 1, y: 0 }} className="min-w-0 border-t border-stitch-abyss/10 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0" initial={reducedMotion ? false : { opacity: 0.7, y: 6 }} transition={{ duration: reducedMotion ? 0 : 0.22, delay: 0.03, ease: [0.23, 1, 0.32, 1] }}>
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
        <div className="mt-5 grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.75fr)] divide-x divide-stitch-abyss/10 border-y border-stitch-abyss/10 py-3">
          <CoachMini label="Athlete" value={swimmer.name} />
          <CoachMini label="Swims" value={swimmer.totalSwims.toString()} />
          <CoachMini label="Goals" value={swimmer.activeGoals.toString()} />
        </div>
      ) : (
        <p className="mt-5 border-t border-stitch-abyss/10 pt-4 text-sm leading-6 text-stitch-abyss/64">
          {t("Create a club and add swimmers to unlock coach analytics.")}
        </p>
      )}
    </motion.article>
  );
}

function CoachMini({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();

  return <div className="min-w-0 px-2 first:pl-0 last:pr-0 sm:px-3"><div className="truncate text-[0.68rem] font-semibold text-stitch-abyss/52">{t(label)}</div><div className="mt-1 truncate font-mono text-base font-semibold text-stitch-abyss">{value}</div></div>;
}

function EmptyCoachState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslator();

  return (
    <section className="dashboard-glass flex min-h-[320px] items-center justify-center px-6 text-center">
      <div className="max-w-lg">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stitch-abyss text-stitch-cyan shadow-glow"><Building2 aria-hidden className="h-6 w-6" /></div>
        <h2 className="mt-6 text-3xl font-semibold text-white">{t("Your coach workspace is ready.")}</h2>
        <p className="mt-4 leading-7 text-white/78">{t("Create your first swim club, share its join code, and swimmers can connect from their Community tab.")}</p>
        <button className="ui-press mt-7 h-11 rounded-full bg-white px-6 text-sm font-semibold text-stitch-abyss hover:bg-stitch-cyan" type="button" onClick={onCreate}>{t("Create a club")}</button>
      </div>
    </section>
  );
}

function ClubGrid({ clubs }: { clubs: CoachClubSummary[] }) {
  const { t } = useTranslator();

  return (
    <section className="dashboard-glass p-5">
      <h2 className="text-lg font-semibold text-white">{t("Active clubs")}</h2>
      <div className="mt-4">
        {clubs.slice(0, 4).map((club) => (
          <div className="border-t border-white/12 py-4 first:border-t-0 first:pt-0 last:pb-0" key={club.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-semibold text-white">{club.name}</div>
                <div className="mt-1 text-sm leading-5 text-white/62">{club.memberCount} {t("swimmers")} · {club.dataReadyCount} {t("data ready")} · {club.permissionPendingCount} {t("permission pending")}</div>
              </div>
              <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs text-aqua-100">{club.joinCode}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoachPulse({ swimmers }: { swimmers: CoachSwimmerAnalytics[] }) {
  const { t } = useTranslator();
  const ranked = [...swimmers]
    .sort((a, b) => b.yearlyImprovement - a.yearlyImprovement || b.swimPowerIndex - a.swimPowerIndex)
    .slice(0, 3);

  return (
    <section className="dashboard-glass p-5">
      <h2 className="text-lg font-semibold text-white">{t("Swimmer ranking")}</h2>
      <div className="mt-4">
        {ranked.map((swimmer, index) => (
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-white/12 py-3 first:border-t-0 first:pt-0 last:pb-0" key={swimmer.id}>
            <span className="font-mono text-xs font-semibold text-aqua-100">{String(index + 1).padStart(2, "0")}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{swimmer.name}</p>
              <p className="mt-0.5 truncate text-xs text-white/52">{swimmer.strongestEvent ? t(swimmer.strongestEvent) : t("No event yet")}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold text-stitch-cyan">{t("SPI")} {swimmer.swimPowerIndex}</p>
              <p className="mt-0.5 text-xs text-mint-200">{swimmer.yearlyImprovement}% {t("Yearly")}</p>
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
      <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="lg:border-r lg:border-white/12 lg:pr-5">
          <h2 className="text-lg font-semibold text-white">{t("Create club")}</h2>
          <input className="mt-4 h-10 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 text-sm text-white outline-none placeholder:text-white/45 focus:border-stitch-cyan" placeholder={t("Club name")} value={name} onChange={(event) => setName(event.target.value)} />
          <textarea className="mt-3 min-h-24 w-full rounded-md border border-white/10 bg-stitch-abyss px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:border-stitch-cyan" placeholder={t("Optional description")} value={description} onChange={(event) => setDescription(event.target.value)} />
          <button className="ui-press mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-stitch-cyan px-4 text-sm font-semibold text-stitch-abyss hover:bg-white disabled:cursor-wait disabled:opacity-70" disabled={saving} type="button" onClick={createClub}>
            {saving ? <KineticLoader className="h-4 text-stitch-abyss" label={t("Creating club")} /> : <Plus aria-hidden className="h-4 w-4" />}
            {saving ? t("Creating") : t("Create club")}
          </button>
          {status && <p className="mt-3 text-sm text-white/72">{status}</p>}
        </div>
        <div>
          {clubs.length === 0 && <div className="rounded-lg border border-dashed border-white/12 p-6 text-center text-sm text-white/72">{t("No clubs yet.")}</div>}
          {clubs.map((club) => (
            <div className="border-t border-white/12 py-4 first:border-t-0 first:pt-0 last:pb-0" key={club.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold text-white">{club.name}</div>
                  <div className="mt-1 text-sm text-white/58">{club.memberCount} {t("swimmers")} · {t("share code")} {club.joinCode}</div>
                </div>
                <button
                  className="ui-press inline-flex h-9 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:border-stitch-cyan"
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
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-white/62">
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
  const { language, t } = useTranslator();

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
                  <td className="py-3 pr-3"><div className="font-semibold text-white">{swimmer.name}</div><div className="text-xs text-white/54">{t("Joined")} {formatDate(swimmer.joinedAt, language)}</div></td>
                  <td className="px-3 py-3 text-white/72">{swimmer.strongestEvent ? t(swimmer.strongestEvent) : t("No event yet")}</td>
                  <td className="px-3 py-3 font-mono font-semibold text-stitch-cyan">{swimmer.swimPowerIndex}</td>
                  <td className="px-3 py-3 text-white/72">{Math.round(swimmer.consistencyScore)}</td>
                  <td className="px-3 py-3 text-mint-200">{swimmer.yearlyImprovement}%</td>
                  <td className="py-3 pl-3 text-white/72">{swimmer.latestResult ? `${t(swimmer.latestResult.event)} ${swimmer.latestResult.course} · ${formatTime(swimmer.latestResult.timeSeconds)}` : t("No result")}</td>
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
          <article className="ui-lift rounded-lg border border-white/12 bg-white/[0.08] p-4 hover:border-stitch-cyan/45" key={swimmer.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold text-aqua-100">#{index + 1}</p>
                <h3 className="mt-2 font-semibold text-white">{swimmer.name}</h3>
                <p className="mt-1 text-sm text-white/58">{swimmer.strongestEvent ? t(swimmer.strongestEvent) : t("No strongest event yet")}</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-2xl font-semibold text-stitch-cyan">{swimmer.swimPowerIndex}</div>
                <div className="text-xs text-white/48">{t("SPI")}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 divide-x divide-white/12 border-t border-white/12 pt-3 text-sm">
              <div className="pr-3"><span className="block text-white/44">{t("Yearly")}</span><strong className="font-mono text-mint-200">{swimmer.yearlyImprovement}%</strong></div>
              <div className="pl-3"><span className="block text-white/44">{t("Swims")}</span><strong className="font-mono text-white">{swimmer.totalSwims}</strong></div>
            </div>
          </article>
        ))}
        {!ranked.length && <div className="rounded-lg border border-dashed border-white/12 p-6 text-center text-sm text-white/72 lg:col-span-3">{t("Swimmer rankings appear after athletes join and log results.")}</div>}
      </div>
    </section>
  );
}

function DevelopmentPanel({ swimmers, expanded = false }: { swimmers: CoachSwimmerAnalytics[]; expanded?: boolean }) {
  const { language, t } = useTranslator();
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
  const data = filtered.map((point) => ({ ...point, label: formatShortDate(point.date, language) }));

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
            {eventOptions.map((event) => <option key={event} value={event}>{t(event)}</option>)}
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
      <span className="mb-1 block text-[11px] font-semibold text-white/58">{t(label)}</span>
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
