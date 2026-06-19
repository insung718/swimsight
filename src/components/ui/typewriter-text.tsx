"use client";

import { useEffect, useMemo, useState } from "react";

export interface TypewriterProps {
  text: string | string[];
  speed?: number;
  cursor?: string;
  loop?: boolean;
  deleteSpeed?: number;
  delay?: number;
  className?: string;
}

export function Typewriter({
  text,
  speed = 80,
  cursor = "|",
  loop = false,
  deleteSpeed = 45,
  delay = 1600,
  className,
}: TypewriterProps) {
  const textArray = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
  const [displayText, setDisplayText] = useState("");
  const [textIndex, setTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const currentText = textArray[textIndex] ?? "";

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplayText(currentText);
      return;
    }

    const timeout = window.setTimeout(() => {
      if (isPaused) {
        setIsPaused(false);
        setIsDeleting(loop);
        return;
      }

      if (isDeleting) {
        if (displayText.length > 0) {
          setDisplayText((value) => value.slice(0, -1));
          return;
        }

        setIsDeleting(false);
        setTextIndex((index) => (index + 1) % textArray.length);
        return;
      }

      if (displayText.length < currentText.length) {
        setDisplayText(currentText.slice(0, displayText.length + 1));
      } else if (loop) {
        setIsPaused(true);
      }
    }, isPaused ? delay : isDeleting ? deleteSpeed : speed);

    return () => window.clearTimeout(timeout);
  }, [currentText, delay, deleteSpeed, displayText, isDeleting, isPaused, loop, speed, textArray.length]);

  return (
    <span className={className}>
      {displayText}
      <span aria-hidden className="animate-pulse">{cursor}</span>
    </span>
  );
}
