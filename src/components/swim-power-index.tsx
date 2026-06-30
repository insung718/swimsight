"use client";

import { Gauge } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import type { SwimPowerIndex } from "@/types/swim";

export function SwimPowerIndexPanel({ spi }: { spi: SwimPowerIndex }) {
  const { t } = useTranslator();

  return (
    <section className="dashboard-glass premium-hover p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md bg-stitch-abyss px-2.5 py-1 text-xs font-bold text-stitch-cyan shadow-glow">
            <Gauge aria-hidden className="h-4 w-4" />
            {t("SPI")}
          </div>
          <h2 className="mt-4 text-2xl font-bold">{t("Swim Power Index")}</h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-white/76">
            {t("Speed, improvement, consistency, and event difficulty compressed into one proprietary read.")}
          </p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-black">{spi.score}</div>
          <div className="mt-1 text-sm font-semibold text-stitch-cyan">{t(spi.level)}</div>
        </div>
      </div>
      <div className="mt-5 h-3 rounded-full bg-white/[0.12]">
        <div className="h-3 rounded-full bg-stitch-cyan shadow-glow transition-all duration-700" style={{ width: `${spi.score}%` }} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-white/74">
        <span>{t("Developing")}</span>
        <span>{t("Competitive")}</span>
        <span>{t("Elite")}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] uppercase tracking-[0.12em] text-white/52">
        <span>{t("45% speed")}</span>
        <span>{t("20% improvement")}</span>
        <span>{t("35% stability")}</span>
      </div>
    </section>
  );
}
