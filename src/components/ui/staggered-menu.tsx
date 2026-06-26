"use client";

import { Menu, X, Waves } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface StaggeredMenuItem {
  label: string;
  href: string;
}

interface StaggeredMenuProps {
  items: StaggeredMenuItem[];
  className?: string;
}

export function StaggeredMenu({ items, className }: StaggeredMenuProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <button
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white/80 text-black shadow-sm backdrop-blur-xl transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X aria-hidden className="h-4 w-4" /> : <Menu aria-hidden className="h-4 w-4" />}
      </button>

      <div
        aria-hidden={!open}
        className={cn(
          "fixed inset-0 z-[80] bg-black/35 backdrop-blur-sm transition-opacity duration-300",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
      />
      <aside
        className={cn(
          "fixed bottom-4 right-4 top-4 z-[90] flex w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-white/25 bg-stitch-abyss/[0.92] p-5 text-white shadow-stitch backdrop-blur-2xl transition duration-500",
          open ? "translate-x-0 opacity-100" : "translate-x-[110%] opacity-0"
        )}
        id={panelId}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-stitch-cyan text-stitch-abyss">
              <Waves aria-hidden className="h-4 w-4" />
            </span>
            SwimSight
          </div>
          <button
            aria-label="Close navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-stitch-cyan"
            type="button"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Mobile navigation" className="mt-12 space-y-2">
          {items.map((item, index) => (
            <a
              className="group flex items-center justify-between rounded-lg border border-white/10 bg-white/10 px-4 py-4 text-lg font-semibold text-white transition hover:border-stitch-cyan/50 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-stitch-cyan"
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
              style={{
                transform: open ? "translateY(0)" : "translateY(16px)",
                opacity: open ? 1 : 0,
                transition: `opacity 420ms ease ${index * 70 + 120}ms, transform 420ms ease ${index * 70 + 120}ms`
              }}
            >
              <span>{item.label}</span>
              <span className="font-mono text-xs text-white/70">{String(index + 1).padStart(2, "0")}</span>
            </a>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-white/10 bg-white/10 p-4">
          <p className="text-sm font-semibold text-stitch-cyan">Built for race-day clarity.</p>
          <p className="mt-2 text-sm leading-6 text-white/74">
            Every section stays connected to one product system: clean glass, strong contrast, and fast movement.
          </p>
        </div>
      </aside>
    </div>
  );
}
