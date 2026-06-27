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
  const silhouetteScale = useTransform(progress, [0, 0.32, 0.58, 0.9], reduceMotion ? [1, 1, 1, 1] : [0.86, 1.08, 3.4, 7.8]);
  const silhouetteX = useTransform(progress, [0, 0.45, 1], reduceMotion ? ["0%", "0%", "0%"] : ["-5%", "2%", "-16%"]);
  const waterX = useTransform(progress, [0, 1], reduceMotion ? ["0%", "0%"] : ["-12%", "10%"]);
  const backgroundScale = useTransform(progress, [0, 1], reduceMotion ? [1, 1] : [1.08, 1]);
  const swimmerSolidOpacity = useTransform(progress, [0, 0.34, 0.6], [0.96, 0.7, 0]);
  const swimmerFilmOpacity = useTransform(progress, [0, 0.24, 0.54], [0.28, 0.84, 1]);
  const frameOpacity = useTransform(progress, [0, 0.46, 0.68], [1, 0.72, 0]);
  const promptOpacity = useTransform(progress, [0, 0.56, 0.76], [1, 0.76, 0]);

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
                className="swimmer-silhouette absolute inset-x-0 top-12 mx-auto h-[390px] w-[min(92%,760px)] sm:top-16 sm:h-[460px]"
                style={{ scale: silhouetteScale, x: silhouetteX }}
              >
                <svg className="h-full w-full overflow-visible" viewBox="0 0 760 430">
                  <defs>
                    <filter id="swimSilhouetteGlow">
                      <feGaussianBlur stdDeviation="8" />
                    </filter>
                    <filter id="innerWaterBlur">
                      <feGaussianBlur stdDeviation="2.4" />
                    </filter>
                    <linearGradient id="swimWake" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stopColor="#4ee8ff" stopOpacity="0" />
                      <stop offset="48%" stopColor="#4ee8ff" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
                    </linearGradient>
                    <linearGradient id="swimmerEdge" x1="0" x2="1" y1="0" y2="1">
                      <stop offset="0%" stopColor="#02050a" />
                      <stop offset="55%" stopColor="#050b13" />
                      <stop offset="100%" stopColor="#000206" />
                    </linearGradient>
                    <pattern id="insidePoolTexture" height="430" patternUnits="userSpaceOnUse" width="760">
                      <image height="430" href="/images/swimsight-pool-hero.jpg" preserveAspectRatio="xMidYMid slice" width="760" />
                      <rect fill="rgba(0,20,34,0.34)" height="430" width="760" />
                      <path d="M0 118 H760 M0 198 H760 M0 278 H760" stroke="rgba(255,255,255,0.22)" strokeDasharray="18 14" />
                      <path d="M60 0 V430 M170 0 V430 M280 0 V430 M390 0 V430 M500 0 V430 M610 0 V430" stroke="rgba(78,232,255,0.18)" />
                    </pattern>
                    <mask id="freestyleSwimmerMask" maskUnits="userSpaceOnUse">
                      <rect fill="black" height="430" width="760" />
                      <FreestyleSwimmerShape fill="white" />
                    </mask>
                  </defs>
                  <path d="M54 302 C146 244 226 249 322 278 C431 311 533 302 700 214" fill="none" filter="url(#swimSilhouetteGlow)" stroke="#4ee8ff" strokeLinecap="round" strokeWidth="30" />
                  <path d="M52 302 C145 247 236 249 326 275 C434 307 542 301 706 214" fill="none" stroke="url(#swimWake)" strokeLinecap="round" strokeWidth="5" />

                  <motion.g filter="url(#innerWaterBlur)" mask="url(#freestyleSwimmerMask)" style={{ opacity: swimmerFilmOpacity }}>
                    <rect fill="url(#insidePoolTexture)" height="430" width="760" />
                    <path d="M50 298 C148 245 237 250 326 278 C435 312 536 300 704 214" fill="none" stroke="#4ee8ff" strokeLinecap="round" strokeOpacity="0.72" strokeWidth="11" />
                  </motion.g>

                  <motion.g style={{ opacity: swimmerSolidOpacity }}>
                    <FreestyleSwimmerShape fill="url(#swimmerEdge)" />
                    <path d="M318 220 C356 198 423 196 484 222" fill="none" stroke="#111a22" strokeLinecap="round" strokeOpacity="0.8" strokeWidth="7" />
                    <path d="M532 167 C550 161 568 168 578 181" fill="none" stroke="#4ee8ff" strokeLinecap="round" strokeOpacity="0.44" strokeWidth="5" />
                    <path d="M505 199 C525 213 551 214 574 203" fill="none" stroke="#0c151d" strokeLinecap="round" strokeOpacity="0.68" strokeWidth="5" />
                  </motion.g>

                  <motion.g style={{ opacity: swimmerFilmOpacity }}>
                    <FreestyleSwimmerShape fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="2.4" />
                    <path d="M52 302 C145 247 236 249 326 275 C434 307 542 301 706 214" fill="none" stroke="#4ee8ff" strokeLinecap="round" strokeOpacity="0.52" strokeWidth="3" />
                  </motion.g>
                </svg>
              </motion.div>

              <motion.div className="absolute bottom-5 left-5 right-5 grid gap-3 md:grid-cols-3" style={{ opacity: frameOpacity }}>
                {raceFrames.map((frame, index) => (
                  <RaceFrame frame={frame} index={index} key={frame.title} progress={progress} />
                ))}
              </motion.div>

              <motion.div className="absolute left-5 top-5 rounded-full border border-white/14 bg-black/36 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/64 backdrop-blur-xl" style={{ opacity: promptOpacity }}>
                Scroll into the swim
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FreestyleSwimmerShape({
  fill,
  stroke,
  strokeWidth
}: {
  fill: string;
  stroke?: string;
  strokeWidth?: string;
}) {
  return (
    <g fill={fill} stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth}>
      <path d="M289 213 C337 172 421 163 493 195 C526 210 531 245 501 263 C431 304 334 292 276 260 C253 247 258 230 289 213Z" />
      <path d="M445 202 C498 147 555 108 632 76 C662 64 684 91 662 119 C610 185 547 228 483 246Z" />
      <path d="M286 246 C231 260 166 295 102 346 C74 368 46 329 73 301 C132 239 207 203 284 194Z" />
      <path d="M486 258 C551 276 612 306 671 352 C696 372 672 404 642 385 C575 344 518 321 445 298Z" />
      <path d="M414 278 C462 333 510 370 564 408 C590 426 566 461 536 444 C474 407 426 363 374 300Z" />
      <circle cx="532" cy="190" r="32" />
      <path d="M501 204 C519 180 551 170 580 180 C568 206 534 219 501 204Z" />
    </g>
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
