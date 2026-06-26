"use client";

import { Quote, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { MotivationTip } from "@/types/swim";

export function MotivationPanel() {
  const [tips, setTips] = useState<MotivationTip[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    fetch("/api/motivation")
      .then((response) => response.json())
      .then((data) => {
        setTips(data.tips ?? []);
        setActiveIndex(0);
      })
      .catch(() => setTips([]));
  }, []);

  useEffect(() => {
    if (tips.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % tips.length);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [tips.length]);

  const activeTip = tips[activeIndex];
  const toneClass = activeTip?.tone === "race"
    ? "from-aqua-500/24 to-blue-500/12 text-aqua-100"
    : activeTip?.tone === "recovery"
      ? "from-mint-400/20 to-white/8 text-mint-100"
      : activeTip?.tone === "confidence"
        ? "from-coral-400/20 to-white/8 text-coral-100"
        : "from-white/16 to-aqua-400/12 text-white";

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-mint-400/10 text-mint-500">
          <Sparkles aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">Motivation</h2>
          <p className="text-sm text-white/70">Tips and Olympic mindset cues refresh every 30 seconds</p>
        </div>
      </div>

      <div>
        {activeTip ? (
          <article className={`min-h-[190px] rounded-lg border border-white/12 bg-gradient-to-br p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition ${toneClass}`} key={activeTip.id}>
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
                {activeTip.kind === "quote" ? "Olympic quote" : "SwimSight tip"}
              </span>
              {activeTip.kind === "quote" && <Quote aria-hidden className="h-5 w-5 text-white/70" />}
            </div>
            <h3 className="mt-6 text-2xl font-semibold tracking-normal text-white">{activeTip.title}</h3>
            <p className="mt-3 text-base leading-7 text-white/82">
              {activeTip.kind === "quote" ? `"${activeTip.body}"` : activeTip.body}
            </p>
            {activeTip.author && (
              <p className="mt-5 text-sm font-semibold text-white/84">
                {activeTip.author}
                {activeTip.sourceUrl && activeTip.sourceName && (
                  <a className="ml-2 text-aqua-200 underline decoration-white/30 underline-offset-4 transition hover:text-white" href={activeTip.sourceUrl} rel="noreferrer" target="_blank">
                    {activeTip.sourceName}
                  </a>
                )}
              </p>
            )}
          </article>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 p-5 text-sm text-white/80">
            Tips will appear after SwimSight reads your training patterns.
          </div>
        )}
        {tips.length > 1 && (
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {tips.map((tip, index) => (
                <button
                  aria-label={`Show motivation ${index + 1}`}
                  className={`h-1.5 rounded-full transition ${activeIndex === index ? "w-7 bg-aqua-300" : "w-1.5 bg-white/25 hover:bg-white/45"}`}
                  key={tip.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-white/55">{activeIndex + 1} / {tips.length}</span>
          </div>
        )}
      </div>
    </section>
  );
}
