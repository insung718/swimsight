"use client";

import { type CSSProperties, type ChangeEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AdaptiveSliderProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  formatValue?: (value: number) => string;
  hideLabel?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}

function percentage(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export function AdaptiveSlider({
  ariaLabel,
  className,
  disabled = false,
  formatValue = (current) => current.toString(),
  hideLabel = false,
  label,
  max,
  min,
  onChange,
  step,
  value
}: AdaptiveSliderProps) {
  const reduceMotion = useReducedMotion();
  const current = percentage(value, min, max);
  const baseline = min < 0 && max > 0 ? percentage(0, min, max) : 0;
  const fillStart = Math.min(current, baseline);
  const fillEnd = Math.max(current, baseline);
  const direction = min < 0 && max > 0
    ? value < 0 ? "gain" : value > 0 ? "loss" : "neutral"
    : "standard";
  const style = {
    "--adaptive-slider-baseline": `${baseline}%`,
    "--adaptive-slider-fill-end": `${fillEnd}%`,
    "--adaptive-slider-fill-start": `${fillStart}%`,
    "--adaptive-slider-progress": `${current}%`,
    "--adaptive-slider-transition": reduceMotion ? "0ms" : "160ms"
  } as CSSProperties;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(Number(event.target.value));
  }

  return (
    <label className={cn("adaptive-slider", `adaptive-slider--${direction}`, className)} style={style}>
      <span className={cn("adaptive-slider__header", hideLabel && "sr-only")}>
        <span className="adaptive-slider__label">{label}</span>
        <span className="adaptive-slider__value">{formatValue(value)}</span>
      </span>
      <span className="adaptive-slider__control">
        <span aria-hidden className="adaptive-slider__track">
          <span className="adaptive-slider__baseline" />
          <span className="adaptive-slider__fill" />
          <span className="adaptive-slider__thumb" />
        </span>
        <input
          aria-label={ariaLabel ?? label}
          aria-valuetext={formatValue(value)}
          disabled={disabled}
          max={max}
          min={min}
          step={step}
          type="range"
          value={value}
          onChange={handleChange}
        />
      </span>
    </label>
  );
}
