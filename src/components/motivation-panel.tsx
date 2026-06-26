"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { MotivationTip } from "@/types/swim";

export function MotivationPanel() {
  const [tips, setTips] = useState<MotivationTip[]>([]);

  useEffect(() => {
    fetch("/api/motivation")
      .then((response) => response.json())
      .then((data) => setTips(data.tips ?? []))
      .catch(() => setTips([]));
  }, []);

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-mint-400/10 text-mint-500">
          <Sparkles aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-white">Motivation</h2>
          <p className="text-sm text-white/70">Tiny nudges from your training data</p>
        </div>
      </div>

      <div className="space-y-2">
        {tips.map((tip) => (
          <article className="rounded-lg bg-white/10 p-3" key={tip.id}>
            <h3 className="font-semibold text-white">{tip.title}</h3>
            <p className="mt-1 text-sm text-white/76">{tip.body}</p>
          </article>
        ))}
        {!tips.length && (
          <div className="rounded-lg border border-dashed border-white/10 p-5 text-sm text-white/80">
            Tips will appear after SwimSight reads your training patterns.
          </div>
        )}
      </div>
    </section>
  );
}
