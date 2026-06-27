"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function FlipText({
  children,
  className,
  delay = 0,
  duration = 1.8,
  loop = false
}: {
  children: string;
  className?: string;
  delay?: number;
  duration?: number;
  loop?: boolean;
}) {
  const tokens = useMemo(() => children.split(/(\s+)/), [children]);

  return (
    <span
      aria-label={children}
      className={cn("inline-flex flex-wrap", className)}
      style={{
        "--flip-duration": `${duration}s`,
        "--flip-iteration": loop ? "infinite" : "1"
      } as CSSProperties}
    >
      {tokens.map((token, tokenIndex) => {
        if (/^\s+$/.test(token)) {
          return <span aria-hidden key={`${tokenIndex}-space`}>&nbsp;</span>;
        }

        return (
          <span aria-hidden className="inline-flex" key={`${token}-${tokenIndex}`}>
            {token.split("").map((char, charIndex) => (
              <span
                className="flip-char inline-block"
                key={`${char}-${charIndex}`}
                style={{ "--flip-delay": `${delay + (tokenIndex + charIndex) * 0.025}s` } as CSSProperties}
              >
                {char}
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
}
