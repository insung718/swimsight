"use client";

import { AlertTriangle, BarChart3, CheckCircle2, Database, Gauge, ShieldCheck } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { SiteNav } from "@/components/landing/site-nav";
import { formatDate } from "@/lib/utils";

type PublicStatus = {
  generatedAt: string;
  productionStatus: string;
  currentBehavior: string;
  modelVersion: string;
  lastEvaluationDate: string | null;
  cohort: {
    eligibleAthletes: { suppressed: boolean; count: number | null; value: number | null; minimumCohort?: number };
    eligibleOfficialRaces: { suppressed: boolean; count: number | null; value: number | null; minimumCohort?: number };
    evaluatedAthletes: { suppressed: boolean; count: number | null; value: number | null; minimumCohort?: number };
    evaluatedPredictions: number;
    excludedSelfDeclaredEvaluations: number;
  };
  metrics: null | {
    mae: number;
    medianAbsoluteError: number;
    intervalCoverage: number;
    brierScore: number | null;
    calibrationError: number | null;
    baselines: Record<string, number | null>;
  };
  metricSuppression: string | null;
  limitations: string[];
  knownFailureModes: string[];
};

export function PublicValidationPage({ status }: { status: PublicStatus }) {
  const { language, t } = useTranslator();
  const untrained = status.productionStatus === "UNTRAINED";
  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#07121f]">
      <SiteNav />
      <section className="border-b border-black/8 bg-[#07121f] px-5 pb-20 pt-32 text-white">
        <div className="mx-auto max-w-6xl">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${untrained ? "border-amber-200/30 bg-amber-200/10 text-amber-100" : "border-emerald-200/30 bg-emerald-200/10 text-emerald-100"}`}>
            {untrained ? <AlertTriangle aria-hidden className="h-4 w-4" /> : <CheckCircle2 aria-hidden className="h-4 w-4" />}
            {t(status.productionStatus)}
          </div>
          <h1 className="mt-6 max-w-4xl text-balance text-4xl font-semibold leading-tight sm:text-6xl">{t("Validation before promotion.")}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/68">{t(status.currentBehavior)}</p>
          <div className="mt-8 rounded-lg border border-white/15 bg-white/[0.07] p-5 backdrop-blur-xl">
            <p className="text-sm font-semibold text-white">{t("Machine-learning model not yet promoted")}</p>
            <p className="mt-2 text-sm leading-6 text-white/62">{untrained ? t("SwimSight currently uses conservative deterministic forecasts. Public ML claims remain blocked until a challenger passes every governance gate on sufficient prospective evidence.") : t("A governed machine-learning champion is active. The evidence and limits below remain part of the release record.")}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Database} label="Eligible athletes" value={displaySuppressed(status.cohort.eligibleAthletes, t("Suppressed"))} />
          <Metric icon={BarChart3} label="Eligible official races" value={displaySuppressed(status.cohort.eligibleOfficialRaces, t("Suppressed"))} />
          <Metric icon={ShieldCheck} label="Evaluated athletes" value={displaySuppressed(status.cohort.evaluatedAthletes, t("Suppressed"))} />
          <Metric icon={Gauge} label="Evaluated predictions" value={status.cohort.evaluatedPredictions.toLocaleString()} />
        </div>
        {status.cohort.excludedSelfDeclaredEvaluations > 0 && <p className="mt-3 text-xs leading-5 text-black/48">{status.cohort.excludedSelfDeclaredEvaluations.toLocaleString()} {t("self-declared evaluations are excluded from public metrics")}</p>}

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-lg border border-black/8 bg-white p-6 shadow-[0_22px_70px_rgba(7,18,31,0.08)]">
            <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-cyan-700">{t("Evaluation evidence")}</p><h2 className="mt-1 text-2xl font-semibold">{t("Metrics appear only when defensible.")}</h2></div><span className="rounded-full bg-[#07121f] px-3 py-1 font-mono text-xs text-cyan-200">{status.modelVersion}</span></div>
            {status.metrics ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Evidence label="Mean absolute error" value={`${status.metrics.mae}s`} />
                <Evidence label="Median absolute error" value={`${status.metrics.medianAbsoluteError}s`} />
                <Evidence label="Interval coverage" value={`${status.metrics.intervalCoverage}%`} />
                <Evidence label="Brier score" value={status.metrics.brierScore?.toString() ?? t("Insufficient probability sample")} />
                {Object.entries(status.metrics.baselines).map(([label, value]) => <Evidence key={label} label={baselineLabel(label)} value={value === null ? t("Unavailable") : `${value}s MAE`} />)}
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-black/12 bg-[#f6fafb] p-5 text-sm leading-6 text-black/58">{t(status.metricSuppression ?? "Evaluation metrics are currently suppressed.")}</div>
            )}
            <p className="mt-5 text-xs leading-5 text-black/44">{t("Last evaluation")}: {status.lastEvaluationDate ? formatDate(status.lastEvaluationDate, language) : t("No prospective evaluation yet")} · {t("Status generated")} {formatDate(status.generatedAt, language)}</p>
          </section>

          <section className="rounded-lg border border-black/8 bg-white p-6">
            <p className="text-sm font-semibold text-cyan-700">{t("Methodology")}</p>
            <h2 className="mt-1 text-2xl font-semibold">{t("What this page does not claim.")}</h2>
            <ul className="mt-5 space-y-3">{status.limitations.map((item) => <li className="flex gap-3 text-sm leading-6 text-black/62" key={item}><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />{t(item)}</li>)}</ul>
          </section>
        </div>

        <section className="mt-6 rounded-lg bg-[#07121f] p-6 text-white">
          <p className="text-sm font-semibold text-cyan-200">{t("Known failure modes")}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{status.knownFailureModes.map((item) => <div className="rounded-md border border-white/10 bg-white/[0.06] p-3 text-sm leading-6 text-white/64" key={item}>{t(item)}</div>)}</div>
        </section>
      </section>
    </main>
  );
}

function displaySuppressed(value: PublicStatus["cohort"]["eligibleAthletes"], suppressed: string) {
  return value.suppressed ? suppressed : (value.value ?? 0).toLocaleString();
}

function Metric({ icon: Icon, label, value }: { icon: typeof Database; label: string; value: string }) {
  const { t } = useTranslator();
  return <article className="rounded-lg border border-black/8 bg-white p-5"><Icon aria-hidden className="h-5 w-5 text-cyan-700" /><p className="mt-5 text-xs font-semibold uppercase text-black/42">{t(label)}</p><p className="mt-1 font-mono text-2xl font-semibold">{value}</p></article>;
}

function Evidence({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  return <div className="rounded-md border border-black/7 bg-[#f6fafb] p-4"><p className="text-xs text-black/42">{t(label)}</p><p className="mt-1 font-mono text-lg font-semibold">{value}</p></div>;
}

function baselineLabel(value: string) {
  return ({ lastRace: "Last-race baseline", lastThreeAverage: "Last-three baseline", linearTrend: "Linear-trend baseline", conservativeDeterministic: "Conservative deterministic baseline" } as Record<string, string>)[value] ?? value;
}
