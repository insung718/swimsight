"use client";

import { CalendarClock, ChevronDown, Sparkles, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import { formatTime } from "@/lib/utils";
import type { Prediction } from "@/types/swim";

const horizonLabels = [
  ["30 days", "days30"],
  ["90 days", "days90"],
  ["180 days", "days180"],
  ["365 days", "days365"]
] as const;

export function PredictionGrid({ predictions }: { predictions: Prediction[] }) {
  const { t } = useTranslator();
  const sortedPredictions = useMemo(() => [...predictions].sort((a, b) => b.confidence - a.confidence), [predictions]);
  const [openKey, setOpenKey] = useState(sortedPredictions[0] ? `${sortedPredictions[0].event}-${sortedPredictions[0].course}` : "");
  const bestForecast = sortedPredictions
    .map((prediction) => ({
      event: prediction.event,
      improvement: prediction.currentTime - prediction.predictedTimes.days365
    }))
    .sort((a, b) => b.improvement - a.improvement)[0];

  return (
    <section className="dashboard-glass min-w-0 overflow-hidden p-4 lg:p-5" data-no-translate>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-mint-400/10 text-mint-400">
            <CalendarClock aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">{t("Predictions")}</h2>
            <p className="text-sm text-white/74">{t("Tap an event to open its forecast.")}</p>
          </div>
        </div>
        {bestForecast && bestForecast.improvement > 0 && (
          <div className="rounded-lg border border-mint-400/20 bg-mint-400/10 px-4 py-3 text-sm text-mint-100">
            <div className="flex items-center gap-2 font-semibold">
              <TrendingDown aria-hidden className="h-4 w-4" />
              {t("Best 365d forecast")}
            </div>
            <p className="mt-1 text-mint-100/80">
              {t(bestForecast.event)}: {bestForecast.improvement.toFixed(2)}{t("s faster")}
            </p>
          </div>
        )}
      </div>

      {sortedPredictions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/14 bg-white/8 p-6 text-sm leading-6 text-white/76">
          {t("Add a swim result to unlock a first prediction. Add a second result in the same event and SwimSight starts fitting a real regression line.")}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sortedPredictions.map((prediction) => {
            const key = `${prediction.event}-${prediction.course}`;
            const isOpen = openKey === key;
            const confidenceTone = prediction.confidence >= 70 ? "text-mint-200" : prediction.confidence >= 45 ? "text-aqua-100" : "text-coral-100";
            const delta365 = prediction.currentTime - prediction.predictedTimes.days365;

            return (
              <article className="overflow-hidden rounded-lg border border-white/15 bg-white/10 transition duration-300 hover:-translate-y-0.5 hover:border-aqua-200/35 hover:bg-white/[0.13]" key={key}>
                <button
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                  type="button"
                  onClick={() => setOpenKey(isOpen ? "" : key)}
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-white">{t(prediction.event)}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-aqua-100">{prediction.course}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-md bg-stitch-abyss px-2.5 py-1 text-xs font-semibold ${confidenceTone}`}>
                      {prediction.confidence}% {t("confidence")}
                    </span>
                    <ChevronDown aria-hidden className={`h-4 w-4 text-white/64 transition ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-3">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <PredictionMini label={t("Current")} value={formatTime(prediction.currentTime)} />
                      <PredictionMini label={t("365 days")} value={formatTime(prediction.predictedTimes.days365)} />
                      <PredictionMini label={t("Improvement")} value={delta365 > 0 ? `${delta365.toFixed(2)}${t("s")}` : t("Stable")} />
                    </div>

                    <div className="mt-3 flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white/70">
                      <Sparkles aria-hidden className="h-4 w-4 text-aqua-200" />
                      {delta365 > 0 ? `${delta365.toFixed(2)}${t("s projected improvement in 365 days")}` : t("Stable projection until more history is added")}
                    </div>

                    <div className="mt-2 rounded-md border border-aqua-200/15 bg-aqua-200/[0.08] px-3 py-2 text-xs text-aqua-50/82">
                      {t("Training signal")}: {t(prediction.trainingImpact.label)}
                      {prediction.trainingImpact.sessionsLast28Days > 0 ? ` · ${prediction.trainingImpact.sessionsLast28Days} ${t("gym sessions / 28d")}` : ""}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {horizonLabels.map(([label, predictionKey]) => (
                        <PredictionMini key={predictionKey} label={t(label)} value={formatTime(prediction.predictedTimes[predictionKey])} />
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PredictionMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.12] p-2">
      <div className="text-xs text-white/72">{label}</div>
      <div className="mt-1 font-bold text-white">{value}</div>
    </div>
  );
}
