"use client";

import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useEffect, type CSSProperties } from "react";

type CounterPlace = number | ".";

interface CounterProps {
  value: number;
  places?: CounterPlace[];
  fontSize?: number;
  padding?: number;
  gap?: number;
  textColor?: string;
  fontWeight?: CSSProperties["fontWeight"];
  className?: string;
  gradientFrom?: string;
  gradientTo?: string;
}

function normalizeNearInteger(value: number) {
  const nearest = Math.round(value);
  const tolerance = 1e-9 * Math.max(1, Math.abs(value));
  return Math.abs(value - nearest) < tolerance ? nearest : value;
}

function getValueRoundedToPlace(value: number, place: number) {
  return Math.floor(normalizeNearInteger(value / place));
}

function getPlaces(value: number): CounterPlace[] {
  const normalized = Math.abs(value).toString();

  return [...normalized].map((character, index, characters) => {
    if (character === ".") return ".";
    const decimalIndex = characters.indexOf(".");
    const power = decimalIndex === -1
      ? characters.length - index - 1
      : index < decimalIndex
        ? decimalIndex - index - 1
        : -(index - decimalIndex);

    return 10 ** power;
  });
}

function CounterNumber({ height, mv, number }: { height: number; mv: ReturnType<typeof useSpring>; number: number }) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    const offset = (10 + number - placeValue) % 10;
    let memo = offset * height;

    if (offset > 5) memo -= 10 * height;

    return memo;
  });

  return (
    <motion.span className="counter-number" style={{ y }}>
      {number}
    </motion.span>
  );
}

function CounterDigit({
  digitStyle,
  height,
  place,
  value
}: {
  digitStyle?: CSSProperties;
  height: number;
  place: CounterPlace;
  value: number;
}) {
  const isDecimal = place === ".";
  const rounded = isDecimal ? 0 : getValueRoundedToPlace(value, place);
  const animatedValue = useSpring(rounded, { damping: 28, mass: 0.5, stiffness: 120 });

  useEffect(() => {
    if (!isDecimal) animatedValue.set(rounded);
  }, [animatedValue, isDecimal, rounded]);

  if (isDecimal) {
    return (
      <span className="counter-digit" style={{ height, width: "fit-content", ...digitStyle }}>
        .
      </span>
    );
  }

  return (
    <span className="counter-digit" style={{ height, ...digitStyle }}>
      {Array.from({ length: 10 }, (_, index) => (
        <CounterNumber height={height} key={index} mv={animatedValue} number={index} />
      ))}
    </span>
  );
}

export function Counter({
  className,
  fontSize = 36,
  fontWeight = 700,
  gap = 1,
  gradientFrom = "rgba(255,255,255,0.58)",
  gradientTo = "rgba(255,255,255,0)",
  padding = 2,
  places,
  textColor = "inherit",
  value
}: CounterProps) {
  const reduceMotion = useReducedMotion();
  const displayValue = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  const computedPlaces = places ?? getPlaces(value);
  const height = fontSize + padding;

  if (reduceMotion) {
    return <span className={className}>{displayValue}</span>;
  }

  return (
    <span aria-label={displayValue} className={`counter-container ${className ?? ""}`} role="text">
      <span
        aria-hidden
        className="counter-counter"
        style={{
          color: textColor,
          fontSize,
          fontWeight,
          gap,
          height
        }}
      >
        {computedPlaces.map((place, index) => (
          <CounterDigit height={height} key={`${place}-${index}`} place={place} value={Math.abs(value)} />
        ))}
      </span>
      <span aria-hidden className="counter-gradient-container">
        <span
          className="counter-top-gradient"
          style={{ background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})` }}
        />
        <span
          className="counter-bottom-gradient"
          style={{ background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})` }}
        />
      </span>
    </span>
  );
}
