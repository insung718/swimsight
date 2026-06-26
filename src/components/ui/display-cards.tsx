"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DisplayCardProps {
  className?: string;
  icon: ReactNode;
  title: string;
  description: string;
  detail: string;
}

function DisplayCard({ className, icon, title, description, detail }: DisplayCardProps) {
  return (
    <article
      className={cn(
        "relative flex h-40 w-full max-w-[22rem] select-none flex-col justify-between rounded-lg border border-white/15 bg-[#101317]/92 px-5 py-4 text-white shadow-2xl backdrop-blur-xl transition duration-500 hover:border-cyan-300/50 hover:bg-[#151a20] motion-reduce:transform-none motion-reduce:transition-none sm:w-80 sm:-skew-y-[5deg] sm:hover:-translate-y-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-cyan-300 text-black">{icon}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <p className="text-lg font-medium text-white/88">{description}</p>
      <p className="text-sm text-cyan-200/70">{detail}</p>
    </article>
  );
}

export default function DisplayCards({ cards }: { cards: DisplayCardProps[] }) {
  return (
    <div className="grid gap-4 pr-0 sm:min-h-[25rem] sm:[grid-template-areas:'stack'] sm:place-items-center sm:pr-24">
      {cards.map((card, index) => (
        <DisplayCard
          {...card}
          className={cn(
            "justify-self-center sm:[grid-area:stack]",
            index === 0 && "sm:-translate-x-10 sm:-translate-y-16",
            index === 1 && "sm:translate-x-8",
            index === 2 && "sm:translate-x-24 sm:translate-y-16",
            card.className,
          )}
          key={card.title}
        />
      ))}
    </div>
  );
}
