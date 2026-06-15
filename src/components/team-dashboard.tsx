import { Users } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { TeamMemberAnalytics } from "@/types/swim";

export function TeamDashboard({ members }: { members: TeamMemberAnalytics[] }) {
  const mostImproved = [...members].sort(
    (a, b) => b.totalImprovementPercent - a.totalImprovementPercent
  )[0];
  const fastest = [...members].sort((a, b) => a.fastestEventTime - b.fastestEventTime)[0];

  return (
    <section className="min-w-0 rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04] lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-aqua-50 text-aqua-600 dark:bg-aqua-400/10 dark:text-aqua-100">
          <Users aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">BIS HCMC Swim Team</h2>
          <p className="text-sm text-navy-500 dark:text-navy-100">Leaderboard and team progress</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-navy-950 p-4 text-white dark:bg-white/[0.08]">
          <div className="text-sm text-navy-100">Team size</div>
          <div className="mt-2 text-3xl font-bold">{members.length}</div>
        </div>
        <div className="rounded-lg bg-mint-400/10 p-4">
          <div className="text-sm text-navy-600 dark:text-navy-100">Most improved</div>
          <div className="mt-2 text-lg font-bold text-navy-950 dark:text-white">{mostImproved.name}</div>
          <div className="mt-1 text-sm font-semibold text-mint-500">
            {mostImproved.totalImprovementPercent}% total gain
          </div>
        </div>
        <div className="rounded-lg bg-aqua-50 p-4 dark:bg-aqua-400/10">
          <div className="text-sm text-navy-600 dark:text-navy-100">Fastest swimmer</div>
          <div className="mt-2 text-lg font-bold text-navy-950 dark:text-white">{fastest.name}</div>
          <div className="mt-1 text-sm font-semibold text-aqua-600 dark:text-aqua-100">
            {formatTime(fastest.fastestEventTime)}
          </div>
        </div>
      </div>

      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 text-xs uppercase text-navy-500 dark:border-white/10 dark:text-navy-100">
              <th className="py-3 pr-3 font-semibold">Athlete</th>
              <th className="px-3 py-3 font-semibold">Primary Event</th>
              <th className="px-3 py-3 font-semibold">SPI</th>
              <th className="px-3 py-3 font-semibold">Improvement</th>
              <th className="py-3 pl-3 font-semibold">Fastest Time</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr className="border-b border-navy-50 last:border-0 dark:border-white/10" key={member.id}>
                <td className="py-3 pr-3">
                  <div className="font-semibold text-navy-950 dark:text-white">{member.name}</div>
                  <div className="text-xs text-navy-500 dark:text-navy-100">
                    Age {member.age} · {member.role}
                  </div>
                </td>
                <td className="px-3 py-3 text-navy-700 dark:text-navy-100">{member.primaryEvent}</td>
                <td className="px-3 py-3 font-semibold text-aqua-600 dark:text-aqua-100">
                  {member.swimPowerIndex}
                </td>
                <td className="px-3 py-3 text-mint-500">{member.totalImprovementPercent}%</td>
                <td className="py-3 pl-3 text-navy-700 dark:text-navy-100">
                  {formatTime(member.fastestEventTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
