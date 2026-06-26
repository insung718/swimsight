"use client";

import { Activity, Gauge, LineChart, TimerReset } from "lucide-react";
import { motion, type MotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { type CSSProperties, useRef, useState } from "react";

const moments = [
  {
    icon: TimerReset,
    label: "Start",
    title: "A result enters the lane.",
    body: "The moment you log a swim, SwimSight anchors it to the event, course, meet, and date that created it.",
    metric: "00.00"
  },
  {
    icon: LineChart,
    label: "Trend",
    title: "The line starts moving.",
    body: "Personal bests, regression, consistency, and recent progress begin building a live map of the season.",
    metric: "+4.8%"
  },
  {
    icon: Gauge,
    label: "Prediction",
    title: "The next split comes into view.",
    body: "Future windows for 30, 90, 180, and 365 days make the goal feel less like a guess.",
    metric: "90d"
  },
  {
    icon: Activity,
    label: "SPI",
    title: "Everything compresses into one read.",
    body: "Improvement, consistency, and trend direction become the Swim Power Index: a clean signal from messy race history.",
    metric: "88"
  }
];

export function RaceTelemetry() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 28, mass: 0.35 });
  const pathLength = useTransform(smoothProgress, [0.08, 0.82], [0.05, 1]);
  const swimmerX = useTransform(smoothProgress, [0.08, 0.86], ["6%", "86%"]);
  const swimmerY = useTransform(smoothProgress, [0.08, 0.36, 0.62, 0.86], ["58%", "31%", "48%", "20%"]);
  const graphRotate = useTransform(smoothProgress, [0, 1], reduceMotion ? [0, 0] : [-1.4, 1.4]);
  const graphScale = useTransform(smoothProgress, [0, 0.5, 1], reduceMotion ? [1, 1, 1] : [0.97, 1.025, 0.99]);
  const spotlightStyle = {
    "--spotlight-x": `${spotlight.x}%`,
    "--spotlight-y": `${spotlight.y}%`
  } as CSSProperties;

  return (
    <section
      className="race-telemetry relative bg-[#03070e] text-white"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setSpotlight({
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100
        });
      }}
      ref={ref}
      style={spotlightStyle}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
      />
      <div className="relative lg:h-[340svh]">
        <div className="flex min-h-svh items-center overflow-hidden lg:sticky lg:top-0">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-20 sm:py-24 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div className="relative z-10">
              <p className="text-sm font-semibold text-aqua-300">Race telemetry</p>
              <h2 className="mt-4 max-w-xl text-balance text-4xl font-semibold leading-[0.96] sm:text-6xl lg:text-7xl">
                Watch your season draw itself.
              </h2>
              <p className="mt-6 max-w-lg text-base leading-7 text-white/68 sm:text-lg sm:leading-8">
                Inspired by scroll-driven graph systems, rebuilt for swimming: every logged time becomes a moving signal through lanes, goals, and predictions.
              </p>
              <div className="mt-8 grid max-w-md grid-cols-2 gap-3 sm:mt-10">
                {["Input", "PB", "Trend", "Future"].map((item, index) => (
                  <TelemetryPill index={index} item={item} key={item} progress={smoothProgress} />
                ))}
              </div>
            </div>

            <motion.div
              className="relative min-h-[900px] overflow-hidden rounded-lg border border-white/15 bg-white/[0.06] shadow-[0_50px_160px_rgba(0,190,230,0.20)] backdrop-blur-2xl sm:min-h-[760px] lg:min-h-[620px]"
              style={{ rotate: graphRotate, scale: graphScale }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:100%_88px,12.5%_100%]" />
              <div className="absolute inset-x-8 top-9 flex justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">
                <span>Block</span>
                <span>Middle</span>
                <span>Finish</span>
              </div>
              <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 620">
                <defs>
                  <linearGradient id="telemetryGlow" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#22c9e8" stopOpacity="0.15" />
                    <stop offset="42%" stopColor="#00fbff" stopOpacity="0.96" />
                    <stop offset="100%" stopColor="#49d7a6" stopOpacity="0.88" />
                  </linearGradient>
                  <filter id="telemetryBlur">
                    <feGaussianBlur stdDeviation="5" />
                  </filter>
                </defs>
                {[110, 198, 286, 374, 462, 550].map((y) => (
                  <path d={`M0 ${y} H1000`} key={y} stroke="rgba(255,255,255,0.12)" strokeDasharray="8 14" />
                ))}
                <motion.path
                  d="M60 462 C150 442 176 334 270 314 C378 290 405 188 520 211 C640 236 646 372 744 330 C830 294 865 154 940 126"
                  fill="none"
                  filter="url(#telemetryBlur)"
                  stroke="#00fbff"
                  strokeLinecap="round"
                  strokeWidth="18"
                  style={{ pathLength }}
                />
                <motion.path
                  d="M60 462 C150 442 176 334 270 314 C378 290 405 188 520 211 C640 236 646 372 744 330 C830 294 865 154 940 126"
                  fill="none"
                  stroke="url(#telemetryGlow)"
                  strokeLinecap="round"
                  strokeWidth="5"
                  style={{ pathLength }}
                />
              </svg>
              <motion.div
                aria-hidden
                className="absolute z-10 h-14 w-14 rounded-full border border-aqua-200/60 bg-aqua-300/18 shadow-[0_0_60px_rgba(0,251,255,0.52)] backdrop-blur-xl"
                style={{ left: swimmerX, top: swimmerY, translateX: "-50%", translateY: "-50%" }}
              >
                <span className="absolute left-1/2 top-1/2 h-3 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                <span className="absolute left-3 top-2 h-3 w-3 rounded-full bg-aqua-100" />
              </motion.div>
              <div className="relative z-20 mt-[430px] grid gap-3 p-4 sm:absolute sm:bottom-5 sm:left-5 sm:right-5 sm:mt-0 sm:grid-cols-2 sm:p-0 xl:grid-cols-4">
                {moments.map((moment, index) => {
                  return (
                    <TelemetryMoment
                      index={index}
                      key={moment.title}
                      moment={moment}
                      progress={smoothProgress}
                    />
                  );
                })}
              </div>
              <div className="absolute left-8 top-16 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/66 backdrop-blur-xl">
                Scroll to process
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TelemetryPill({ index, item, progress }: { index: number; item: string; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [index * 0.18, index * 0.18 + 0.14], [0.36, 1]);

  return (
    <motion.div className="rounded-lg border border-white/12 bg-white/8 p-4 backdrop-blur-2xl" style={{ opacity }}>
      <div className="font-mono text-2xl text-aqua-200">0{index + 1}</div>
      <div className="mt-1 text-sm font-semibold text-white/80">{item}</div>
    </motion.div>
  );
}

function TelemetryMoment({
  index,
  moment,
  progress
}: {
  index: number;
  moment: (typeof moments)[number];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, [index * 0.19, index * 0.19 + 0.12], [0.28, 1]);
  const y = useTransform(progress, [index * 0.19, index * 0.19 + 0.16], [28, 0]);
  const Icon = moment.icon;

  return (
    <motion.article
      className="rounded-lg border border-white/16 bg-[#04111d]/88 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
      style={{ opacity, y }}
    >
      <div className="flex items-center justify-between">
        <Icon aria-hidden className="h-5 w-5 text-aqua-200" />
        <span className="font-mono text-xl text-white">{moment.metric}</span>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-aqua-200">{moment.label}</p>
      <h3 className="mt-2 text-lg font-semibold">{moment.title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/62">{moment.body}</p>
    </motion.article>
  );
}
