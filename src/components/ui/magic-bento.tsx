"use client";

import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

interface MagicBentoCard {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
}

interface MagicBentoProps {
  cards: MagicBentoCard[];
  className?: string;
}

export function MagicBento({ cards, className }: MagicBentoProps) {
  const isCompleteBento = cards.length >= 4;

  return (
    <div className={cn("grid auto-rows-fr gap-4 md:grid-cols-4", className)}>
      {cards.map((card, index) => (
        <MagicBentoTile card={card} complete={isCompleteBento} index={index} key={card.title} />
      ))}
    </div>
  );
}

function tileSpan(index: number, complete: boolean) {
  if (!complete) return "md:col-span-1";
  if (index === 0) return "md:col-span-2 md:row-span-2";
  if (index === 3) return "md:col-span-2";
  return "md:col-span-1";
}

function MagicBentoTile({ card, complete, index }: { card: MagicBentoCard; complete: boolean; index: number }) {
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 });

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setSpotlight({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    });
  }, []);

  return (
    <article
      className={cn(
        "group relative min-h-[280px] overflow-hidden rounded-lg border border-white/22 bg-stitch-abyss/[0.86] p-5 text-white shadow-stitch outline-none backdrop-blur-2xl transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-stitch-cyan/60 hover:shadow-glow focus-visible:border-stitch-cyan",
        tileSpan(index, complete)
      )}
      onPointerMove={handlePointerMove}
      style={{
        animation: `dashboard-enter 700ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 70}ms both`
      }}
      tabIndex={0}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{
          background: `radial-gradient(340px circle at ${spotlight.x}% ${spotlight.y}%, rgba(0,251,255,0.23), transparent 58%)`
        }}
      />
      <div aria-hidden className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center justify-between">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stitch-cyan/12 text-stitch-cyan">
            {card.icon}
          </span>
          <span className="font-mono text-xs font-semibold text-white/72">{card.eyebrow}</span>
        </div>
        <h3 className="mt-12 text-2xl font-semibold leading-tight">{card.title}</h3>
        <p className="mt-4 text-sm leading-6 text-white/74">{card.description}</p>
        <div className="mt-auto pt-8">
          <div className="h-1.5 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-stitch-cyan transition-all duration-500 group-hover:w-full group-focus-visible:w-full" style={{ width: `${58 + index * 12}%` }} />
          </div>
        </div>
      </div>
    </article>
  );
}
