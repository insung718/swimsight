"use client";

import { Menu, X, Waves } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Route } from "next";
import { cn } from "@/lib/utils";

interface StaggeredMenuItem {
  label: string;
  href?: string;
  link?: string;
  ariaLabel?: string;
}

interface StaggeredMenuProps {
  items: StaggeredMenuItem[];
  className?: string;
  position?: "left" | "right";
}

export function StaggeredMenu({ items, className, position = "right" }: StaggeredMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = "swimsight-navigation-menu";
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const panelSide = position === "right" ? "right-4" : "left-4";
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
      <div
        aria-hidden
        className={cn(
          "fixed top-4 z-[85] h-[calc(100dvh-2rem)] w-[min(360px,calc(100vw-2rem))] rounded-lg border border-white/15 bg-cyan-200/55 shadow-stitch backdrop-blur-2xl transition duration-500 ease-out",
          panelSide,
          open ? "visible translate-x-0 scale-100 opacity-100 delay-75" : "invisible translate-x-0 scale-95 opacity-0"
        )}
      />
      <aside
        aria-hidden={!open}
        aria-label="SwimSight navigation menu"
        aria-modal="true"
        className={cn(
          "fixed top-4 z-[90] flex h-[calc(100dvh-2rem)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-white/25 bg-stitch-abyss/[0.94] p-5 text-white shadow-stitch backdrop-blur-2xl transition duration-500 ease-out",
          panelSide,
          open ? "visible pointer-events-auto translate-x-0 scale-100 opacity-100 delay-100" : "invisible pointer-events-none translate-x-0 scale-95 opacity-0"
        )}
        id={panelId}
        role="dialog"
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
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Main navigation" className="mt-12 space-y-2">
          {items.map((item, index) => {
            const href = item.href ?? item.link ?? "#";
            const isActive = href.startsWith("/") && (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`)));
            const className = cn(
              "group flex items-center justify-between rounded-lg border px-4 py-4 text-lg font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-stitch-cyan",
              isActive
                ? "border-stitch-cyan/70 bg-stitch-cyan/18 text-stitch-cyan"
                : "border-white/10 bg-white/12 text-white hover:border-stitch-cyan/60 hover:bg-white/18"
            );
            const style = {
              transform: open ? "translateY(0)" : "translateY(18px)",
              opacity: open ? 1 : 0,
              transition: `opacity 420ms cubic-bezier(0.22,1,0.36,1) ${index * 70 + 160}ms, transform 420ms cubic-bezier(0.22,1,0.36,1) ${index * 70 + 160}ms`
            };
            const content = (
              <>
                <span>{item.label}</span>
                <span aria-hidden className="font-mono text-xs text-white/70">{String(index + 1).padStart(2, "0")}</span>
              </>
            );

            if (href.startsWith("/")) {
              return (
                <Link
                  aria-label={item.ariaLabel ?? item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={className}
                  href={href as Route}
                  key={`${href}-${item.label}`}
                  onClick={() => setOpen(false)}
                  style={style}
                >
                  {content}
                </Link>
              );
            }

            return (
              <a
                aria-label={item.ariaLabel ?? item.label}
                aria-current={isActive ? "page" : undefined}
                className={className}
                href={href}
                key={`${href}-${item.label}`}
                onClick={() => setOpen(false)}
                style={style}
              >
                {content}
              </a>
            );
          })}
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
