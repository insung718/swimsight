"use client";

import { useState } from "react";
import { Database, FileCheck2, LockKeyhole, RefreshCw, UsersRound } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { KineticLoader } from "@/components/ui/kinetic-loader";

type Coverage = { label: string; athleteCount: number | null; suppressed: boolean; minimum: number }[];
type Readiness = {
  generatedAt: string;
  status: string;
  thresholds: { athletes: number; officialRaces: number; evaluatedPredictions: number; majorEventGroups: number };
  counts: Record<string, number>;
  historyThresholds: Record<string, number>;
  splits: Record<string, number>;
  coverage: Record<string, Coverage>;
  quality: { importRows: number; duplicateRows: number; duplicateRate: number; excludedRows: number; exclusionRate: number; exclusionReasons: Record<string, number> };
  evaluationPrecision: { sampleSize: number; maeEstimate: number | null; approximate95PercentHalfWidth: number | null; status: string; caveat: string };
  evaluationSamples: Record<string, number>;
  pilot: {
    cohorts: number;
    invitations: number;
    invitationCapacity: number;
    acceptedInvitationUses: number;
    availableInvitations: number;
    totalEnrollments: number;
    activeEnrollments: number;
    withdrawnEnrollments: number;
    completedEnrollments: number;
    retention7Day: RetentionMetric;
    retention30Day: RetentionMetric;
  };
};

type RetentionMetric = { eligible: number | null; returned: number | null; rate: number | null; suppressed: boolean; minimum: number };

type Manifest = { id: string; version: string; status: string; recordCount: number; athleteCount: number; datasetHash: string; manifestHash: string; createdAt: string; invalidationReason?: string | null };
type Pilot = { id: string; name: string; label: string; description?: string | null; startsAt?: string | null; endsAt?: string | null; _count: { enrollments: number; invitations: number } };

export function InternalReadinessDashboard({ initialManifests, initialPilots, readiness }: { initialManifests: Manifest[]; initialPilots: Pilot[]; readiness: Readiness }) {
  const { t } = useTranslator();
  const [manifests, setManifests] = useState(initialManifests);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [pilots, setPilots] = useState(initialPilots);
  const [pilotName, setPilotName] = useState("");
  const [pilotLabel, setPilotLabel] = useState("");
  const [pilotDescription, setPilotDescription] = useState("");
  const [pilotEndDate, setPilotEndDate] = useState("");

  async function sealManifest() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/data-foundation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CREATE_COHORT_MANIFEST", extractionCutoff: new Date().toISOString() })
      });
      const data = await response.json();
      if (!response.ok) return setStatus(t(data.error ?? "Could not seal cohort manifest."));
      setManifests((current) => [data.manifest, ...current]);
      setStatus(t("A new immutable cohort version was sealed. Existing versions were not changed."));
    } finally {
      setBusy(false);
    }
  }

  async function createPilot() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/pilots/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pilotName,
          label: pilotLabel,
          ...(pilotDescription ? { description: pilotDescription } : {}),
          ...(pilotEndDate ? { endsAt: new Date(`${pilotEndDate}T23:59:59.999Z`).toISOString() } : {})
        })
      });
      const data = await response.json();
      if (!response.ok) return setStatus(t(data.error ?? "Could not create pilot cohort."));
      setPilots((current) => [{ ...data.cohort, _count: { enrollments: 0, invitations: 0 } }, ...current]);
      setPilotName("");
      setPilotLabel("");
      setPilotDescription("");
      setPilotEndDate("");
      setStatus(t("Pilot cohort created. Coaches can now create permission-reviewed invitation links."));
    } finally {
      setBusy(false);
    }
  }

  const gaps = [
    ["Statistically usable athletes", readiness.counts.statisticallyUsableAthletes, readiness.thresholds.athletes],
    ["Statistically usable races", readiness.counts.statisticallyUsableResults, readiness.thresholds.officialRaces],
    ["Evaluated predictions", readiness.counts.evaluatedPredictions, readiness.thresholds.evaluatedPredictions]
  ] as const;

  return (
    <main className="dark min-h-screen bg-[#07111e] text-white">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-white/12 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-sm font-semibold text-stitch-cyan">{t("Restricted internal workspace")}</p><h1 className="mt-2 text-3xl font-semibold sm:text-5xl">{t("Dataset readiness")}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/62">{t("Raw volume, consent eligibility, statistical usability, prospective outcomes, and reproducible cohort lineage are shown separately.")}</p></div>
          <button className="ui-press inline-flex h-11 items-center gap-2 self-start rounded-md bg-white px-4 text-sm font-semibold text-stitch-abyss disabled:opacity-55" disabled={busy} type="button" onClick={() => void sealManifest()}>{busy ? <KineticLoader className="h-4 text-stitch-abyss" label={t("Sealing cohort")} /> : <LockKeyhole aria-hidden className="h-4 w-4" />}{t("Seal new cohort version")}</button>
        </header>

        <section className={`mt-6 rounded-lg border p-5 ${readiness.status === "READY_FOR_CANDIDATE_RESEARCH" ? "border-mint-200/25 bg-mint-200/10" : "border-amber-200/25 bg-amber-200/10"}`}>
          <p className="font-mono text-xs font-semibold uppercase text-white/52">{t(readiness.status.replaceAll("_", " "))}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">{gaps.map(([label, current, target]) => <ReadinessGap current={current} key={label} label={label} target={target} />)}</div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric icon={UsersRound} label="Raw athletes" value={readiness.counts.rawAthletes} />
          <Metric icon={Database} label="Raw results" value={readiness.counts.rawResults} />
          <Metric icon={FileCheck2} label="Consented athletes" value={readiness.counts.consentedAthletes} />
          <Metric icon={FileCheck2} label="Eligible official results" value={readiness.counts.eligibleOfficialResults} />
          <Metric icon={FileCheck2} label="Research-grade official results" value={readiness.counts.sourceBackedOfficialResults} />
          <Metric icon={RefreshCw} label="Follow-up athletes" value={readiness.counts.followUpAthletes} />
        </section>

        <section className="mt-8 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-white/12 bg-white/[0.06] p-5">
            <h2 className="text-lg font-semibold">{t("History and split readiness")}</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">{Object.entries(readiness.historyThresholds).map(([label, value]) => <CompactMetric key={label} label={label.replace("atLeast", "At least ")} value={value} />)}{Object.entries(readiness.splits).map(([label, value]) => <CompactMetric key={label} label={`${label} athletes`} value={value} />)}</div>
            <h3 className="mt-6 text-sm font-semibold text-white/72">{t("Import quality")}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2"><CompactMetric label="Duplicate rate" value={`${readiness.quality.duplicateRate}%`} /><CompactMetric label="Exclusion rate" value={`${readiness.quality.exclusionRate}%`} /><CompactMetric label="Duplicate rows" value={readiness.quality.duplicateRows} /><CompactMetric label="Excluded rows" value={readiness.quality.excludedRows} /></div>
          </div>
          <div className="rounded-lg border border-white/12 bg-white/[0.06] p-5">
            <h2 className="text-lg font-semibold">{t("Coverage with privacy suppression")}</h2><p className="mt-2 text-sm text-white/54">{t("Groups below five athletes are suppressed, including for administrators.")}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(readiness.coverage).map(([name, rows]) => <CoverageList key={name} name={name} rows={rows} />)}</div>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-white/12 bg-white/[0.06] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold">{t("Evaluation sample availability")}</h2><p className="mt-1 text-sm text-white/54">{t("Each baseline and probability metric reports its own usable sample instead of inheriting the total prediction count.")}</p></div><span className="font-mono text-xs text-white/42">{t(readiness.evaluationPrecision.status.replaceAll("_", " "))}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">{Object.entries(readiness.evaluationSamples).map(([label, value]) => <CompactMetric key={label} label={humanize(label)} value={value} />)}</div>
          <p className="mt-4 text-xs leading-5 text-white/44">{t(readiness.evaluationPrecision.caveat)}</p>
        </section>

        <section className="mt-8 rounded-lg border border-white/12 bg-white/[0.06] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold">{t("Controlled pilot operations")}</h2><p className="mt-1 text-sm text-white/54">{t("Invitation use, withdrawal, and return rates are measured from real product events. Rates below five eligible participants stay suppressed.")}</p></div><span className="font-mono text-xs text-white/42">{readiness.pilot.activeEnrollments} {t("active enrollments")}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6"><CompactMetric label="Pilot cohorts" value={readiness.pilot.cohorts} /><CompactMetric label="Invitations" value={readiness.pilot.invitations} /><CompactMetric label="Accepted uses" value={readiness.pilot.acceptedInvitationUses} /><CompactMetric label="Active enrollments" value={readiness.pilot.activeEnrollments} /><CompactMetric label="Withdrawn enrollments" value={readiness.pilot.withdrawnEnrollments} /><CompactMetric label="7-day return rate" value={readiness.pilot.retention7Day.suppressed ? `<${readiness.pilot.retention7Day.minimum}` : `${readiness.pilot.retention7Day.rate}%`} /></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-lg border border-white/10 bg-black/15 p-4"><h3 className="text-sm font-semibold">{t("Create pilot cohort")}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2"><input className="h-10 rounded-md border border-white/12 bg-[#0b1725] px-3 text-sm text-white outline-none focus:border-stitch-cyan" maxLength={100} placeholder={t("Pilot name")} value={pilotName} onChange={(event) => setPilotName(event.target.value)} /><input className="h-10 rounded-md border border-white/12 bg-[#0b1725] px-3 font-mono text-sm text-white outline-none focus:border-stitch-cyan" maxLength={40} placeholder={t("pilot-label")} value={pilotLabel} onChange={(event) => setPilotLabel(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} /><input className="h-10 rounded-md border border-white/12 bg-[#0b1725] px-3 text-sm text-white outline-none focus:border-stitch-cyan sm:col-span-2" maxLength={500} placeholder={t("Pilot description optional")} value={pilotDescription} onChange={(event) => setPilotDescription(event.target.value)} /><label className="text-xs text-white/48 sm:col-span-2">{t("Optional end date")}<input className="mt-1 h-10 w-full rounded-md border border-white/12 bg-[#0b1725] px-3 text-sm text-white outline-none focus:border-stitch-cyan" type="date" value={pilotEndDate} onChange={(event) => setPilotEndDate(event.target.value)} /></label></div><button className="ui-press mt-3 h-9 rounded-md bg-white px-4 text-xs font-semibold text-stitch-abyss disabled:opacity-45" disabled={busy || pilotName.trim().length < 2 || pilotLabel.length < 3} type="button" onClick={() => void createPilot()}>{busy ? t("Creating") : t("Create pilot")}</button></div>
            <div className="rounded-lg border border-white/10 bg-black/15 p-4"><h3 className="text-sm font-semibold">{t("Active pilot cohorts")}</h3><div className="mt-3 space-y-2">{pilots.length === 0 && <p className="text-sm text-white/48">{t("No active pilot cohorts.")}</p>}{pilots.map((pilot) => <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-white/[0.05] p-3 sm:flex-row sm:items-center sm:justify-between" key={pilot.id}><div><p className="text-sm font-semibold">{pilot.name}</p><p className="mt-1 font-mono text-xs text-white/40">{pilot.label}</p></div><p className="text-xs text-white/48">{pilot._count.enrollments} {t("enrollments")} · {pilot._count.invitations} {t("invitations")}</p></div>)}</div></div>
          </div>
        </section>

        <section className="mt-8 rounded-lg border border-white/12 bg-white/[0.06] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold">{t("Immutable cohort manifests")}</h2><p className="mt-1 text-sm text-white/54">{t("Corrections and deletions invalidate affected artifacts; regeneration always creates a new version.")}</p></div><span className="font-mono text-xs text-white/42">{new Date(readiness.generatedAt).toLocaleString()}</span></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-white/12 text-xs uppercase text-white/42"><tr><th className="py-3">{t("Version")}</th><th>{t("Status")}</th><th>{t("Athletes")}</th><th>{t("Records")}</th><th>{t("Dataset hash")}</th></tr></thead><tbody>{manifests.map((manifest) => <tr className="border-b border-white/8" key={manifest.id}><td className="py-3 font-mono text-xs text-aqua-100">{manifest.version}</td><td>{t(manifest.status)}</td><td>{manifest.athleteCount}</td><td>{manifest.recordCount}</td><td className="font-mono text-xs text-white/52">{manifest.datasetHash.slice(0, 16)}…</td></tr>)}</tbody></table></div>
          {!manifests.length && <p className="mt-5 text-sm text-white/54">{t("No research cohort has been sealed yet.")}</p>}
        </section>
        {status && <p className="mt-4 text-sm text-white/66">{status}</p>}
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: number }) { const { t } = useTranslator(); return <div className="rounded-lg border border-white/12 bg-white/[0.06] p-4"><Icon aria-hidden className="h-4 w-4 text-stitch-cyan" /><div className="mt-5 font-mono text-3xl font-semibold">{value.toLocaleString()}</div><div className="mt-1 text-xs uppercase text-white/42">{t(label)}</div></div>; }
function CompactMetric({ label, value }: { label: string; value: number | string }) { const { t } = useTranslator(); return <div className="rounded-md bg-white/[0.06] p-3"><div className="font-mono text-xl font-semibold">{value}</div><div className="mt-1 text-xs text-white/42">{t(label)}</div></div>; }
function ReadinessGap({ current, label, target }: { current: number; label: string; target: number }) { const { t } = useTranslator(); const progress = Math.min(100, Math.round((current / target) * 100)); return <div className="rounded-md bg-black/15 p-3"><div className="flex justify-between text-sm"><span>{t(label)}</span><span className="font-mono">{current} / {target}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-stitch-cyan" style={{ width: `${progress}%` }} /></div></div>; }
function CoverageList({ name, rows }: { name: string; rows: Coverage }) { const { t } = useTranslator(); return <div><h3 className="text-xs font-semibold uppercase text-white/42">{t(name)}</h3><div className="mt-2 space-y-1">{rows.slice(0, 6).map((row) => <div className="flex justify-between gap-3 text-sm" key={row.label}><span className="truncate text-white/66">{t(row.label)}</span><span className="font-mono text-white/46">{row.suppressed ? `<${row.minimum}` : row.athleteCount}</span></div>)}</div></div>; }
function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase()); }
