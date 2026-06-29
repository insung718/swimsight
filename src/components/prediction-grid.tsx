"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CheckCircle2, Sparkles, TrendingDown, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import { cn, formatTime } from "@/lib/utils";
import type { Prediction } from "@/types/swim";

const horizonLabels = [
  ["30 days", "days30"],
  ["90 days", "days90"],
  ["180 days", "days180"],
  ["365 days", "days365"]
] as const;

export function PredictionGrid({ predictions }: { predictions: Prediction[] }) {
  const { t } = useTranslator();
  const id = useId();
  const sortedPredictions = useMemo(() => [...predictions].sort((a, b) => b.confidence - a.confidence), [predictions]);
  const [active, setActive] = useState<Prediction | null>(null);
  const bestForecast = sortedPredictions
    .map((prediction) => ({
      event: prediction.event,
      improvement: prediction.currentTime - prediction.predictedTimes.days365
    }))
    .sort((a, b) => b.improvement - a.improvement)[0];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setActive(null);
    }

    document.body.style.overflow = active ? "hidden" : "";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);

  return (
    <section className="dashboard-glass min-w-0 overflow-hidden p-4 lg:p-5" data-no-translate>
      <AnimatePresence>
        {active && (
          <>
            <motion.div
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[90] bg-[#020811]/70 backdrop-blur-xl"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
            />
            <PredictionExpandedCard id={id} onClose={() => setActive(null)} prediction={active} t={t} />
          </>
        )}
      </AnimatePresence>

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
        <ul className="grid gap-3 lg:grid-cols-2">
          {sortedPredictions.map((prediction) => (
            <PredictionTriggerCard id={id} key={predictionKey(prediction)} onOpen={() => setActive(prediction)} prediction={prediction} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PredictionTriggerCard({
  id,
  onOpen,
  prediction,
  t
}: {
  id: string;
  onOpen: () => void;
  prediction: Prediction;
  t: (value: string) => string;
}) {
  const key = predictionKey(prediction);
  const confidenceTone = prediction.confidence >= 70 ? "text-mint-200" : prediction.confidence >= 45 ? "text-aqua-100" : "text-coral-100";

  return (
    <motion.li className="list-none" layoutId={`prediction-card-${key}-${id}`}>
      <button
        className="group flex w-full items-center justify-between gap-4 rounded-lg border border-white/15 bg-white/10 p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-aqua-200/35 hover:bg-white/[0.13]"
        type="button"
        onClick={onOpen}
      >
        <div className="flex min-w-0 items-center gap-3">
          <motion.div
            className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-md border border-aqua-200/20 bg-aqua-200/10 text-aqua-100 sm:inline-flex"
            layoutId={`prediction-visual-${key}-${id}`}
          >
            <Sparkles aria-hidden className="h-5 w-5" />
          </motion.div>
          <div className="min-w-0">
            <motion.h3 className="truncate text-base font-semibold text-white" layoutId={`prediction-title-${key}-${id}`}>
              {t(prediction.event)}
            </motion.h3>
            <motion.p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-aqua-100" layoutId={`prediction-course-${key}-${id}`}>
              {prediction.course}
            </motion.p>
          </div>
        </div>
        <motion.div className="flex shrink-0 items-center gap-2" layoutId={`prediction-meta-${key}-${id}`}>
          <span className={cn("rounded-md bg-stitch-abyss px-2.5 py-1 text-xs font-semibold", confidenceTone)}>
            {prediction.confidence}% {t("confidence")}
          </span>
          <span className="hidden rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/64 transition group-hover:border-aqua-200/40 group-hover:text-white sm:inline-flex">
            {t("Open")}
          </span>
        </motion.div>
      </button>
    </motion.li>
  );
}

function PredictionExpandedCard({
  id,
  onClose,
  prediction,
  t
}: {
  id: string;
  onClose: () => void;
  prediction: Prediction;
  t: (value: string) => string;
}) {
  const key = predictionKey(prediction);
  const delta365 = prediction.currentTime - prediction.predictedTimes.days365;

  return (
    <div className="fixed inset-0 z-[100]">
      <motion.div
        className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#03111f] text-white shadow-[0_30px_120px_rgba(0,0,0,0.45)]"
        layoutId={`prediction-card-${key}-${id}`}
      >
        <div className="shrink-0 border-b border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(91,242,255,0.24),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-4 sm:p-6 lg:p-8">
          <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <motion.div
                className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-md border border-aqua-200/25 bg-aqua-200/10 text-aqua-100 shadow-glow sm:inline-flex"
                layoutId={`prediction-visual-${key}-${id}`}
              >
                <Sparkles aria-hidden className="h-6 w-6" />
              </motion.div>
              <div className="min-w-0">
                <motion.h3 className="text-balance text-3xl font-semibold tracking-normal text-white sm:text-5xl" layoutId={`prediction-title-${key}-${id}`}>
                  {t(prediction.event)}
                </motion.h3>
                <motion.p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-aqua-100" layoutId={`prediction-course-${key}-${id}`}>
                  {prediction.course}
                </motion.p>
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <motion.div className="rounded-md bg-white/10 px-3 py-2 text-right text-xs font-semibold text-aqua-100" layoutId={`prediction-meta-${key}-${id}`}>
                {prediction.confidence}%<br />
                <span className="text-white/58">{t("confidence")}</span>
              </motion.div>
              <button
                aria-label={t("Close")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white transition hover:bg-white hover:text-stitch-abyss focus-visible:outline focus-visible:outline-2 focus-visible:outline-stitch-cyan"
                type="button"
                onClick={onClose}
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-28 [scrollbar-width:none] sm:px-6 lg:px-8"
          exit={{ opacity: 0, y: 10 }}
          initial={{ opacity: 0, y: 10 }}
        >
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[0.88fr_1.12fr]">
            <section className="rounded-lg border border-white/12 bg-white/[0.07] p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <PredictionMini label={t("Current")} value={formatTime(prediction.currentTime)} />
                <PredictionMini label={t("365 days")} value={formatTime(prediction.predictedTimes.days365)} />
                <PredictionMini label={t("Improvement")} value={delta365 > 0 ? `${delta365.toFixed(2)}${t("s")}` : t("Stable")} />
              </div>

              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.08] p-4 text-sm leading-6 text-white/82">
                <div className="flex items-start gap-2">
                  <Sparkles aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-aqua-200" />
                  <p>{delta365 > 0 ? `${delta365.toFixed(2)}${t("s projected improvement in 365 days")}` : t("Stable projection until more history is added")}</p>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-aqua-200/15 bg-aqua-200/[0.08] p-4 text-sm text-aqua-50/84">
                {t("Training signal")}: {t(prediction.trainingImpact.label)}
                {prediction.trainingImpact.sessionsLast28Days > 0 ? ` · ${prediction.trainingImpact.sessionsLast28Days} ${t("gym sessions / 28d")}` : ""}
              </div>
            </section>

            <section className="rounded-lg border border-white/12 bg-white/[0.06] p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {horizonLabels.map(([label, predictionKey]) => (
                  <PredictionMini key={predictionKey} label={t(label)} value={formatTime(prediction.predictedTimes[predictionKey])} />
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InsightBlock label={t("Model confidence")} value={`${prediction.confidence}%`} />
                <InsightBlock label={t("Pool type")} value={prediction.course} />
                <InsightBlock label={t("Current time")} value={formatTime(prediction.currentTime)} />
                <InsightBlock label={t("Forecast window")} value={t("30 to 365 days")} />
              </div>
            </section>

            <section className="rounded-lg border border-white/12 bg-[radial-gradient(circle_at_78%_22%,rgba(78,232,255,0.17),transparent_36%),rgba(255,255,255,0.055)] p-4 sm:p-5 lg:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-white">{t("Forecast readout")}</h4>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/66">
                    {t("Predictions stay conservative and update as more official meet results are added.")}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-mint-300/20 bg-mint-300/10 px-3 py-1 text-sm font-semibold text-mint-100">
                  <CheckCircle2 aria-hidden className="h-4 w-4" />
                  {t("Ready")}
                </span>
              </div>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function InsightBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.07] p-4">
      <div className="text-xs font-semibold text-white/58">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function PredictionMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.12] p-3">
      <div className="text-xs text-white/62">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function predictionKey(prediction: Prediction) {
  return `${prediction.event}-${prediction.course}`;
}
