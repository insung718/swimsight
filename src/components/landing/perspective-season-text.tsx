"use client";

import { motion, useMotionTemplate, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
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
  const [isDesktop, setIsDesktop] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : isDesktop ? [240, -120] : [112, -56]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], reduceMotion ? [0, 0, 0] : isDesktop ? [28, 8, -8] : [12, 4, -4]);
  const opacity = useTransform(scrollYProgress, [0.08, 0.24, 0.84, 0.96], [0.3, 1, 1, 0.44]);
  const transform = useMotionTemplate`rotateX(${rotateX}deg) translateY(${y}px) translateZ(${isDesktop ? 10 : 0}px)`;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <section className="relative h-[120svh] overflow-hidden bg-[#f7fcff] text-[#101820] md:h-[180svh]" ref={ref}>
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(78,232,255,0.20),transparent_30rem),linear-gradient(180deg,#f7fcff,#e8f8ff)]" />
      <div className="sticky top-0 flex min-h-svh items-center justify-center overflow-hidden px-5 py-20" style={{ perspective: isDesktop ? "320px" : "620px", transformStyle: "preserve-3d" }}>
        <div className="absolute left-1/2 top-16 max-w-xs -translate-x-1/2 text-center">
          <p className="text-sm font-semibold text-cyan-700">{t("Season rules")}</p>
          <p className="mt-2 text-sm leading-6 text-black/54">{t("The dashboard stays calm because each signal has a place.")}</p>
        </div>
        <motion.div
          className="w-full max-w-[calc(100vw-2.5rem)] text-center text-[clamp(2.15rem,10vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.025em] text-[#04111d] sm:max-w-5xl sm:text-6xl sm:leading-[1.02] sm:tracking-[-0.03em] lg:text-7xl"
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
