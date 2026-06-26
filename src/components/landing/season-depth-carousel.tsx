"use client";

import { Activity, CalendarDays, Goal, LineChart, Users } from "lucide-react";
import {
  motion,
  type MotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform
} from "framer-motion";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

const stages = [
  {
    icon: <Activity aria-hidden className="h-5 w-5" />,
    number: "01",
    kicker: "Input",
    title: "Drop in a swim.",
    body: "Manual entry and CSV imports land in the same clean data model, ready for analysis the second you save.",
    metric: "1 result",
    accent: "from-aqua-300 to-mint-400"
  },
  {
    icon: <LineChart aria-hidden className="h-5 w-5" />,
    number: "02",
    kicker: "Signal",
    title: "The season starts drawing.",
    body: "Progression, best times, consistency, and improvement rate become a live map instead of a pile of numbers.",
    metric: "trend +",
    accent: "from-cyan-200 to-blue-500"
  },
  {
    icon: <Goal aria-hidden className="h-5 w-5" />,
    number: "03",
    kicker: "Forecast",
    title: "Goals get a path.",
    body: "Predictions for 30, 90, 180, and 365 days show what pace your next breakthrough actually needs.",
    metric: "365d",
    accent: "from-white to-aqua-300"
  },
  {
    icon: <Users aria-hidden className="h-5 w-5" />,
    number: "04",
    kicker: "Community",
    title: "Compare without the noise.",
    body: "Private swim circles make teammates visible while keeping every account scoped and controlled.",
    metric: "private",
    accent: "from-aqua-300 to-coral-400"
  },
  {
    icon: <CalendarDays aria-hidden className="h-5 w-5" />,
    number: "05",
    kicker: "Meet day",
    title: "Arrive ready.",
    body: "Countdowns, goals, and motivation stay close so the dashboard feels like a race plan, not homework.",
    metric: "ready",
    accent: "from-mint-400 to-aqua-400"
  }
] as const;

const timeline = ["2026", "30d", "90d", "180d", "365d"];

export function SeasonDepthCarousel() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 82, damping: 24, mass: 0.35 });
  const desktopTrackX = useTransform(smoothProgress, (value) => {
    if (!isDesktop || reduceMotion) return "0%";
    const progress = Math.min(Math.max((value - 0.08) / 0.82, 0), 1);
    return `${progress * -58}%`;
  });
  const haloX = useTransform(smoothProgress, [0, 1], ["8%", "84%"]);
  const yearProgress = useTransform(smoothProgress, [0.08, 0.9], ["0%", "100%"]);
  const pointerStyle = {
    "--depth-x": `${pointer.x}px`,
    "--depth-y": `${pointer.y}px`
  } as CSSProperties;

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <section
      aria-labelledby="season-depth-heading"
      className="season-depth relative overflow-hidden bg-[#f7fcff] text-[#101820]"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setPointer({
          x: ((event.clientX - rect.left) / rect.width - 0.5) * 22,
          y: ((event.clientY - rect.top) / rect.height - 0.5) * 18
        });
      }}
      ref={ref}
      style={pointerStyle}
    >
      <motion.div
        aria-hidden
        className="absolute top-24 h-80 w-80 rounded-full bg-aqua-300/26 blur-3xl"
        style={{ left: haloX }}
      />
      <div className="relative lg:h-[330svh]">
        <div className="mx-auto flex min-h-svh max-w-[1500px] flex-col justify-center px-5 py-24 lg:sticky lg:top-0 lg:overflow-hidden lg:py-0">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <div className="relative z-10 max-w-xl">
              <p className="text-sm font-semibold text-cyan-700">Interactive season model</p>
              <h2 id="season-depth-heading" className="mt-4 text-balance text-4xl font-semibold leading-[0.98] sm:text-6xl lg:text-7xl">
                A season you can move through.
              </h2>
              <p className="mt-6 text-base leading-7 text-black/62 sm:text-lg sm:leading-8">
                From first entry to meet day, SwimSight turns your training into one cinematic path: data in, signal out, teammates connected, goals in view.
              </p>
            </div>

            <div className="relative z-10">
              <div className="rounded-lg border border-black/10 bg-white/70 p-3 shadow-[0_24px_90px_rgba(5,40,55,0.10)] backdrop-blur-2xl">
                <div className="relative h-2 overflow-hidden rounded-full bg-black/8">
                  <motion.div className="h-full rounded-full bg-[#0a88ad]" style={{ width: yearProgress }} />
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-black/48">
                  {timeline.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div aria-hidden className="depth-wordmark pointer-events-none absolute inset-x-0 top-[28%] hidden select-none text-center text-[16vw] font-semibold leading-none text-black/[0.035] lg:block">
            SWIMSIGHT
          </div>

          <motion.div
            className="depth-track relative z-10 mt-14 flex flex-col gap-4 lg:mt-20 lg:w-max lg:flex-row lg:gap-5"
            style={{ x: desktopTrackX }}
          >
            {stages.map((stage, index) => (
              <DepthCard index={index} isDesktop={isDesktop} key={stage.title} progress={smoothProgress}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${stage.accent} text-[#031522] shadow-[0_12px_32px_rgba(0,174,202,0.20)]`}>
                      {stage.icon}
                    </span>
                    <div>
                      <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">{stage.number}</p>
                      <p className="mt-1 text-sm font-semibold text-black/46">{stage.kicker}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-black/10 bg-white/72 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-black/56">
                    {stage.metric}
                  </span>
                </div>
                <h3 className="mt-16 max-w-sm text-balance text-4xl font-semibold leading-[0.96] text-[#101820] sm:text-5xl lg:mt-20">
                  {stage.title}
                </h3>
                <p className="mt-6 max-w-md text-base leading-7 text-black/62">{stage.body}</p>
                <div className="mt-10 h-28 overflow-hidden rounded-lg border border-white/70 bg-[#061827] p-4 shadow-inner">
                  <div className="flex h-full items-end gap-2">
                    {[54, 74, 62, 88, 70, 96, 84].map((height, barIndex) => (
                      <motion.span
                        aria-hidden
                        className="flex-1 rounded-t-full bg-gradient-to-t from-aqua-500 to-aqua-100"
                        key={`${stage.number}-${height}-${barIndex}`}
                        style={{ height: `${height}%` }}
                        initial={reduceMotion ? false : { scaleY: 0.35 }}
                        whileInView={reduceMotion ? undefined : { scaleY: 1 }}
                        transition={{ duration: 0.65, delay: barIndex * 0.035, ease: [0.22, 1, 0.36, 1] }}
                        viewport={{ once: true, amount: 0.5 }}
                      />
                    ))}
                  </div>
                </div>
              </DepthCard>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function DepthCard({
  children,
  index,
  isDesktop,
  progress
}: {
  children: ReactNode;
  index: number;
  isDesktop: boolean;
  progress: MotionValue<number>;
}) {
  const start = 0.09 + index * 0.15;
  const center = start + 0.13;
  const end = start + 0.28;
  const opacity = useTransform(progress, [start, center, end], [0.62, 1, 0.76]);
  const y = useTransform(progress, [start, center, end], [36, 0, -24]);
  const rotateY = useTransform(progress, [start, center, end], [7, 0, -5]);
  const scale = useTransform(progress, [start, center, end], [0.96, 1, 0.98]);

  return (
    <motion.article
      className="depth-card relative min-h-[520px] overflow-hidden rounded-lg border border-white/80 bg-white/76 p-6 shadow-[0_30px_100px_rgba(2,37,60,0.13)] backdrop-blur-2xl sm:p-8 lg:w-[min(560px,42vw)]"
      style={isDesktop ? { opacity, rotateY, scale, y } : undefined}
    >
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.76),rgba(255,255,255,0.24)_45%,rgba(34,201,232,0.15))]" />
      <div aria-hidden className="depth-card-shine absolute inset-0 opacity-0 transition duration-500" />
      <div className="relative z-10">{children}</div>
    </motion.article>
  );
}
