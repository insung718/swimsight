"use client";

import { cn } from "@/lib/utils";

export function KineticLoader({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span aria-label={label} className={cn("inline-flex items-end gap-0.5", className)} role="status">
      {[0, 1, 2].map((index) => (
        <span
          aria-hidden
          className="h-3 w-1 rounded-full bg-current motion-safe:animate-kinetic-loader"
          key={index}
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </span>
  );
}
