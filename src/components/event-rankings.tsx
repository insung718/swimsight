import { Activity, ArrowDown, ArrowUp } from "lucide-react";
import type { EventRanking } from "@/types/swim";

interface EventRankingsProps {
  strongestEvents: EventRanking[];
  weakestEvents: EventRanking[];
}

function RankingList({
  title,
  rankings,
  icon: Icon
}: {
  title: string;
  rankings: EventRanking[];
  icon: typeof ArrowUp;
}) {
  return (
    <div className="rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-aqua-50 text-aqua-600 dark:bg-aqua-400/10 dark:text-aqua-100">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold text-navy-950 dark:text-white">{title}</h2>
      </div>
      <div className="space-y-3">
        {rankings.map((ranking, index) => (
          <article
            className="rounded-lg border border-navy-50 p-3 dark:border-white/10"
            key={ranking.event}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-navy-950 dark:text-white">
                  {index + 1}. {ranking.event}
                </p>
                <p className="mt-1 text-xs text-navy-500 dark:text-navy-100">
                  {ranking.trend} · {ranking.improvementPercent}% improvement
                </p>
              </div>
              <span className="text-lg font-bold text-aqua-600 dark:text-aqua-100">
                {ranking.score}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-navy-50 dark:bg-white/10">
              <div
                className="h-2 rounded-full bg-aqua-500"
                style={{ width: `${Math.min(ranking.score, 100)}%` }}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function EventRankings({ strongestEvents, weakestEvents }: EventRankingsProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-navy-100 bg-navy-950 p-4 text-white shadow-panel dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-aqua-400 text-navy-950">
            <Activity aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Event Ranking Model</h2>
            <p className="text-sm text-navy-100">Improvement, consistency, and recent trend</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md bg-white/[0.08] p-3">
            <div className="text-xl font-bold">40%</div>
            <div className="mt-1 text-xs text-navy-100">Improvement</div>
          </div>
          <div className="rounded-md bg-white/[0.08] p-3">
            <div className="text-xl font-bold">30%</div>
            <div className="mt-1 text-xs text-navy-100">Consistency</div>
          </div>
          <div className="rounded-md bg-white/[0.08] p-3">
            <div className="text-xl font-bold">30%</div>
            <div className="mt-1 text-xs text-navy-100">Trend</div>
          </div>
        </div>
      </div>
      <RankingList icon={ArrowUp} rankings={strongestEvents} title="Top Strengths" />
      <RankingList icon={ArrowDown} rankings={weakestEvents} title="Priority Events" />
    </section>
  );
}
