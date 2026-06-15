import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

export function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function dateToDays(date: string) {
  return new Date(date).getTime() / 86_400_000;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(date));
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(new Date(date));
}

export function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  if (minutes <= 0) {
    return seconds.toFixed(2);
  }

  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export function parseTimeInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return Number.NaN;
  }

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map(Number);
    if (parts.length !== 2 || parts.some(Number.isNaN)) {
      return Number.NaN;
    }

    return parts[0] * 60 + parts[1];
  }

  const seconds = Number(trimmed);
  return Number.isFinite(seconds) ? seconds : Number.NaN;
}
