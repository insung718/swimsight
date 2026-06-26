"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const phrases = ["PB DETECTED", "PACE REQUIRED", "TREND RISING", "NEXT MEET", "SPI 88", "LANE DATA"];

export function KineticRibbon() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x = useTransform(scrollYProgress, [0, 1], reduceMotion ? ["0%", "0%"] : ["0%", "-28%"]);

  return (
    <div className="overflow-hidden border-y border-white/10 bg-[#03070e] py-4 text-white" ref={ref}>
      <motion.div className="flex w-max gap-4 whitespace-nowrap" style={{ x }}>
        {Array.from({ length: 4 }).flatMap((_, groupIndex) =>
          phrases.map((phrase) => (
            <span
              className="rounded-full border border-white/14 bg-white/[0.06] px-5 py-2 font-mono text-xs font-semibold tracking-[0.16em] text-aqua-100/82 backdrop-blur-xl"
              key={`${groupIndex}-${phrase}`}
            >
              {phrase}
            </span>
          ))
        )}
      </motion.div>
    </div>
  );
}
