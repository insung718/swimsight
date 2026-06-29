"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function ContainerScroll({ title, children }: { title: ReactNode; children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0.08, 0.48], [reduceMotion ? 0 : isDesktop ? 12 : 4, 0]);
  const scale = useTransform(scrollYProgress, [0.08, 0.48], [reduceMotion ? 1 : isDesktop ? 0.88 : 0.96, 1]);
  const translateY = useTransform(scrollYProgress, [0.08, 0.48], [reduceMotion ? 0 : isDesktop ? 80 : 32, 0]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <div className="relative flex min-h-[44rem] items-center justify-center px-5 py-20 sm:min-h-[64rem] sm:py-24" ref={containerRef}>
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
