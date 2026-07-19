"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, CircleGauge, X } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { OptionWheel, type OptionWheelItem } from "@/components/ui/option-wheel";

export interface DashboardNavigationItem<T extends string> {
  icon: ReactNode;
  id: T;
  label: string;
}

interface DashboardOptionWheelProps<T extends string> {
  activeId: T;
  items: readonly DashboardNavigationItem<T>[];
  onChange: (id: T) => void;
}

export function DashboardOptionWheel<T extends string>({ activeId, items, onChange }: DashboardOptionWheelProps<T>) {
  const { t } = useTranslator();
  const reduceMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const [previewIndex, setPreviewIndex] = useState(activeIndex);
  const translatedItems = useMemo<readonly OptionWheelItem<T>[]>(() => items.map((item) => ({
    ...item,
    label: t(item.label)
  })), [items, t]);
  const activeItem = translatedItems[activeIndex] ?? translatedItems[0];
  const previewItem = translatedItems[previewIndex] ?? activeItem;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setPreviewIndex(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("[role='listbox']")?.focus();
    }, reduceMotion ? 0 : 170);

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )).filter((element) => !element.hasAttribute("hidden"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, reduceMotion]);

  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), reduceMotion ? 0 : 180);
  }

  function select(id: T) {
    onChange(id);
    close();
    window.scrollTo({ behavior: reduceMotion ? "auto" : "smooth", top: 0 });
  }

  const navigator = (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("Open dashboard navigation")}
        className="dashboard-navigator-trigger"
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden className="dashboard-navigator-trigger__icon">{activeItem?.icon ?? <CircleGauge className="h-4 w-4" />}</span>
        <span className="dashboard-navigator-trigger__label">{activeItem?.label}</span>
        <CircleGauge aria-hidden className="h-4 w-4 opacity-65" />
      </button>

      <AnimatePresence>
        {open && (
          <div className="dashboard-navigator-layer">
            <motion.button
              aria-hidden
              className="dashboard-navigator-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              tabIndex={-1}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
              type="button"
              onClick={() => close()}
            />
            <motion.aside
              aria-label={t("Dashboard navigation")}
              aria-modal="true"
              className="dashboard-navigator-panel"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.985, x: 18 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.99, x: 12 }}
              ref={panelRef}
              role="dialog"
              transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="dashboard-navigator-panel__header">
                <div>
                  <p>{t("Workspace")}</p>
                  <h2>{t("Choose a view")}</h2>
                </div>
                <button aria-label={t("Close dashboard navigation")} className="dashboard-navigator-close" type="button" onClick={() => close()}>
                  <X aria-hidden className="h-5 w-5" />
                </button>
              </div>

              <div className="dashboard-navigator-panel__wheel">
                <OptionWheel
                  activeId={activeId}
                  ariaLabel={t("Dashboard views")}
                  items={translatedItems}
                  selectedIndex={activeIndex}
                  side="right"
                  onPreviewChange={setPreviewIndex}
                  onSelect={select}
                />
              </div>

              <div className="dashboard-navigator-panel__footer">
                <span className="dashboard-navigator-preview">
                  <span aria-hidden>{previewItem?.icon}</span>
                  <span>{previewItem?.label}</span>
                </span>
                <button className="dashboard-navigator-open" type="button" onClick={() => previewItem && select(previewItem.id)}>
                  {t("Open view")}
                  <ArrowUpRight aria-hidden className="h-4 w-4" />
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  return mounted ? createPortal(navigator, document.body) : null;
}
