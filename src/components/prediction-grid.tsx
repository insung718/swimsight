import { CalendarClock, Sparkles, TrendingDown } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { Prediction } from "@/types/swim";

const horizonLabels = [
  ["30 days", "days30"],
  ["90 days", "days90"],
  ["180 days", "days180"],
  ["365 days", "days365"]
] as const;

export function PredictionGrid({ predictions }: { predictions: Prediction[] }) {
  const sortedPredictions = [...predictions].sort((a, b) => b.confidence - a.confidence);
  const bestForecast = sortedPredictions
    .map((prediction) => ({
      event: prediction.event,
      improvement: prediction.currentTime - prediction.predictedTimes.days365
    }))
    .sort((a, b) => b.improvement - a.improvement)[0];

  return (
    <section className="dashboard-glass min-w-0 overflow-hidden p-4 lg:p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-mint-400/10 text-mint-400">
          <CalendarClock aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">Predictions</h2>
            <p className="text-sm text-white/74">30, 90, 180, and 365 day projections for every event you log</p>
          </div>
        </div>
        {bestForecast && bestForecast.improvement > 0 && (
          <div className="rounded-lg border border-mint-400/20 bg-mint-400/10 px-4 py-3 text-sm text-mint-100">
            <div className="flex items-center gap-2 font-semibold">
              <TrendingDown aria-hidden className="h-4 w-4" />
              Best 365d forecast
            </div>
            <p className="mt-1 text-mint-100/80">
              {bestForecast.event}: {bestForecast.improvement.toFixed(2)}s faster
            </p>
          </div>
        )}
      </div>

      {sortedPredictions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/14 bg-white/8 p-6 text-sm leading-6 text-white/76">
          Add a swim result to unlock a first prediction. Add a second result in the same event and SwimSight starts fitting a real regression line.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sortedPredictions.map((prediction) => {
            const confidenceTone = prediction.confidence >= 70 ? "text-mint-200" : prediction.confidence >= 45 ? "text-aqua-100" : "text-coral-100";
            const delta365 = prediction.currentTime - prediction.predictedTimes.days365;

            return (
          <article className="premium-hover rounded-lg border border-white/15 bg-white/10 p-3" key={prediction.event}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{prediction.event}</h3>
                <p className="mt-1 text-sm text-white/74">
                  Current {formatTime(prediction.currentTime)}
                </p>
              </div>
              <span className={`rounded-md bg-stitch-abyss px-2.5 py-1 text-xs font-semibold ${confidenceTone}`}>
                {prediction.confidence}% confidence
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.08] px-3 py-2 text-xs text-white/70">
              <Sparkles aria-hidden className="h-4 w-4 text-aqua-200" />
              {delta365 > 0 ? `${delta365.toFixed(2)}s projected improvement in 365 days` : "Stable projection until more history is added"}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {horizonLabels.map(([label, key]) => (
                <div className="rounded-md bg-white/[0.12] p-2" key={key}>
                  <div className="text-xs text-white/72">{label}</div>
                  <div className="mt-1 font-bold text-white">
                    {formatTime(prediction.predictedTimes[key])}
                  </div>
                </div>
              ))}
            </div>
          </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
