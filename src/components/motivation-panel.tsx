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
    <section className="min-w-0 rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04] lg:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-mint-400/10 text-mint-500">
          <Sparkles aria-hidden className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">Motivation</h2>
          <p className="text-sm text-navy-500 dark:text-navy-100">Tiny nudges from your training data</p>
        </div>
      </div>

      <div className="space-y-2">
        {tips.map((tip) => (
          <article className="rounded-lg bg-navy-50 p-3 dark:bg-white/[0.08]" key={tip.id}>
            <h3 className="font-semibold text-navy-950 dark:text-white">{tip.title}</h3>
            <p className="mt-1 text-sm text-navy-600 dark:text-navy-100">{tip.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
