"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BrainCircuit, CalendarClock, CheckCircle2, Save, Settings2, Sparkles, TrendingDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslator } from "@/components/i18n/use-language";
import { cn, formatTime } from "@/lib/utils";
import type { AthleteSex, Prediction, PredictionProfile } from "@/types/swim";

const horizonLabels = [
  ["30 days", "days30"],
  ["90 days", "days90"],
  ["180 days", "days180"],
  ["365 days", "days365"]
] as const;

export function PredictionGrid({ predictions, profile }: { predictions: Prediction[]; profile: PredictionProfile }) {
  const { t } = useTranslator();
  const id = useId();
  const sortedPredictions = useMemo(() => [...predictions].sort((a, b) => b.confidence - a.confidence), [predictions]);
  const [active, setActive] = useState<Prediction | null>(null);
  const [mounted, setMounted] = useState(false);
  const bestForecast = sortedPredictions
    .map((prediction) => ({
      event: prediction.event,
      improvement: prediction.currentTime - prediction.predictedTimes.days365
    }))
    .sort((a, b) => b.improvement - a.improvement)[0];

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const expandedPrediction = mounted
    ? createPortal(
        <AnimatePresence>
          {active && (
            <PredictionExpandedCard
              onClose={() => setActive(null)}
              prediction={active}
              t={t}
            />
          )}
        </AnimatePresence>,
        document.body
      )
    : null;

  return (
    <>
      {expandedPrediction}
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

      <PredictionProfileEditor profile={profile} t={t} />

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
    </>
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
        className="group ui-lift flex w-full items-center justify-between gap-4 rounded-lg border border-white/15 bg-white/10 p-4 text-left hover:border-aqua-200/35 hover:bg-white/[0.13]"
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
          <span className="hidden rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/64 transition-[border-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:border-aqua-200/40 group-hover:text-white sm:inline-flex">
            {t("Open")}
          </span>
        </motion.div>
      </button>
    </motion.li>
  );
}

function PredictionExpandedCard({
  onClose,
  prediction,
  t
}: {
  onClose: () => void;
  prediction: Prediction;
  t: (value: string) => string;
}) {
  const delta365 = prediction.currentTime - prediction.predictedTimes.days365;
  const modelLabel = prediction.model.kind === "XGBOOST" ? t("Validated XGBoost") : t("Conservative ensemble");
  const explanation = prediction.explanations.days90;
  const probabilitySet = prediction.probabilities.days90;
  const probabilities = [
    { label: "PB probability", estimate: probabilitySet.pb },
    { label: "Goal probability", estimate: probabilitySet.goal },
    { label: "Qualifying probability", estimate: probabilitySet.qualifying }
  ].filter((item) => item.estimate !== undefined);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[999] overflow-y-auto overscroll-contain bg-[#020811]/82 p-0 text-white backdrop-blur-xl [scrollbar-width:none] sm:p-4"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
    >
      <button
        aria-label={t("Close")}
        className="fixed inset-0 z-0 cursor-default"
        type="button"
        onClick={onClose}
      />
      <motion.div
        animate={{ scale: 1, y: 0 }}
        className="relative z-10 mx-auto min-h-[100dvh] w-full max-w-none overflow-hidden bg-[#03111f] shadow-[0_30px_120px_rgba(0,0,0,0.45)] sm:min-h-[calc(100dvh-2rem)] sm:rounded-lg"
        exit={{ scale: 0.96, y: 28 }}
        initial={{ scale: 0.92, y: 46 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[radial-gradient(circle_at_18%_0%,rgba(91,242,255,0.24),transparent_38%),linear-gradient(135deg,rgba(3,17,31,0.96),rgba(3,17,31,0.86))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl sm:p-6 lg:p-8">
          <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <motion.div
                className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-md border border-aqua-200/25 bg-aqua-200/10 text-aqua-100 shadow-glow sm:inline-flex"
              >
                <Sparkles aria-hidden className="h-6 w-6" />
              </motion.div>
              <div className="min-w-0">
                <motion.h3 className="text-balance text-3xl font-semibold tracking-normal text-white sm:text-5xl">
                  {t(prediction.event)}
                </motion.h3>
                <motion.p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-aqua-100">
                  {prediction.course}
                </motion.p>
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <motion.div className="rounded-md bg-white/10 px-3 py-2 text-right text-xs font-semibold text-aqua-100">
                {prediction.confidence}%<br />
                <span className="text-white/58">{t("confidence")}</span>
              </motion.div>
              <button
                aria-label={t("Close")}
                className="ui-press relative z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/14 text-white hover:bg-white hover:text-stitch-abyss focus-visible:outline focus-visible:outline-2 focus-visible:outline-stitch-cyan"
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
          className="px-4 py-5 pb-28 sm:px-6 lg:px-8"
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
                  <PredictionHorizon
                    key={predictionKey}
                    label={t(label)}
                    range={prediction.likelyRanges[predictionKey]}
                    value={formatTime(prediction.predictedTimes[predictionKey])}
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InsightBlock label={t("Model confidence")} value={`${prediction.confidence}%`} />
                <InsightBlock label={t("Model source")} value={modelLabel} />
                <InsightBlock label={t("Data sufficiency")} value={t(prediction.model.dataSufficiency)} />
                <InsightBlock label={t("Data quality")} value={`${prediction.model.dataQuality.score}/100 · ${t(prediction.model.dataQuality.level)}`} />
                <InsightBlock label={t("Prediction eligibility")} value={t(prediction.model.dataQuality.decision)} />
                <InsightBlock label={t("Race history used")} value={`${prediction.model.historyUsed}/20`} />
                <InsightBlock label={t("Pool type")} value={prediction.course} />
                <InsightBlock label={t("Current time")} value={formatTime(prediction.currentTime)} />
                {prediction.model.validationMae !== undefined && <InsightBlock label={t("Cross-validated MAE")} value={`${prediction.model.validationMae.toFixed(2)}${t("s")}`} />}
                {prediction.model.trainingDatasetSize !== undefined && <InsightBlock label={t("Training rows")} value={prediction.model.trainingDatasetSize.toLocaleString()} />}
                {prediction.model.trainingDate && <InsightBlock label={t("Model training date")} value={prediction.model.trainingDate.slice(0, 10)} />}
              </div>
            </section>

            <section className="rounded-lg border border-aqua-200/16 bg-aqua-200/[0.07] p-4 sm:p-5 lg:col-span-2">
              <h4 className="text-base font-semibold text-white">{t("Data quality assessment")}</h4>
              <p className="mt-2 text-sm leading-6 text-white/70">{t(prediction.model.dataQuality.userExplanation)}</p>
            </section>

            {(prediction.model.outOfDistribution || prediction.model.sufficiencyChecklist.length > 0) && (
              <section className="rounded-lg border border-coral-200/16 bg-coral-200/[0.07] p-4 sm:p-5 lg:col-span-2">
                <h4 className="text-base font-semibold text-white">{t(prediction.model.outOfDistribution ? "Forecast limitations" : "Improve prediction quality")}</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[...prediction.model.outOfDistributionReasons, ...prediction.model.sufficiencyChecklist].map((item) => (
                    <div className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white/72" key={item}>{t(item)}</div>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-lg border border-white/12 bg-white/[0.06] p-4 sm:p-5 lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                <BrainCircuit aria-hidden className="h-5 w-5 text-aqua-100" />
                <div>
                  <h4 className="text-lg font-semibold text-white">{t("Why this prediction")}</h4>
                  <p className="mt-1 text-sm text-white/66">{t("These are model inputs and associations, not proof that one factor caused the result.")}</p>
                </div>
                </div>
                <span className="inline-flex w-fit rounded-full border border-aqua-200/20 bg-aqua-200/[0.08] px-3 py-1 text-xs font-semibold text-aqua-100">{t(explanation.method)}</span>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="grid gap-2 sm:grid-cols-2">
                {explanation.contributions.slice(0, 6).map((contribution) => (
                  <div className="rounded-md border border-white/10 bg-white/[0.07] p-3" key={contribution.label}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{t(contribution.label)}</span>
                      <span className={`font-mono text-sm font-semibold ${contribution.direction === "faster" ? "text-mint-200" : contribution.direction === "slower" ? "text-coral-100" : "text-white/60"}`}>
                        {contribution.secondsImpact > 0 ? "+" : ""}{contribution.secondsImpact.toFixed(2)}{t("s")}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/64">{t(contribution.detail)}</p>
                  </div>
                ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {probabilities.map(({ estimate, label }) => estimate && (
                    <div className="rounded-md border border-aqua-200/15 bg-aqua-200/[0.07] p-3" key={label}>
                      <div className="text-xs font-semibold text-white/60">{t(label)}</div>
                      <div className="mt-1 font-mono text-2xl font-semibold text-white">{estimate.probability.toFixed(1)}%</div>
                      <div className="mt-1 text-[11px] text-aqua-100">{t(estimate.calibration)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/48">{t(explanation.disclaimer)}</p>
            </section>

            <section className="rounded-lg border border-white/12 bg-[radial-gradient(circle_at_78%_22%,rgba(78,232,255,0.17),transparent_36%),rgba(255,255,255,0.055)] p-4 sm:p-5 lg:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-lg font-semibold text-white">{t("Forecast readout")}</h4>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-white/66">
                    {t("Predictions stay grounded and update as more official meet results are added.")}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-mint-300/20 bg-mint-300/10 px-3 py-1 text-sm font-semibold text-mint-100">
                  <CheckCircle2 aria-hidden className="h-4 w-4" />
                  {t("Ready")}
                </span>
              </div>
              <details className="mt-4 border-t border-white/10 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-aqua-100">{t("Model eligibility and features")}</summary>
                <div className="mt-3 grid gap-4 text-sm text-white/66 sm:grid-cols-2">
                  <div><div className="font-semibold text-white">{t("Eligibility rules")}</div><ul className="mt-2 space-y-1">{prediction.model.eligibilityRules.map((rule) => <li key={rule}>• {t(rule)}</li>)}</ul></div>
                  <div><div className="font-semibold text-white">{t("Features used")}</div><p className="mt-2 leading-6">{prediction.model.featuresUsed.map((feature) => t(feature)).join(", ")}</p></div>
                </div>
              </details>
            </section>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function PredictionProfileEditor({ profile, t }: { profile: PredictionProfile; t: (value: string) => string }) {
  const router = useRouter();
  const [age, setAge] = useState(profile.age?.toString() ?? "");
  const [sex, setSex] = useState<AthleteSex | "">(profile.sex ?? "");
  const [taperDays, setTaperDays] = useState(profile.taperDays?.toString() ?? "");
  const [frequency, setFrequency] = useState(profile.swimSessionsPerWeek?.toString() ?? "");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveProfile() {
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch("/api/me/prediction-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          age: age === "" ? null : Number(age),
          sex: sex || null,
          taperDays: taperDays === "" ? null : Number(taperDays),
          swimSessionsPerWeek: frequency === "" ? null : Number(frequency)
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(t(payload.error ?? "Could not save prediction profile."));
        return;
      }
      setStatus(t("Prediction inputs saved."));
      router.refresh();
    } catch {
      setStatus(t("Could not save prediction profile."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="mb-5 rounded-lg border border-white/12 bg-white/[0.07] p-4">
      <summary className="ui-press flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-left [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <Settings2 aria-hidden className="h-5 w-5 text-aqua-100" />
          <span>
            <span className="block text-sm font-semibold text-white">{t("100 Free prediction inputs")}</span>
            <span className="mt-1 block text-xs text-white/62">{t("Age, category, taper, training frequency, and up to 20 prior official races.")}</span>
          </span>
        </span>
        <span className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold text-aqua-100">{t("Edit")}</span>
      </summary>
      <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <PredictionField label={t("Age")}>
          <input className="h-10 w-full rounded-md border border-white/12 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" max={100} min={6} type="number" value={age} onChange={(event) => setAge(event.target.value)} />
        </PredictionField>
        <PredictionField label={t("Performance category")}>
          <select className="h-10 w-full rounded-md border border-white/12 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" value={sex} onChange={(event) => setSex(event.target.value as AthleteSex | "")}>
            <option value="">{t("Not set")}</option>
            <option value="FEMALE">{t("Female")}</option>
            <option value="MALE">{t("Male")}</option>
          </select>
        </PredictionField>
        <PredictionField label={t("Taper days")}>
          <input className="h-10 w-full rounded-md border border-white/12 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" max={28} min={0} type="number" value={taperDays} onChange={(event) => setTaperDays(event.target.value)} />
        </PredictionField>
        <PredictionField label={t("Swim sessions / week")}>
          <input className="h-10 w-full rounded-md border border-white/12 bg-stitch-abyss px-3 text-white outline-none focus:border-stitch-cyan" max={14} min={0} step={0.5} type="number" value={frequency} onChange={(event) => setFrequency(event.target.value)} />
        </PredictionField>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="ui-press inline-flex h-10 items-center gap-2 rounded-md bg-stitch-cyan px-4 text-sm font-semibold text-stitch-abyss disabled:opacity-60" disabled={saving} type="button" onClick={saveProfile}>
          <Save aria-hidden className="h-4 w-4" />
          {saving ? t("Saving") : t("Save inputs")}
        </button>
        {status && <p className="text-sm text-white/68" role="status">{status}</p>}
      </div>
    </details>
  );
}

function PredictionField({ children, label }: { children: ReactNode; label: string }) {
  return <label className="grid gap-2 text-xs font-semibold text-white/64"><span>{label}</span>{children}</label>;
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

function PredictionHorizon({ label, range, value }: { label: string; range: { low: number; high: number }; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.12] p-3">
      <div className="text-xs text-white/62">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold text-white">{value}</div>
      <div className="mt-1 font-mono text-[11px] text-aqua-100/78">{formatTime(range.low)}–{formatTime(range.high)}</div>
    </div>
  );
}

function predictionKey(prediction: Prediction) {
  return `${prediction.event}-${prediction.course}`;
}
