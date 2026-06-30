"use client";

import { Users } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { formatTime } from "@/lib/utils";
import type { TeamMemberAnalytics } from "@/types/swim";

export function TeamDashboard({ members }: { members: TeamMemberAnalytics[] }) {
  const { t } = useTranslator();
  const mostImproved = [...members].sort(
    (a, b) => b.totalImprovementPercent - a.totalImprovementPercent
  )[0];
  const fastest = [...members].sort((a, b) => a.fastestEventTime - b.fastestEventTime)[0];

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-stitch-cyan/10 text-stitch-cyan">
          <Users aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">{t("BIS HCMC Swim Team")}</h2>
          <p className="text-sm text-white/70">{t("Leaderboard and team progress")}</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-white/15 bg-white/10 p-4 text-white">
          <div className="text-sm text-white/72">{t("Team size")}</div>
          <div className="mt-2 text-3xl font-bold">{members.length}</div>
        </div>
        <div className="rounded-lg border border-white/15 bg-white/10 p-4">
          <div className="text-sm text-white/72">{t("Most improved")}</div>
          <div className="mt-2 text-lg font-bold text-white">{mostImproved.name}</div>
          <div className="mt-1 text-sm font-semibold text-mint-500">
            {mostImproved.totalImprovementPercent}% {t("total gain")}
          </div>
        </div>
        <div className="rounded-lg border border-white/15 bg-white/10 p-4">
          <div className="text-sm text-white/72">{t("Fastest swimmer")}</div>
          <div className="mt-2 text-lg font-bold text-white">{fastest.name}</div>
          <div className="mt-1 text-sm font-semibold text-stitch-cyan">
            {formatTime(fastest.fastestEventTime)}
          </div>
        </div>
      </div>

      <div className="mt-4 max-w-full overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/15 text-xs uppercase text-white/70">
              <th className="py-3 pr-3 font-semibold">{t("Athlete")}</th>
              <th className="px-3 py-3 font-semibold">{t("Primary Event")}</th>
              <th className="px-3 py-3 font-semibold">{t("SPI")}</th>
              <th className="px-3 py-3 font-semibold">{t("Improvement")}</th>
              <th className="py-3 pl-3 font-semibold">{t("Fastest Time")}</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr className="border-b border-white/10 last:border-0" key={member.id}>
                <td className="py-3 pr-3">
                  <div className="font-semibold text-white">{member.name}</div>
                  <div className="text-xs text-white/70">
                    {t("Age")} {member.age} · {t(member.role)}
                  </div>
                </td>
                <td className="px-3 py-3 text-white/72">{t(member.primaryEvent)}</td>
                <td className="px-3 py-3 font-semibold text-stitch-cyan">
                  {member.swimPowerIndex}
                </td>
                <td className="px-3 py-3 text-mint-500">{member.totalImprovementPercent}%</td>
                <td className="py-3 pl-3 text-white/72">
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
