"use client";

import { Activity, ArrowRight, ShieldCheck, Trophy, Users } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { UserActions } from "@/components/auth/user-actions";
import { useTranslator } from "@/components/i18n/use-language";

export function LapOneIntro() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { t } = useTranslator();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const ghostTitle = t("One Lap, One Signal");
  const [ghostLineOne, ...ghostRest] = ghostTitle.split(",");
  const ghostLineTwo = ghostRest.join(",").trim();

  const introOpacity = useTransform(scrollYProgress, [0, 0.18, 0.34], [1, 1, 0]);
  const heroOpacity = useTransform(scrollYProgress, [0.2, 0.44], [0, 1]);
  const heroScale = useTransform(scrollYProgress, [0.2, 0.82], [1.06, 1]);
  const ghostY = useTransform(scrollYProgress, [0.22, 0.92], ["7%", "-5%"]);
  const contentY = useTransform(scrollYProgress, [0.25, 0.6], ["18%", "0%"]);

  return (
    <section ref={sectionRef} className="relative h-[225svh] overflow-clip bg-[#050505] text-white">
      <div className="sticky top-0 h-svh min-h-[620px] overflow-hidden">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#050505]"
          style={reduceMotion ? { opacity: 0 } : { opacity: introOpacity }}
        >
          <span className="lap-one-switcher">
            <span className="lap-one-word lap-one-word-a">{t("one day")}</span>
            <span className="lap-one-word lap-one-word-b">{t("lap one")}</span>
          </span>
        </motion.div>

        <motion.div
          className="absolute inset-0 z-10"
          style={reduceMotion ? { opacity: 1, scale: 1 } : { opacity: heroOpacity, scale: heroScale }}
        >
          <div aria-hidden className="lap-one-bg absolute inset-0 bg-[url('/images/swimsight-pool-hero.jpg')] bg-cover bg-center" />
          <video
            aria-hidden
            autoPlay
            className="lap-one-video absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
            loop
            muted
            playsInline
            poster="/images/swimsight-pool-hero.jpg"
            preload="metadata"
          >
            <source src="/videos/lap-one-swim.mp4" type="video/mp4" />
          </video>
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,14,0.88),rgba(3,7,14,0.42)_48%,rgba(3,7,14,0.72)),linear-gradient(180deg,rgba(3,7,14,0.20),rgba(3,7,14,0.82))]" />
          <div aria-hidden className="absolute inset-0 backdrop-blur-[1.5px]" />

          <div className="hero-recruit-stack pointer-events-none absolute right-5 top-[18svh] z-20 hidden w-[min(26vw,360px)] gap-3 lg:grid">
            {[
              [Trophy, "Race proof", "Official meet results only"],
              [Users, "Coach-ready", "Private club reports"],
              [ShieldCheck, "Private by default", "Account-scoped data"]
            ].map(([Icon, title, body], index) => {
              const StackIcon = Icon as typeof Trophy;
              return (
                <div className="hero-recruit-chip" key={title as string} style={{ animationDelay: `${index * 120}ms` }}>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-cyan-200 text-[#04111d]">
                    <StackIcon aria-hidden className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <strong>{t(title as string)}</strong>
                    <small>{t(body as string)}</small>
                  </span>
                </div>
              );
            })}
          </div>

          <motion.div
            aria-hidden
            className="absolute right-[-12vw] top-[8svh] max-w-[1000px] text-right text-[clamp(5.2rem,14vw,14rem)] font-semibold leading-[0.82] tracking-normal text-white/[0.16] sm:right-[-4vw]"
            style={reduceMotion ? undefined : { y: ghostY }}
          >
            {ghostLineOne}
            {ghostLineTwo ? <><br />{ghostLineTwo}</> : null}
          </motion.div>

          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto flex max-w-6xl flex-col justify-end gap-5 px-4 pb-5 pt-24 sm:gap-7 sm:px-5 sm:pb-12 lg:min-h-[62svh] lg:flex-row lg:items-end lg:justify-between"
            style={reduceMotion ? undefined : { y: contentY }}
          >
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-white/12 px-3 py-1 text-sm font-semibold text-cyan-100 backdrop-blur-2xl">
                <Activity aria-hidden className="h-4 w-4" />
                {t("Swim intelligence. Lap one.")}
              </p>
              <h1 className="mt-5 text-balance text-[2.48rem] font-semibold leading-[0.96] tracking-normal sm:text-7xl sm:leading-[0.92] lg:text-[92px]">
                {t("Start the season you keep saying you will.")}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/76 sm:text-xl">
                {t("One result becomes the first signal. Then SwimSight turns the rest into progress, goals, and a clearer next move.")}
              </p>
              <a className="ui-press mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-semibold text-white hover:bg-white hover:text-black sm:hidden" href="#predict">
                {t("See SwimSight")} <ArrowRight aria-hidden className="h-4 w-4" />
              </a>
              <div className="mt-6 grid max-w-xl grid-cols-3 gap-2 sm:hidden">
                {["Race proof", "Age-aware", "Private"].map((label) => (
                  <div className="rounded-lg border border-white/14 bg-white/[0.09] p-3 text-center backdrop-blur-xl" key={label}>
                    <div className="text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-cyan-100/74">{t(label)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden w-full max-w-xl rounded-lg border border-white/18 bg-[#07121d]/72 p-2.5 shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:block sm:p-4 lg:w-[min(48vw,540px)]">
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-cyan-100/82 sm:text-xs">
                    <span className="rounded-md bg-white/10 px-2 py-1">{t("first lap")}</span>
                    <span>{t("empty dashboard")}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white sm:mt-3 sm:text-xl">{t("Add your first time. Let the system wake up.")}</p>
                </div>
                <ArrowRight aria-hidden className="hidden h-5 w-5 text-cyan-200 sm:block" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <UserActions hero />
                <a className="ui-press inline-flex h-9 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-semibold text-white hover:bg-white hover:text-black sm:h-11 sm:px-5" href="#predict">
                  {t("See SwimSight")} <ArrowRight aria-hidden className="h-4 w-4" />
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
