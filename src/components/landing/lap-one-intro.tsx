"use client";

import { ArrowDown } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";

export function LapOneIntro() {
  const { t } = useTranslator();

  return (
    <section className="relative flex h-svh min-h-[520px] items-center justify-center overflow-hidden bg-[#050505] text-white">
      <h1 aria-label={t("lap one")} className="lap-one-switcher">
        <span aria-hidden className="lap-one-word lap-one-word-a">{t("one day")}</span>
        <span aria-hidden className="lap-one-word lap-one-word-b">{t("lap one")}</span>
      </h1>

      <a
        aria-label={t("Explore SwimSight")}
        className="ui-press absolute bottom-7 left-1/2 inline-flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/18 text-white/52 hover:border-white/40 hover:bg-white/10 hover:text-white"
        href="#predict"
      >
        <ArrowDown aria-hidden className="h-4 w-4" />
      </a>
    </section>
  );
}
