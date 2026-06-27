"use client";

import { motion, type MotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Timer, Waves, Zap } from "lucide-react";
import { useRef } from "react";

const raceFrames = [
  {
    label: "Breakout",
    title: "Clean speed after the wall.",
    metric: "0.64",
    icon: Zap
  },
  {
    label: "Tempo",
    title: "Stroke rhythm under pressure.",
    metric: "1.12",
    icon: Waves
  },
  {
    label: "Finish",
    title: "The last five meters count.",
    metric: "PB",
    icon: Timer
  }
] as const;

export function SwimAthleteReveal() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const progress = useSpring(scrollYProgress, { stiffness: 86, damping: 30, mass: 0.42 });
  const silhouetteScale = useTransform(progress, [0, 0.42, 1], reduceMotion ? [1, 1, 1] : [0.9, 1.08, 0.98]);
  const silhouetteX = useTransform(progress, [0, 0.5, 1], reduceMotion ? ["0%", "0%", "0%"] : ["-5%", "4%", "0%"]);
  const waterX = useTransform(progress, [0, 1], reduceMotion ? ["0%", "0%"] : ["-12%", "10%"]);
  const backgroundScale = useTransform(progress, [0, 1], reduceMotion ? [1, 1] : [1.08, 1]);

  return (
    <section className="swim-athlete-reveal relative bg-[#03070e] text-white" ref={ref}>
      <div className="relative lg:h-[225svh]">
        <div className="relative flex min-h-svh items-center overflow-hidden lg:sticky lg:top-0">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[url('/images/swimsight-pool-hero.jpg')] bg-cover bg-center opacity-36"
            style={{ scale: backgroundScale }}
          />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,14,0.96),rgba(3,7,14,0.78)_36%,rgba(3,7,14,0.35)_70%,rgba(3,7,14,0.9))]" />
          <motion.div aria-hidden className="absolute inset-x-[-12%] top-1/2 h-[44svh] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgba(78,232,255,0.02)_0_6px,transparent_6px_54px)] opacity-80" style={{ x: waterX }} />

          <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 py-24 sm:py-28 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div className="max-w-xl">
              <p className="text-sm font-semibold text-aqua-200">Athletic intelligence</p>
              <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.92] sm:text-7xl lg:text-[88px]">
                Built like a race film.
              </h2>
              <p className="mt-6 text-lg leading-8 text-white/70">
                Split the season into moments: breakout, tempo, finish, recovery. SwimSight turns raw entries into a cinematic read on what is actually moving.
              </p>
              <div className="mt-9 grid max-w-md gap-3 sm:grid-cols-3">
                {["Input", "Signal", "Forecast"].map((item, index) => (
                  <ScrollChip index={index} item={item} key={item} progress={progress} />
                ))}
              </div>
            </div>

            <div data-athlete-stage className="relative min-h-[560px] overflow-hidden rounded-lg border border-white/14 bg-white/[0.055] shadow-[0_50px_180px_rgba(0,205,255,0.18)] backdrop-blur-2xl sm:min-h-[640px]">
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:100%_84px,14.285%_100%]" />
              <motion.div
                aria-hidden
                className="swimmer-silhouette absolute inset-x-0 top-16 mx-auto h-[360px] w-[min(92%,760px)] sm:top-20 sm:h-[430px]"
                style={{ scale: silhouetteScale, x: silhouetteX }}
              >
                <svg className="h-full w-full overflow-visible" viewBox="0 0 760 430">
                  <defs>
                    <filter id="swimSilhouetteGlow">
                      <feGaussianBlur stdDeviation="8" />
                    </filter>
                    <linearGradient id="swimWake" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#4ee8ff" stopOpacity="0" />
                      <stop offset="48%" stopColor="#4ee8ff" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  <path d="M74 282 C168 244 231 250 323 278 C432 311 519 302 674 230" fill="none" filter="url(#swimSilhouetteGlow)" stroke="#4ee8ff" strokeLinecap="round" strokeWidth="28" />
                  <path d="M72 281 C167 247 237 249 326 275 C434 307 528 301 680 230" fill="none" stroke="url(#swimWake)" strokeLinecap="round" strokeWidth="4" />
                  <path d="M254 214 C320 168 403 160 472 196 C493 207 494 240 470 250 C388 284 307 284 244 248 C225 237 229 226 254 214Z" fill="#02050a" />
                  <path d="M407 184 C460 132 512 100 571 78 C598 68 619 92 599 113 C546 169 493 210 434 236Z" fill="#02050a" />
                  <path d="M280 247 C224 268 171 292 105 335 C80 351 56 321 78 299 C137 241 199 210 263 198Z" fill="#02050a" />
                  <path d="M464 248 C530 264 586 289 647 330 C670 346 652 377 624 363 C554 329 500 307 438 292Z" fill="#02050a" />
                  <circle cx="520" cy="188" fill="#02050a" r="31" />
                  <path d="M519 178 C534 171 552 176 561 188" fill="none" stroke="#4ee8ff" strokeLinecap="round" strokeOpacity="0.42" strokeWidth="5" />
                </svg>
              </motion.div>

              <div className="absolute bottom-5 left-5 right-5 grid gap-3 md:grid-cols-3">
                {raceFrames.map((frame, index) => (
                  <RaceFrame frame={frame} index={index} key={frame.title} progress={progress} />
                ))}
              </div>

              <div className="absolute left-5 top-5 rounded-full border border-white/14 bg-black/36 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/64 backdrop-blur-xl">
                Scroll through the swim
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScrollChip({ index, item, progress }: { index: number; item: string; progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [index * 0.18, index * 0.18 + 0.14], [0.64, 1]);

  return (
    <motion.div className="rounded-lg border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl" style={{ opacity }}>
      <div className="font-mono text-xl text-aqua-100">0{index + 1}</div>
      <p className="mt-1 text-sm font-semibold text-white/76">{item}</p>
    </motion.div>
  );
}

function RaceFrame({
  frame,
  index,
  progress
}: {
  frame: (typeof raceFrames)[number];
  index: number;
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, [index * 0.2 + 0.08, index * 0.2 + 0.28], [0.78, 1]);
  const y = useTransform(progress, [index * 0.2 + 0.08, index * 0.2 + 0.28], [22, 0]);
  const Icon = frame.icon;

  return (
    <motion.article
      className="relative min-h-[168px] overflow-hidden rounded-lg border border-white/16 bg-[#04111d]/88 p-4 shadow-[0_20px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
      style={{ opacity, y }}
    >
      <div aria-hidden className="absolute inset-0 bg-[url('/images/swimsight-pool-hero.jpg')] bg-cover bg-center opacity-18 grayscale" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#04111d]/40 to-[#04111d]/96" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <Icon aria-hidden className="h-4 w-4 text-aqua-200" />
          <span className="font-mono text-2xl text-white">{frame.metric}</span>
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-aqua-200">{frame.label}</p>
        <h3 className="mt-2 text-lg font-semibold leading-tight text-white">{frame.title}</h3>
      </div>
    </motion.article>
  );
}
