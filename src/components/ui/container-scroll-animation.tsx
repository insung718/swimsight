"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function ContainerScroll({ title, children }: { title: ReactNode; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0.08, 0.48], [reduceMotion ? 0 : 12, 0]);
  const scale = useTransform(scrollYProgress, [0.08, 0.48], [reduceMotion ? 1 : 0.88, 1]);
  const translateY = useTransform(scrollYProgress, [0.08, 0.48], [reduceMotion ? 0 : 80, 0]);

  return (
    <div className="relative flex min-h-[52rem] items-center justify-center px-5 py-24 sm:min-h-[64rem]" ref={containerRef}>
      <div className="w-full max-w-6xl" style={{ perspective: "1200px" }}>
        <motion.div className="mx-auto mb-14 max-w-4xl text-center" style={{ translateY }}>
          {title}
        </motion.div>
        <motion.div
          className="mx-auto w-full max-w-5xl overflow-hidden rounded-lg border border-white/15 bg-[#0d1117] shadow-[0_50px_120px_rgba(0,190,230,0.16)]"
          style={{ rotateX: rotate, scale, transformOrigin: "center top" }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
