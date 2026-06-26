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
    <section className="dashboard-glass min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-mint-400/10 text-mint-500">
          <CalendarClock aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">Predictions</h2>
          <p className="text-sm text-white/55">Regression-based future times</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {featured.map((prediction) => (
          <article className="premium-hover rounded-lg border border-white/15 bg-white/[0.08] p-3" key={prediction.event}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{prediction.event}</h3>
                <p className="mt-1 text-sm text-white/52">
                  Current {formatTime(prediction.currentTime)}
                </p>
              </div>
              <span className="rounded-md bg-stitch-abyss px-2.5 py-1 text-xs font-semibold text-stitch-cyan">
                {prediction.confidence}% confidence
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {horizonLabels.map(([label, key]) => (
                <div className="rounded-md bg-white/[0.12] p-2" key={key}>
                  <div className="text-xs text-white/50">{label}</div>
                  <div className="mt-1 font-bold text-white">
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
