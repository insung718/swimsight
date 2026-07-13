"use client";

import { Activity, BarChart3, CheckCircle2, Clock3, Scale, ShieldCheck, Target } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { formatDate, formatTime } from "@/lib/utils";
import type { ModelPerformanceBreakdown, ModelPerformanceDashboard } from "@/types/swim";

export function ModelPerformancePanel({ performance }: { performance: ModelPerformanceDashboard }) {
  const { language, t } = useTranslator();
  const { summary } = performance;

  return (
    <div className="space-y-4" data-no-translate>
      <section className="dashboard-glass overflow-hidden p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-aqua-400/12 text-aqua-100">
                <Activity aria-hidden className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-white">{t("Prediction evaluation")}</h2>
                <p className="text-sm text-white/68">{t("Measured against later official individual results in the same event, course, and target date.")}</p>
              </div>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/72">
            <Clock3 aria-hidden className="h-4 w-4 text-aqua-100" />
            {summary.pendingPredictions} {t("pending")}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-6">
          <Metric label={t("Evaluated")} value={summary.evaluatedPredictions.toString()} />
          <Metric label={t("MAE")} value={`${summary.mae.toFixed(2)}${t("s")}`} />
          <Metric label={t("Median error")} value={`${summary.medianAbsoluteError.toFixed(2)}${t("s")}`} />
          <Metric label={t("RMSE")} value={`${summary.rmse.toFixed(2)}${t("s")}`} />
          <Metric label={t("Interval coverage")} value={`${summary.intervalCoverage.toFixed(1)}%`} />
          <Metric label={t("Probability Brier score")} value={summary.probabilityEvaluations ? summary.probabilityBrierScore.toFixed(3) : "—"} />
        </div>
      </section>

      {summary.evaluatedPredictions === 0 ? (
        <section className="dashboard-glass p-6 sm:p-8">
          <div className="mx-auto max-w-xl text-center">
            <ShieldCheck aria-hidden className="mx-auto h-8 w-8 text-aqua-100" />
            <h3 className="mt-4 text-xl font-semibold text-white">{t("No forecasts have reached race day yet.")}</h3>
            <p className="mt-3 text-sm leading-6 text-white/68">
              {t("SwimSight has started preserving future forecasts. When you add a matching official individual result, this page will calculate the real error and interval coverage automatically.")}
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="dashboard-glass p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <Scale aria-hidden className="h-5 w-5 text-aqua-100" />
              <div>
                <h3 className="text-base font-semibold text-white">{t("Baseline comparison")}</h3>
                <p className="text-sm text-white/64">{t("A complex model earns its place only when it beats simple forecasts.")}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {performance.baselines.map((baseline, index) => {
                const best = Math.min(...performance.baselines.map((item) => item.mae));
                return (
                  <div className={`rounded-lg border p-4 ${baseline.mae === best ? "border-mint-300/30 bg-mint-300/10" : "border-white/10 bg-white/[0.06]"}`} key={baseline.label}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white/62">{t(baseline.label)}</span>
                      {index === 0 && <Target aria-hidden className="h-4 w-4 text-aqua-100" />}
                    </div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-white">{baseline.mae.toFixed(2)}{t("s")}</div>
                    <div className="mt-1 text-xs text-white/48">{baseline.count} {t("evaluations")}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Breakdown title={t("Error by event")} rows={performance.byEvent} t={t} />
            <Breakdown title={t("Performance by model version")} rows={performance.byModelVersion} t={t} translateLabels={false} />
            <Breakdown title={t("Error by confidence")} rows={performance.byConfidence} t={t} />
            <Breakdown title={t("Error by data sufficiency")} rows={performance.byDataSufficiency} t={t} />
            <Breakdown title={t("Error by age group")} rows={performance.byAgeGroup} t={t} />
          </section>

          {summary.probabilityEvaluations > 0 && (
            <section className="dashboard-glass p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <BarChart3 aria-hidden className="mt-0.5 h-5 w-5 text-aqua-100" />
                <div>
                  <h3 className="text-base font-semibold text-white">{t("Probability calibration")}</h3>
                  <p className="mt-1 text-sm text-white/64">{t("Predicted chances are compared with what actually happened. Lower Brier scores are better.")}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {performance.probabilityCalibration.filter((calibration) => calibration.count > 0).map((calibration) => (
                  <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4" key={calibration.label}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{t(calibration.label)}</div>
                      <div className="font-mono text-xs text-aqua-100">{t("Brier")} {calibration.brierScore.toFixed(3)}</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {calibration.bins.filter((bin) => bin.count > 0).map((bin) => (
                        <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 text-xs" key={bin.label}>
                          <span className="text-white/52">{bin.label}</span>
                          <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-aqua-200" style={{ width: `${bin.observedRate}%` }} /></div>
                          <span className="font-mono text-white/72">{bin.meanPredicted.toFixed(0)}% / {bin.observedRate.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </>
      )}

      {performance.history.length > 0 && (
        <section className="dashboard-glass overflow-hidden p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 aria-hidden className="h-5 w-5 text-mint-200" />
            <h3 className="text-base font-semibold text-white">{t("Prediction history")}</h3>
          </div>
          <div className="mt-4 space-y-2">
            {performance.history.slice(0, 50).map((record) => {
              const evaluated = Boolean(record.evaluatedAt);
              return (
                <article className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-4 sm:grid-cols-[1.2fr_repeat(3,0.7fr)_auto] sm:items-center" key={record.id}>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-semibold text-white">{t(record.event)} · {record.course}</h4>
                    <p className="mt-1 text-xs text-white/52">{formatDate(record.targetRaceDate, language)} · {record.modelVersion}</p>
                  </div>
                  <HistoryValue label={t("Forecast")} value={formatTime(record.predictedTime)} />
                  <HistoryValue label={t("Actual")} value={record.actualTime === null || record.actualTime === undefined ? "—" : formatTime(record.actualTime)} />
                  <HistoryValue label={t("Absolute error")} value={record.absoluteError === null || record.absoluteError === undefined ? "—" : `${record.absoluteError.toFixed(2)}${t("s")}`} />
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${!evaluated ? "bg-white/10 text-white/68" : record.withinInterval ? "bg-mint-300/12 text-mint-100" : "bg-coral-300/12 text-coral-100"}`}>
                    {t(!evaluated ? "Awaiting result" : record.withinInterval ? "Inside range" : "Outside range")}
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.07] p-3 sm:p-4"><div className="text-[0.68rem] font-semibold uppercase text-white/48">{label}</div><div className="mt-2 font-mono text-xl font-semibold text-white sm:text-2xl">{value}</div></div>;
}

function Breakdown({ rows, t, title, translateLabels = true }: { rows: ModelPerformanceBreakdown[]; t: (value: string) => string; title: string; translateLabels?: boolean }) {
  return (
    <section className="dashboard-glass p-4 sm:p-5">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <div className="mt-4 space-y-2">
        {rows.slice(0, 8).map((row) => (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-white/8 py-2.5 last:border-0" key={row.label}>
            <div className="min-w-0"><div className="truncate text-sm font-medium text-white/84">{translateLabels ? t(row.label) : row.label}</div><div className="text-xs text-white/44">{row.count} {t("evaluations")}</div></div>
            <div className="text-right"><div className="font-mono text-sm font-semibold text-white">{row.mae.toFixed(2)}{t("s")}</div><div className="text-[10px] text-white/42">{t("MAE")}</div></div>
            <div className="w-14 text-right"><div className="font-mono text-sm font-semibold text-aqua-100">{row.intervalCoverage.toFixed(0)}%</div><div className="text-[10px] text-white/42">{t("coverage")}</div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryValue({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[10px] font-semibold uppercase text-white/42">{label}</div><div className="mt-1 font-mono text-sm font-semibold text-white">{value}</div></div>;
}
