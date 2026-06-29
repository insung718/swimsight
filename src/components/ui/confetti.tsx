"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export interface ConfettiRef {
  fire: (options?: { count?: number }) => void;
}

interface ConfettiProps {
  className?: string;
  count?: number;
  autoFire?: boolean;
}

const colors = ["#ff3b30", "#ff9500", "#ffd60a", "#34c759", "#32ade6", "#5856d6", "#af52de", "#ff2d55", "#ffffff"];

export const Confetti = forwardRef<ConfettiRef, ConfettiProps>(function Confetti({ autoFire = false, className, count = 144 }, ref) {
  const [burst, setBurst] = useState(autoFire ? 1 : 0);

  useImperativeHandle(ref, () => ({
    fire: () => setBurst((current) => current + 1)
  }));

  if (!autoFire && burst === 0) {
    return <div aria-hidden className={cn("pointer-events-none", className)} />;
  }

  return (
    <div aria-hidden className={cn("pointer-events-none fixed inset-0 z-[70] overflow-hidden", className)}>
      {Array.from({ length: count }, (_, index) => (
        <span
          className="pb-confetti-piece"
          key={`${burst}-${index}`}
          style={{
            "--confetti-color": colors[index % colors.length],
            "--confetti-delay": `${(index % 18) * 34}ms`,
            "--confetti-left": `${(index * 29 + burst * 7) % 100}%`,
            "--confetti-rotate": `${(index % 13) * 37}deg`,
            "--confetti-size": `${12 + (index % 6) * 3}px`
          } as CSSProperties}
        />
      ))}
    </div>
  );
});
