"use client";

import { motion, useMotionTemplate, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useTranslator } from "@/components/i18n/use-language";

const seasonStatements = [
  "Official times stay official.",
  "Training times stay separate.",
  "Goals keep the pace honest.",
  "Predictions stay conservative.",
  "Coach views require consent.",
  "Progress becomes easier to trust."
] as const;

export function PerspectiveSeasonText() {
  const { t } = useTranslator();
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [240, -120]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], reduceMotion ? [0, 0, 0] : [28, 8, -8]);
  const opacity = useTransform(scrollYProgress, [0.08, 0.24, 0.84, 0.96], [0.3, 1, 1, 0.44]);
  const transform = useMotionTemplate`rotateX(${rotateX}deg) translateY(${y}px) translateZ(10px)`;

  return (
    <section className="relative h-[180svh] overflow-hidden bg-[#f7fcff] text-[#101820]" ref={ref}>
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(78,232,255,0.20),transparent_30rem),linear-gradient(180deg,#f7fcff,#e8f8ff)]" />
      <div className="sticky top-0 flex min-h-svh items-center justify-center px-5 py-20" style={{ perspective: "320px", transformStyle: "preserve-3d" }}>
        <div className="absolute left-1/2 top-16 max-w-xs -translate-x-1/2 text-center">
          <p className="text-sm font-semibold text-cyan-700">{t("Season rules")}</p>
          <p className="mt-2 text-sm leading-6 text-black/54">{t("The dashboard stays calm because each signal has a place.")}</p>
        </div>
        <motion.div
          className="max-w-5xl text-center text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-[#04111d] sm:text-6xl lg:text-7xl"
          style={{ opacity, transform, transformStyle: "preserve-3d" }}
        >
          {seasonStatements.map((statement) => (
            <div className="py-2" key={statement}>
              {t(statement)}
            </div>
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38svh] bg-gradient-to-b from-transparent to-[#f7fcff]" />
        </motion.div>
      </div>
    </section>
  );
}
