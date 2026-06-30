"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useTranslator } from "@/components/i18n/use-language";

export function StrokeProgressSection() {
  const { t } = useTranslator();
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const pathLength = useTransform(scrollYProgress, [0.12, 0.76], reduceMotion ? [1, 1] : [0.05, 1]);
  const cardY = useTransform(scrollYProgress, [0.2, 0.78], reduceMotion ? [0, 0] : [46, -34]);

  return (
    <section className="relative overflow-hidden bg-[#04111d] text-white" ref={ref}>
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(78,232,255,0.20),transparent_28rem),linear-gradient(180deg,#04111d,#020811)]" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-5 lg:min-h-[130svh] lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-10 lg:py-32">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm font-semibold text-aqua-200">{t("Stroke path")}</p>
          <h2 className="mt-4 text-balance text-[2.75rem] font-semibold leading-[0.98] sm:mt-5 sm:text-6xl lg:text-7xl">
            {t("Every entry draws the next lane.")}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/72 sm:mt-6 sm:text-lg sm:leading-8">
            {t("A race result becomes a line: first the baseline, then the trend, then the goal you can actually chase.")}
          </p>
        </div>

        <motion.div
          className="relative min-h-[560px] overflow-hidden rounded-lg border border-white/14 bg-white/[0.06] shadow-[0_50px_160px_rgba(0,190,230,0.16)] backdrop-blur-2xl sm:min-h-[520px]"
          style={{ y: cardY }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:100%_78px,12.5%_100%]" />
          <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 900 560">
            <defs>
              <filter id="strokePathGlow">
                <feGaussianBlur stdDeviation="5" />
              </filter>
              <linearGradient id="strokePathGradient" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#22c9e8" stopOpacity="0.2" />
                <stop offset="48%" stopColor="#85f6ff" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#49d7a6" stopOpacity="0.88" />
              </linearGradient>
            </defs>
            <motion.path
              d="M54 430 C118 342 180 376 238 292 C308 190 398 248 462 164 C540 60 636 116 702 210 C760 292 805 216 850 106"
              fill="none"
              filter="url(#strokePathGlow)"
              stroke="#22c9e8"
              strokeLinecap="round"
              strokeWidth="24"
              style={{ pathLength }}
            />
            <motion.path
              d="M54 430 C118 342 180 376 238 292 C308 190 398 248 462 164 C540 60 636 116 702 210 C760 292 805 216 850 106"
              fill="none"
              stroke="url(#strokePathGradient)"
              strokeLinecap="round"
              strokeWidth="5"
              style={{ pathLength }}
            />
            {[{ x: 54, y: 430 }, { x: 238, y: 292 }, { x: 462, y: 164 }, { x: 702, y: 210 }, { x: 850, y: 106 }].map((point, index) => (
              <motion.g key={`${point.x}-${point.y}`} style={{ opacity: pathLength }}>
                <circle cx={point.x} cy={point.y} fill="#f6feff" r="9" />
                <circle cx={point.x} cy={point.y} fill="transparent" r={index === 4 ? "26" : "20"} stroke="rgba(78,232,255,0.48)" strokeWidth="2" />
              </motion.g>
            ))}
          </svg>
          <div className="absolute bottom-3 left-3 right-3 grid gap-2 sm:bottom-4 sm:left-4 sm:right-4 sm:gap-3 sm:grid-cols-3">
            {[
              ["01", "Baseline", "First official result"],
              ["02", "Signal", "Trend and consistency"],
              ["03", "Target", "Forecast with context"]
            ].map(([number, title, body]) => (
              <article className="rounded-lg border border-white/12 bg-[#03111f]/82 p-3 backdrop-blur-xl sm:p-4" key={title}>
                <p className="font-mono text-base font-semibold text-aqua-200 sm:text-lg">{number}</p>
                <h3 className="mt-2 font-semibold text-white sm:mt-3">{t(title)}</h3>
                <p className="mt-1 text-xs leading-5 text-white/64 sm:text-sm">{t(body)}</p>
              </article>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
