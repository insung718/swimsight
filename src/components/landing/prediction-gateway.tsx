"use client";

import { FormEvent, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, Check, LockKeyhole, TimerReset, Waves } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { useTranslator } from "@/components/i18n/use-language";
import { AdaptiveSlider } from "@/components/ui/adaptive-slider";
import { minimumPublicPredictionTime, publicPredictionSeedStorageKey, type PublicPredictionSeed } from "@/lib/public-prediction-preview";
import { parseTimeInput } from "@/lib/utils";
import type { Course } from "@/types/swim";

const courses: Course[] = ["SCY", "SCM", "LCM"];

export function PredictionGateway() {
  const { t } = useTranslator();
  const reduceMotion = useReducedMotion();
  const [time, setTime] = useState("");
  const [course, setCourse] = useState<Course>("LCM");
  const [sessionsPerWeek, setSessionsPerWeek] = useState(5);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  function preparePrediction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentTime = parseTimeInput(time);

    if (!Number.isFinite(currentTime) || currentTime < minimumPublicPredictionTime(course) || currentTime > 180) {
      setError(t("Enter a valid 50 Free time for the selected course."));
      return;
    }

    const seed: PublicPredictionSeed = {
      course,
      currentTime,
      sessionsPerWeek,
      createdAt: Date.now()
    };

    window.sessionStorage.setItem(publicPredictionSeedStorageKey, JSON.stringify(seed));
    setError("");
    setReady(true);
  }

  return (
    <section className="prediction-gateway relative isolate min-h-[100svh] overflow-hidden bg-[#03070e] text-white" id="predict">
      <div aria-hidden className="absolute inset-0 bg-[url('/images/swimsight-pool-hero.jpg')] bg-cover bg-center" />
      <video
        aria-hidden
        autoPlay
        className="prediction-gateway__video absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
        loop
        muted
        playsInline
        poster="/images/swimsight-pool-hero.jpg"
        preload="metadata"
      >
        <source src="/videos/lap-one-swim.mp4" type="video/mp4" />
      </video>
      <div aria-hidden className="prediction-gateway__veil absolute inset-0" />
      <div aria-hidden className="prediction-gateway__lanes absolute inset-0" />

      <div className="relative mx-auto grid min-h-[100svh] max-w-6xl items-end gap-5 px-5 pb-6 pt-16 sm:gap-8 sm:pb-14 sm:pt-24 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.68fr)] lg:items-center lg:gap-16 lg:pb-12 lg:pt-20">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl pb-1 lg:pb-0"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          transition={{ duration: reduceMotion ? 0 : 0.62, ease: [0.23, 1, 0.32, 1] }}
        >
          <p className="inline-flex items-center gap-2 border-l-2 border-cyan-300 pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100 sm:text-sm">
            <Waves aria-hidden className="h-4 w-4" />
            {t("A year from this swim")}
          </p>
          <h1 className="mt-4 max-w-[780px] text-balance text-[clamp(2.8rem,8vw,7.6rem)] font-semibold leading-[0.88] tracking-normal sm:mt-6 sm:leading-[0.84]">
            {t("Your next 50 starts here.")}
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-sm leading-6 text-white/74 sm:mt-6 sm:text-xl sm:leading-8">
            {t("Enter your 50 Free PB and weekly pool frequency. SwimSight will build a one-year directional preview, then turn your real race history into the personal model.")}
          </p>
          <div className="mt-7 hidden items-center gap-5 text-xs font-semibold text-white/58 sm:flex sm:text-sm">
            <span className="inline-flex items-center gap-2"><Check aria-hidden className="h-4 w-4 text-cyan-200" />{t("No demo data")}</span>
            <span className="inline-flex items-center gap-2"><LockKeyhole aria-hidden className="h-4 w-4 text-cyan-200" />{t("Private by default")}</span>
          </div>
        </motion.div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="prediction-gateway__panel relative overflow-hidden border border-white/20 bg-[#07131f]/88 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl sm:min-h-[420px] sm:p-7"
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          transition={{ duration: reduceMotion ? 0 : 0.62, delay: reduceMotion ? 0 : 0.08, ease: [0.23, 1, 0.32, 1] }}
        >
          <div aria-hidden className="prediction-gateway__panel-grid absolute inset-0" />
          <AnimatePresence initial={false} mode="wait">
            {!ready ? (
              <motion.form
                animate={{ opacity: 1, x: 0 }}
                className="relative"
                exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                key="inputs"
                transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.23, 1, 0.32, 1] }}
                onSubmit={preparePrediction}
              >
                <div className="flex items-center justify-between gap-4 border-b border-white/12 pb-4">
                  <div>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cyan-200/72">{t("50 Free forecast")}</p>
                    <h2 className="mt-1 text-xl font-semibold">{t("Build your preview")}</h2>
                  </div>
                  <span className="font-mono text-sm font-semibold text-cyan-100">365D</span>
                </div>

                <label className="mt-4 block sm:mt-6" htmlFor="public-50-free-time">
                  <span className="text-xs font-semibold text-white/68">{t("Your 50 Free PB")}</span>
                  <span className="mt-2 flex h-14 items-center border-b border-white/24 bg-white/[0.045] px-4 transition-colors focus-within:border-cyan-200 focus-within:bg-white/[0.075] sm:h-16">
                    <TimerReset aria-hidden className="mr-3 h-5 w-5 shrink-0 text-cyan-200" />
                    <input
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent font-mono text-3xl font-semibold text-white outline-none placeholder:text-white/24"
                      id="public-50-free-time"
                      inputMode="decimal"
                      placeholder="25.56"
                      value={time}
                      onChange={(event) => {
                        setTime(event.target.value);
                        setError("");
                      }}
                    />
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/42">{t("time")}</span>
                  </span>
                </label>

                <fieldset className="mt-4 sm:mt-5">
                  <legend className="text-xs font-semibold text-white/68">{t("Pool course")}</legend>
                  <div className="mt-2 grid grid-cols-3 border border-white/14 bg-black/20 p-1">
                    {courses.map((option) => (
                      <button
                        aria-pressed={course === option}
                        className={`ui-press h-10 text-xs font-semibold ${course === option ? "bg-cyan-200 text-[#04111d]" : "text-white/62 hover:bg-white/10 hover:text-white"}`}
                        key={option}
                        type="button"
                        onClick={() => setCourse(option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <AdaptiveSlider
                  className="prediction-gateway__slider mt-4 sm:mt-5"
                  formatValue={(value) => `${value} ${t(value === 1 ? "session" : "sessions")}`}
                  label={t("Pool sessions per week")}
                  max={14}
                  min={1}
                  step={1}
                  value={sessionsPerWeek}
                  onChange={setSessionsPerWeek}
                />

                {error && <p aria-live="polite" className="mt-3 text-sm font-medium text-[#ffb4a7]">{error}</p>}

                <button className="ui-press mt-3 inline-flex h-12 w-full items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-[#04111d] hover:bg-cyan-100 sm:mt-5" type="submit">
                  {t("Predict my time in one year")}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </button>
                <p className="mt-3 hidden text-xs leading-5 text-white/46 sm:block">
                  {t("A directional preview, not a guarantee. The full model needs age, course, and race history.")}
                </p>
              </motion.form>
            ) : (
              <motion.div
                animate={{ opacity: 1, x: 0 }}
                className="relative flex min-h-[370px] flex-col justify-between"
                exit={reduceMotion ? undefined : { opacity: 0, x: 12 }}
                initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                key="ready"
                transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.23, 1, 0.32, 1] }}
              >
                <div>
                  <span className="inline-flex h-11 w-11 items-center justify-center bg-cyan-200 text-[#04111d]">
                    <LockKeyhole aria-hidden className="h-5 w-5" />
                  </span>
                  <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/72">{t("Forecast assembled")}</p>
                  <h2 className="mt-3 text-balance text-3xl font-semibold leading-tight sm:text-4xl">{t("Your one-year time is ready.")}</h2>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-white/64">
                    {t("Sign in with Google to reveal the range and carry this starting point into SwimSight.")}
                  </p>
                  <div className="mt-7 grid grid-cols-3 divide-x divide-white/12 border-y border-white/12 py-4">
                    <PreviewValue label="PB" value={time} />
                    <PreviewValue label="Course" value={course} />
                    <PreviewValue label="Weekly" value={`${sessionsPerWeek}x`} />
                  </div>
                </div>
                <div className="mt-8">
                  <UserActions hero redirectUrl="/prediction-preview" signedOutLabel="Sign in with Google to reveal it" />
                  <button className="ui-press ml-4 text-sm font-semibold text-white/54 hover:text-white" type="button" onClick={() => setReady(false)}>
                    {t("Edit inputs")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      <a className="prediction-gateway__continue ui-press absolute bottom-3 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs font-semibold text-white/56 hover:text-white sm:inline-flex" href="#swimsight-story">
        {t("Explore SwimSight")}
        <ArrowDown aria-hidden className="h-4 w-4" />
      </a>
    </section>
  );
}

function PreviewValue({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();

  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <p className="truncate text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-white/42">{t(label)}</p>
      <p className="mt-1 truncate font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
