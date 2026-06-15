import { CalendarClock } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { Prediction } from "@/types/swim";

const horizonLabels = [
  ["30 days", "days30"],
  ["90 days", "days90"],
  ["180 days", "days180"],
  ["365 days", "days365"]
] as const;

export function PredictionGrid({ predictions }: { predictions: Prediction[] }) {
  const featured = predictions.filter((prediction) =>
    ["50 Freestyle", "50 Butterfly", "100 Butterfly", "100 Freestyle"].includes(prediction.event)
  );

  return (
    <section className="min-w-0 rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04] lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-mint-400/10 text-mint-500">
          <CalendarClock aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Predictions</h2>
          <p className="text-sm text-navy-500 dark:text-navy-100">Regression-based future times</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {featured.map((prediction) => (
          <article className="rounded-lg border border-navy-50 p-3 dark:border-white/10" key={prediction.event}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-navy-950 dark:text-white">{prediction.event}</h3>
                <p className="mt-1 text-sm text-navy-500 dark:text-navy-100">
                  Current {formatTime(prediction.currentTime)}
                </p>
              </div>
              <span className="rounded-md bg-aqua-50 px-2.5 py-1 text-xs font-semibold text-aqua-600 dark:bg-aqua-400/10 dark:text-aqua-100">
                {prediction.confidence}% confidence
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {horizonLabels.map(([label, key]) => (
                <div className="rounded-md bg-navy-50 p-2 dark:bg-white/[0.08]" key={key}>
                  <div className="text-xs text-navy-500 dark:text-navy-100">{label}</div>
                  <div className="mt-1 font-bold text-navy-950 dark:text-white">
                    {formatTime(prediction.predictedTimes[key])}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
