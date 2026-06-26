"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DockItem {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}

interface DockProps {
  items: DockItem[];
  className?: string;
}

export function Dock({ items, className }: DockProps) {
  return (
    <div className={cn("pointer-events-none fixed inset-x-0 bottom-4 z-40 hidden justify-center px-4 md:flex", className)}>
      <div className="pointer-events-auto flex items-end gap-2 rounded-lg border border-white/25 bg-stitch-abyss/[0.84] px-3 py-2 shadow-stitch backdrop-blur-2xl" role="toolbar" aria-label="Dashboard dock">
        {items.map((item) => (
          <button
            aria-label={item.label}
            aria-pressed={item.active}
            className={cn(
              "group relative inline-flex h-12 w-12 items-center justify-center rounded-md border text-white transition duration-300 hover:-translate-y-2 hover:scale-110 focus-visible:-translate-y-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-stitch-cyan",
              item.active
                ? "border-stitch-cyan bg-stitch-cyan text-stitch-abyss shadow-glow"
                : "border-white/15 bg-white/10 hover:border-stitch-cyan/50 hover:bg-white/15"
            )}
            key={item.label}
            type="button"
            onClick={item.onClick}
          >
            {item.icon}
            <span className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/20 bg-stitch-abyss px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-stitch transition group-hover:translate-y-[-2px] group-hover:opacity-100 group-focus-visible:translate-y-[-2px] group-focus-visible:opacity-100">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
