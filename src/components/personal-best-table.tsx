"use client";

import { Trophy } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { formatDate, formatTime } from "@/lib/utils";
import type { PersonalBest } from "@/types/swim";

export function PersonalBestTable({ personalBests }: { personalBests: PersonalBest[] }) {
  const { language, t } = useTranslator();

  return (
    <section className="dashboard-glass min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-coral-400/10 text-coral-500">
          <Trophy aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Personal Bests")}</h2>
          <p className="text-sm text-white/74">{t("Current PB and PB-to-PB gains")}</p>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/15 text-xs uppercase text-white/72">
              <th className="py-3 pr-3 font-semibold">{t("Event")}</th>
              <th className="px-3 py-3 font-semibold">{t("Current PB")}</th>
              <th className="px-3 py-3 font-semibold">{t("Date")}</th>
              <th className="px-3 py-3 font-semibold">{t("Previous PB")}</th>
              <th className="py-3 pl-3 font-semibold">{t("Improvement")}</th>
            </tr>
          </thead>
          <tbody>
            {personalBests.map((pb) => (
              <tr key={`${pb.event}-${pb.course}`} className="border-b border-white/10 last:border-0">
                <td className="py-3 pr-3 font-semibold text-white">{t(pb.event)} <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-aqua-100">{pb.course}</span></td>
                <td className="px-3 py-3 text-white/80">{formatTime(pb.currentPb)}</td>
                <td className="px-3 py-3 text-white/80">{formatDate(pb.dateAchieved, language)}</td>
                <td className="px-3 py-3 text-white/80">
                  {pb.previousPb ? formatTime(pb.previousPb) : t("First swim")}
                </td>
                <td className="py-3 pl-3 font-semibold text-mint-500">
                  {pb.improvementSeconds > 0 ? `${formatTime(pb.improvementSeconds)} (${pb.improvementPercent}%)` : t("Baseline")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
