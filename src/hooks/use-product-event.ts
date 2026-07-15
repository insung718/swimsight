"use client";

import { useEffect, useRef } from "react";

type ClientProductEvent = "PREDICTION_VIEWED" | "RETURN_VISIT";
type ProductProperty = string | number | boolean | null;

function sessionIdentifier() {
  const storageKey = "swimsight-product-session";
  const created = crypto.randomUUID().replaceAll("-", "");
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    window.sessionStorage.setItem(storageKey, created);
  } catch {
    // Private browsing and hardened clients may disable storage; analytics remains optional.
  }
  return created;
}

export function useProductEvent(
  eventName: ClientProductEvent,
  properties: Record<string, ProductProperty> = {},
  enabled = true
) {
  const sent = useRef(false);
  const serializedProperties = JSON.stringify(properties);

  useEffect(() => {
    if (!enabled || sent.current) return;
    sent.current = true;
    const controller = new AbortController();
    void fetch("/api/product-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName, properties: JSON.parse(serializedProperties), sessionId: sessionIdentifier() }),
      credentials: "same-origin",
      signal: controller.signal
    }).catch(() => undefined);
    return () => controller.abort();
  }, [enabled, eventName, serializedProperties]);
}
