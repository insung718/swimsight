"use client";

import { ArrowRight, type LucideIcon } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { useTranslator } from "@/components/i18n/use-language";
import { Reveal } from "@/components/landing/reveal";
import { SiteNav } from "@/components/landing/site-nav";

interface SitePageSection {
  eyebrow: string;
  title: string;
  body: string;
  icon: LucideIcon;
}

interface SitePageProps {
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
  sections: SitePageSection[];
}

export function SitePage({ eyebrow, title, body, accent, sections }: SitePageProps) {
  const { t } = useTranslator();

  return (
    <main className="landing-page min-h-screen select-none bg-[#f5f5f7] text-[#1d1d1f]">
      <SiteNav />
      <section className="site-page-hero relative overflow-hidden bg-[#03070e] pt-28 text-white">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_70%_24%,rgba(78,232,255,0.24),transparent_31%),linear-gradient(90deg,rgba(3,7,14,0.98),rgba(3,7,14,0.78)_52%,rgba(3,7,14,0.95))]" />
        <div aria-hidden className="absolute inset-x-0 top-16 text-center text-[clamp(4rem,17vw,16rem)] font-semibold leading-none text-white/[0.045]">
          SWIMSIGHT
        </div>
        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-8 sm:pb-28">
          <Reveal>
            <p className="text-sm font-semibold text-cyan-200">{t(eyebrow)}</p>
            <h1 className="mt-5 max-w-5xl text-balance text-5xl font-semibold leading-[0.98] sm:text-7xl lg:text-[88px]">
              {t(title)}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/74 sm:text-xl">{t(body)}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <UserActions hero />
              <a className="ui-press inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-white hover:bg-white hover:text-black" href="/">
                {t("Back home")} <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <section className={`site-page-cards bg-gradient-to-b ${accent} py-20 sm:py-28`}>
        <div className="mx-auto grid max-w-6xl gap-4 px-5 lg:grid-cols-3">
          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <Reveal delay={index * 80} key={section.title}>
                <article className="ui-lift min-h-[320px] rounded-lg border border-white/75 bg-white/72 p-6 shadow-[0_24px_72px_rgba(4,17,29,0.08)] backdrop-blur-2xl hover:bg-white">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-black text-cyan-300">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <p className="mt-8 text-sm font-semibold text-cyan-800">{t(section.eyebrow)}</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-normal">{t(section.title)}</h2>
                  <p className="mt-5 leading-7 text-black/68">{t(section.body)}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </section>
    </main>
  );
}
