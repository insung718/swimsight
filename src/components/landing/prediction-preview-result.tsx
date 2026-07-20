"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChartNoAxesCombined, ShieldCheck, TimerReset, Waves } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { useTranslator } from "@/components/i18n/use-language";
import { LanguageToggle } from "@/components/landing/language-toggle";
import {
  buildPublicPredictionPreview,
  isValidPublicPredictionSeed,
  publicPredictionSeedStorageKey,
  type PublicPredictionPreview
} from "@/lib/public-prediction-preview";
import { formatTime } from "@/lib/utils";

export function PredictionPreviewResult() {
  const { t } = useTranslator();
  const reduceMotion = useReducedMotion();
  const [preview, setPreview] = useState<PublicPredictionPreview | null | undefined>(undefined);
  const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(publicPredictionSeedStorageKey);
      if (!stored) {
        setPreview(null);
        return;
      }

      const seed: unknown = JSON.parse(stored);
      setPreview(isValidPublicPredictionSeed(seed) ? buildPublicPredictionPreview(seed) : null);
    } catch {
      setPreview(null);
    }
  }, []);

  if (!clerkEnabled) {
    return <PreviewMessage title="Account sign-in is unavailable." body="Add the Clerk publishable key to reveal signed-in prediction previews." />;
  }

  return (
    <main className="prediction-result min-h-screen overflow-hidden bg-[#03070e] text-white">
      <PreviewHeader />
      <SignedOut>
        <PreviewMessage title="Sign in to reveal your forecast." body="Your inputs are waiting in this browser session.">
          <UserActions hero redirectUrl="/prediction-preview" signedOutLabel="Sign in with Google to reveal it" />
        </PreviewMessage>
      </SignedOut>
      <SignedIn>
        {preview === undefined ? (
          <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-5 text-sm text-white/56">{t("Preparing your forecast")}</div>
        ) : preview ? (
          <section className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr]">
            <div aria-hidden className="prediction-result__grid absolute inset-0" />
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 max-w-xl"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              transition={{ duration: reduceMotion ? 0 : 0.56, ease: [0.23, 1, 0.32, 1] }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200/76">{t("One-year directional preview")}</p>
              <h1 className="mt-4 text-balance text-5xl font-semibold leading-[0.92] sm:text-7xl">
                {formatTime(preview.estimate)}
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-white/68 sm:text-lg">
                {t("A first estimate from your PB, course, and weekly frequency. Add official races and your age to replace it with a personal forecast.")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="ui-press inline-flex h-11 items-center gap-2 bg-white px-5 text-sm font-semibold text-[#04111d] hover:bg-cyan-100" href="/">
                  {t("Open my dashboard")}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
                <Link className="ui-press inline-flex h-11 items-center border border-white/20 px-5 text-sm font-semibold text-white hover:bg-white hover:text-[#04111d]" href="/#predict">
                  {t("Change inputs")}
                </Link>
              </div>
            </motion.div>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="prediction-result__board relative z-10 overflow-hidden border border-white/18 bg-[#071522]/88 p-5 backdrop-blur-2xl sm:p-8"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              transition={{ duration: reduceMotion ? 0 : 0.56, delay: reduceMotion ? 0 : 0.08, ease: [0.23, 1, 0.32, 1] }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cyan-200/72">{t("50 Freestyle")}</p>
                  <h2 className="mt-2 text-2xl font-semibold">{preview.course} · 365D</h2>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center bg-cyan-200 text-[#04111d]"><ChartNoAxesCombined aria-hidden className="h-5 w-5" /></span>
              </div>

              <div aria-hidden className="prediction-result__signal mt-8">
                <span />
              </div>

              <div className="mt-7 grid grid-cols-2 gap-px bg-white/12 sm:grid-cols-4">
                <ResultMetric label="Current PB" value={formatTime(preview.currentTime)} />
                <ResultMetric label="Projected range" value={`${formatTime(preview.lowerBound)}-${formatTime(preview.upperBound)}`} />
                <ResultMetric label="Potential improvement" value={`-${preview.improvementSeconds.toFixed(2)}s`} />
                <ResultMetric label="Weekly frequency" value={`${preview.sessionsPerWeek}x`} />
              </div>

              <div className="mt-6 flex items-start gap-3 border-t border-white/12 pt-5 text-sm leading-6 text-white/58">
                <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                <p>{t("This preview is deterministic and intentionally broad. It is not a guarantee, qualifying claim, or substitute for a coach.")}</p>
              </div>
            </motion.div>
          </section>
        ) : (
          <PreviewMessage title="No preview inputs found." body="Return to the predictor and enter your 50 Free PB first.">
            <Link className="ui-press inline-flex h-11 items-center gap-2 bg-white px-5 text-sm font-semibold text-[#04111d] hover:bg-cyan-100" href="/#predict">
              {t("Build a preview")}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </PreviewMessage>
        )}
      </SignedIn>
    </main>
  );
}

function PreviewHeader() {
  const { t } = useTranslator();
  return (
    <header className="relative z-40 border-b border-white/10 bg-[#03070e]/80 backdrop-blur-2xl">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link className="ui-press flex items-center gap-2 text-sm font-semibold hover:text-cyan-100" href="/">
          <Waves aria-hidden className="h-5 w-5" />
          {t("SwimSight")}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle compact />
          <UserActions compact />
        </div>
      </div>
    </header>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  return (
    <div className="min-h-24 bg-[#071522] p-3 sm:p-4">
      <p className="text-[0.64rem] font-semibold uppercase tracking-[0.12em] text-white/42">{t(label)}</p>
      <p className="mt-3 break-words font-mono text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function PreviewMessage({ children, title, body }: { children?: React.ReactNode; title: string; body: string }) {
  const { t } = useTranslator();
  return (
    <section className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-5 py-16">
      <div className="max-w-xl text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center bg-cyan-200 text-[#04111d]"><TimerReset aria-hidden className="h-6 w-6" /></span>
        <h1 className="mt-7 text-balance text-4xl font-semibold sm:text-6xl">{t(title)}</h1>
        <p className="mt-5 text-base leading-7 text-white/62">{t(body)}</p>
        {children && <div className="mt-8 flex justify-center">{children}</div>}
      </div>
    </section>
  );
}
