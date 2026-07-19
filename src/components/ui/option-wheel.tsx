"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode
} from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface OptionWheelItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
}

interface OptionWheelProps<T extends string> {
  activeId: T;
  ariaLabel: string;
  className?: string;
  items: readonly OptionWheelItem<T>[];
  onPreviewChange?: (index: number) => void;
  onSelect: (id: T) => void;
  selectedIndex: number;
  side?: "left" | "right";
}

type WheelConfig<T extends string> = {
  count: number;
  items: readonly OptionWheelItem<T>[];
  rowHeight: number;
  side: "left" | "right";
  smoothing: number;
};

function normalizeIndex(value: number, count: number) {
  if (count <= 0) return 0;
  return ((value % count) + count) % count;
}

function nearestPositionForIndex(index: number, around: number, count: number) {
  if (count <= 0) return 0;
  const normalized = normalizeIndex(index, count);
  return normalized + Math.round((around - normalized) / count) * count;
}

export function OptionWheel<T extends string>({
  activeId,
  ariaLabel,
  className,
  items,
  onPreviewChange,
  onSelect,
  selectedIndex,
  side = "right"
}: OptionWheelProps<T>) {
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const positionRef = useRef(selectedIndex);
  const targetRef = useRef(selectedIndex);
  const previewRef = useRef(selectedIndex);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const dragRef = useRef<{ pointerId: number; startTarget: number; y: number } | null>(null);
  const dragMovedRef = useRef(false);
  const onPreviewRef = useRef(onPreviewChange);
  const onSelectRef = useRef(onSelect);
  const [previewIndex, setPreviewIndex] = useState(selectedIndex);
  const [dragging, setDragging] = useState(false);
  const configRef = useRef<WheelConfig<T>>({
    count: items.length,
    items,
    rowHeight: 58,
    side,
    smoothing: 145
  });

  onPreviewRef.current = onPreviewChange;
  onSelectRef.current = onSelect;
  configRef.current = {
    count: items.length,
    items,
    rowHeight: 58,
    side,
    smoothing: reduceMotion ? 1 : 145
  };

  const renderFrame = useCallback((now: number) => {
    const config = configRef.current;
    const delta = Math.min(Math.max((now - lastFrameRef.current) / 1000, 0), 0.05);
    const factor = 1 - Math.exp(-delta / Math.max(config.smoothing / 1000, 0.001));
    const target = targetRef.current;
    let next = positionRef.current + (target - positionRef.current) * factor;
    const settled = Math.abs(target - next) < 0.001;
    if (settled) next = target;
    positionRef.current = next;

    const mirror = config.side === "right" ? -1 : 1;
    const tiltRadians = (7 * Math.PI) / 180;
    const radius = config.rowHeight / tiltRadians;

    itemRefs.current.forEach((element, index) => {
      if (!element) return;
      const itemPosition = nearestPositionForIndex(index, next, config.count);
      const distanceFromCenter = itemPosition - next;
      const absoluteDistance = Math.abs(distanceFromCenter);
      const angle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, distanceFromCenter * tiltRadians));
      const y = radius * Math.sin(angle);
      const x = mirror * radius * (1 - Math.cos(angle)) * 0.78;
      const rotation = mirror * angle * (180 / Math.PI);
      const intensity = Math.max(0, 1 - Math.min(absoluteDistance, 1));

      element.style.transform = `translate3d(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%), 0) rotate(${rotation.toFixed(2)}deg)`;
      element.style.opacity = String(Math.max(0.12, 1 - absoluteDistance * 0.2));
      element.style.filter = reduceMotion ? "none" : `blur(${Math.min(absoluteDistance * 0.45, 1.5).toFixed(2)}px)`;
      element.style.setProperty("--option-wheel-intensity", intensity.toFixed(3));
    });

    if (settled) {
      frameRef.current = null;
      return;
    }

    lastFrameRef.current = now;
    frameRef.current = window.requestAnimationFrame(renderFrame);
  }, [reduceMotion]);

  const startAnimation = useCallback(() => {
    if (frameRef.current !== null) return;
    lastFrameRef.current = performance.now();
    frameRef.current = window.requestAnimationFrame(renderFrame);
  }, [renderFrame]);

  const applyTarget = useCallback((value: number, snap: boolean) => {
    const config = configRef.current;
    if (config.count <= 0) return;
    const nextTarget = snap ? Math.round(value) : value;
    targetRef.current = nextTarget;

    const nextPreview = normalizeIndex(Math.round(nextTarget), config.count);
    if (nextPreview !== previewRef.current) {
      previewRef.current = nextPreview;
      setPreviewIndex(nextPreview);
      onPreviewRef.current?.(nextPreview);
    }

    startAnimation();
  }, [startAnimation]);

  const selectIndex = useCallback((index: number) => {
    const config = configRef.current;
    const safeIndex = normalizeIndex(index, config.count);
    applyTarget(nearestPositionForIndex(safeIndex, targetRef.current, config.count), true);
    const item = configRef.current.items[safeIndex];
    if (item) onSelectRef.current(item.id);
  }, [applyTarget]);

  useEffect(() => {
    const safeIndex = normalizeIndex(selectedIndex, items.length);
    previewRef.current = safeIndex;
    setPreviewIndex(safeIndex);
    positionRef.current = safeIndex;
    targetRef.current = safeIndex;
    startAnimation();
  }, [items.length, selectedIndex, startAnimation]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaMode === 1 ? event.deltaY * 24 : event.deltaY;
      const step = Math.max(-1, Math.min(1, delta / configRef.current.rowHeight));
      applyTarget(targetRef.current + step, false);
      window.clearTimeout(Number(root.dataset.snapTimer ?? 0));
      const timer = window.setTimeout(() => applyTarget(targetRef.current, true), 110);
      root.dataset.snapTimer = String(timer);
    };

    root.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      root.removeEventListener("wheel", handleWheel);
      window.clearTimeout(Number(root.dataset.snapTimer ?? 0));
    };
  }, [applyTarget]);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = { pointerId: event.pointerId, startTarget: targetRef.current, y: event.clientY };
    dragMovedRef.current = false;
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = event.clientY - drag.y;
    if (!dragMovedRef.current && Math.abs(delta) > 5) {
      dragMovedRef.current = true;
      rootRef.current?.setPointerCapture(drag.pointerId);
    }
    if (dragMovedRef.current) applyTarget(drag.startTarget - delta / configRef.current.rowHeight, false);
  }

  function handlePointerEnd() {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (dragMovedRef.current) applyTarget(targetRef.current, true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      applyTarget(Math.round(targetRef.current) - 1, true);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      applyTarget(Math.round(targetRef.current) + 1, true);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      applyTarget(nearestPositionForIndex(0, targetRef.current, items.length), true);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      applyTarget(nearestPositionForIndex(items.length - 1, targetRef.current, items.length), true);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectIndex(previewRef.current);
    }
  }

  const style = {
    "--option-wheel-side": side === "right" ? "right" : "left"
  } as CSSProperties;

  return (
    <div
      aria-activedescendant={items[previewIndex] ? `dashboard-option-${items[previewIndex].id}` : undefined}
      aria-label={ariaLabel}
      className={cn("option-wheel", dragging && "option-wheel--dragging", side === "right" && "option-wheel--right", className)}
      ref={rootRef}
      role="listbox"
      style={style}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
    >
      <span aria-hidden className="option-wheel__focus-line" />
      {items.map((item, index) => {
        const isPreview = previewIndex === index;
        const isActive = activeId === item.id;
        return (
          <button
            aria-current={isActive ? "page" : undefined}
            aria-selected={isPreview}
            className={cn("option-wheel__item", isPreview && "option-wheel__item--selected")}
            id={`dashboard-option-${item.id}`}
            key={item.id}
            ref={(element) => { itemRefs.current[index] = element; }}
            role="option"
            tabIndex={-1}
            type="button"
            onClick={() => {
              if (!dragMovedRef.current) selectIndex(index);
            }}
          >
            <span className="option-wheel__icon">{item.icon}</span>
            <span className="option-wheel__label">{item.label}</span>
            {isActive && <span aria-hidden className="option-wheel__active-dot" />}
          </button>
        );
      })}
    </div>
  );
}
