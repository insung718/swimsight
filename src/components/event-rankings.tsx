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
    <div className="dashboard-glass p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-3">
        {rankings.map((ranking, index) => (
          <article
            className="premium-hover rounded-lg border border-white/15 bg-white/10 p-3"
            key={`${ranking.event}-${ranking.course}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">
                  {index + 1}. {ranking.event} <span className="ml-1 font-mono text-xs text-aqua-100">{ranking.course}</span>
                </p>
                <p className="mt-1 text-xs text-white/74">
                  {ranking.trend} · {ranking.improvementPercent}% improvement
                </p>
              </div>
              <span className="text-lg font-bold text-stitch-cyan">
                {ranking.score}
              </span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-stitch-cyan transition-all duration-700"
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
      <div className="dashboard-glass p-4 text-white">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow">
            <Activity aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Event Ranking Model</h2>
            <p className="text-sm text-white/76">Improvement, consistency, and recent trend</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md bg-white/[0.12] p-3">
            <div className="text-xl font-bold">40%</div>
            <div className="mt-1 text-xs text-white/74">Improvement</div>
          </div>
          <div className="rounded-md bg-white/[0.12] p-3">
            <div className="text-xl font-bold">30%</div>
            <div className="mt-1 text-xs text-white/74">Consistency</div>
          </div>
          <div className="rounded-md bg-white/[0.12] p-3">
            <div className="text-xl font-bold">30%</div>
            <div className="mt-1 text-xs text-white/74">Trend</div>
          </div>
        </div>
      </div>
      <RankingList icon={ArrowUp} rankings={strongestEvents} title="Top Strengths" />
      <RankingList icon={ArrowDown} rankings={weakestEvents} title="Priority Events" />
    </section>
  );
}
