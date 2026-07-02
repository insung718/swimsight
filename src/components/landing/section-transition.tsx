"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useTranslator } from "@/components/i18n/use-language";

export function SectionTransition({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { t } = useTranslator();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scaleX = useTransform(scrollYProgress, [0.1, 0.75], reduceMotion ? [1, 1] : [0.08, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.25, 1], [0.3, 1, 0.42]);

  return (
    <div className="relative overflow-hidden bg-[#03070e] px-5 py-10 text-white" ref={ref}>
      <div className="mx-auto flex max-w-6xl items-center gap-4">
        <motion.div className="h-px flex-1 origin-left bg-aqua-300/80" style={{ opacity, scaleX }} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.24em] text-white/52">{t(label)}</span>
        <motion.div className="h-px flex-1 origin-right bg-aqua-300/80" style={{ opacity, scaleX }} />
      </div>
    </div>
  );
}
