import { Trophy } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import type { PersonalBest } from "@/types/swim";

export function PersonalBestTable({ personalBests }: { personalBests: PersonalBest[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04] lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-coral-400/10 text-coral-500">
          <Trophy aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Personal Bests</h2>
          <p className="text-sm text-navy-500 dark:text-navy-100">Current PB and PB-to-PB gains</p>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs uppercase text-navy-500 dark:border-white/10 dark:text-navy-100">
              <th className="py-3 pr-3 font-semibold">Event</th>
              <th className="px-3 py-3 font-semibold">Current PB</th>
              <th className="px-3 py-3 font-semibold">Date</th>
              <th className="px-3 py-3 font-semibold">Previous PB</th>
              <th className="py-3 pl-3 font-semibold">Improvement</th>
            </tr>
          </thead>
          <tbody>
            {personalBests.map((pb) => (
              <tr key={pb.event} className="border-b border-navy-50 last:border-0 dark:border-white/10">
                <td className="py-3 pr-3 font-semibold text-navy-950 dark:text-white">{pb.event}</td>
                <td className="px-3 py-3 text-navy-700 dark:text-navy-100">{formatTime(pb.currentPb)}</td>
                <td className="px-3 py-3 text-navy-700 dark:text-navy-100">{formatDate(pb.dateAchieved)}</td>
                <td className="px-3 py-3 text-navy-700 dark:text-navy-100">
                  {pb.previousPb ? formatTime(pb.previousPb) : "First swim"}
                </td>
                <td className="py-3 pl-3 font-semibold text-mint-500">
                  {pb.improvementSeconds > 0 ? `${formatTime(pb.improvementSeconds)} (${pb.improvementPercent}%)` : "Baseline"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
