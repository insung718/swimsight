"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

export function useOutsideClick<T extends HTMLElement>(ref: RefObject<T | null>, callback: () => void) {
  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!target || !(target instanceof Node)) return;
      if (ref.current && !ref.current.contains(target)) callback();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [callback, ref]);
}
