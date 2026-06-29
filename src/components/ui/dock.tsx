"use client";

import type { ReactNode } from "react";
import { useTranslator } from "@/components/i18n/use-language";
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
  const { t } = useTranslator();

  return (
    <div className={cn("pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-3 sm:bottom-4", className)}>
      <div className="pointer-events-auto flex max-w-full items-end gap-1.5 rounded-lg border border-white/25 bg-stitch-abyss/[0.86] px-2 py-2 shadow-stitch backdrop-blur-2xl sm:gap-2 sm:px-3" data-no-translate role="toolbar" aria-label={t("Dashboard dock")}>
        {items.map((item) => {
          const label = t(item.label);
          return (
          <button
            aria-label={label}
            aria-pressed={item.active}
            className={cn(
              "group relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-white transition duration-300 hover:-translate-y-1.5 hover:scale-105 focus-visible:-translate-y-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-stitch-cyan sm:h-12 sm:w-12 sm:hover:-translate-y-2 sm:hover:scale-110 sm:focus-visible:-translate-y-2",
              item.active
                ? "border-stitch-cyan bg-stitch-cyan text-stitch-abyss shadow-glow"
                : "border-white/15 bg-white/10 hover:border-stitch-cyan/50 hover:bg-white/15"
            )}
            key={item.label}
            title={label}
            type="button"
            onClick={item.onClick}
          >
            {item.icon}
            <span className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/20 bg-stitch-abyss px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-stitch transition group-hover:translate-y-[-2px] group-hover:opacity-100 group-focus-visible:translate-y-[-2px] group-focus-visible:opacity-100">
              {label}
            </span>
          </button>
          );
        })}
      </div>
    </div>
  );
}
