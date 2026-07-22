"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Waves } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { cn } from "@/lib/utils";

export interface StaggeredMenuItem {
  label: string;
  href?: string;
  link?: string;
  ariaLabel?: string;
  icon?: ReactNode;
  active?: boolean;
  onSelect?: () => void;
}

interface StaggeredMenuProps {
  items: readonly StaggeredMenuItem[];
  className?: string;
  position?: "left" | "right";
  triggerVariant?: "header" | "floating";
  triggerLabel?: string;
  closeLabel?: string;
  dialogLabel?: string;
  navLabel?: string;
  eyebrow?: string;
  activeLabel?: string;
  onMenuOpen?: () => void;
  onMenuClose?: () => void;
}

export function StaggeredMenu({
  items,
  className,
  position = "right",
  triggerVariant = "header",
  triggerLabel = "Open navigation menu",
  closeLabel = "Close navigation menu",
  dialogLabel = "SwimSight navigation menu",
  navLabel = "Main navigation",
  eyebrow = "Navigation",
  activeLabel,
  onMenuOpen,
  onMenuClose
}: StaggeredMenuProps) {
  const { t } = useTranslator();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"
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
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openMenu() {
    setOpen(true);
    onMenuOpen?.();
  }

  function closeMenu(restoreFocus = true) {
    setOpen(false);
    onMenuClose?.();
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 180);
  }

  function selectItem(item: StaggeredMenuItem) {
    item.onSelect?.();
    closeMenu(false);
    if (item.onSelect) window.scrollTo({ behavior: "smooth", top: 0 });
  }

  const trigger = (
    <button
      aria-controls={panelId}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={t(triggerLabel)}
      className={cn(
        triggerVariant === "floating" ? "staggered-menu-trigger staggered-menu-trigger--floating" : "staggered-menu-trigger",
        className
      )}
      ref={triggerRef}
      type="button"
      onClick={open ? () => closeMenu() : openMenu}
    >
      {triggerVariant === "floating" && (
        <span aria-hidden className="staggered-menu-trigger__active-icon">
          {items.find((item) => item.active)?.icon ?? <Waves className="h-4 w-4" />}
        </span>
      )}
      <span className="staggered-menu-trigger__text">
        {triggerVariant === "floating" ? t(activeLabel ?? items.find((item) => item.active)?.label ?? "Menu") : t(open ? "Close" : "Menu")}
      </span>
      <span aria-hidden className={cn("staggered-menu-trigger__glyph", open && "staggered-menu-trigger__glyph--open")}>
        <Plus className="h-4 w-4" />
      </span>
    </button>
  );

  const menu = mounted ? createPortal(
    <div className={cn("staggered-menu-layer", open && "staggered-menu-layer--open", `staggered-menu-layer--${position}`)}>
      <button
        aria-hidden
        className="staggered-menu-backdrop"
        tabIndex={-1}
        type="button"
        onClick={() => closeMenu()}
      />
      <div aria-hidden className="staggered-menu-prelayers">
        <span className="staggered-menu-prelayer staggered-menu-prelayer--mint" />
        <span className="staggered-menu-prelayer staggered-menu-prelayer--cyan" />
      </div>
      <aside
        aria-label={t(dialogLabel)}
        aria-modal="true"
        className="staggered-menu-panel"
        id={panelId}
        ref={panelRef}
        role="dialog"
      >
        <header className="staggered-menu-panel__header">
          <div className="staggered-menu-brand">
            <span className="staggered-menu-brand__mark"><Waves aria-hidden className="h-5 w-5" /></span>
            <span>{t("SwimSight")}</span>
          </div>
          <button
            aria-label={t(closeLabel)}
            className="staggered-menu-close"
            ref={closeButtonRef}
            type="button"
            onClick={() => closeMenu()}
          >
            <span>{t("Close")}</span>
            <span aria-hidden className="staggered-menu-close__glyph"><Plus className="h-4 w-4" /></span>
          </button>
        </header>

        <div className="staggered-menu-panel__body">
          <p className="staggered-menu-eyebrow">{t(eyebrow)}</p>
          <nav aria-label={t(navLabel)}>
            <ol className="staggered-menu-list">
              {items.map((item, index) => {
                const href = item.href ?? item.link;
                const isPathActive = Boolean(href?.startsWith("/") && (pathname === href || (href !== "/" && pathname.startsWith(`${href}/`))));
                const isActive = item.active ?? isPathActive;
                const itemStyle = { "--stagger-index": index } as CSSProperties;
                const content = (
                  <>
                    <span className="staggered-menu-item__number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="staggered-menu-item__label">{t(item.label)}</span>
                    <span aria-hidden className="staggered-menu-item__icon">{item.icon ?? <Plus className="h-5 w-5" />}</span>
                  </>
                );

                return (
                  <li className="staggered-menu-list__item" key={`${href ?? item.label}-${index}`} style={itemStyle}>
                    {href?.startsWith("/") ? (
                      <Link
                        aria-current={isActive ? "page" : undefined}
                        aria-label={t(item.ariaLabel ?? item.label)}
                        className={cn("staggered-menu-item", isActive && "staggered-menu-item--active")}
                        href={href as Route}
                        onClick={() => selectItem(item)}
                      >
                        {content}
                      </Link>
                    ) : href ? (
                      <a
                        aria-current={isActive ? "page" : undefined}
                        aria-label={t(item.ariaLabel ?? item.label)}
                        className={cn("staggered-menu-item", isActive && "staggered-menu-item--active")}
                        href={href}
                        onClick={() => selectItem(item)}
                      >
                        {content}
                      </a>
                    ) : (
                      <button
                        aria-current={isActive ? "page" : undefined}
                        aria-label={t(item.ariaLabel ?? item.label)}
                        className={cn("staggered-menu-item", isActive && "staggered-menu-item--active")}
                        type="button"
                        onClick={() => selectItem(item)}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <footer className="staggered-menu-panel__footer">
          <span>{t("Performance, without the noise.")}</span>
          <a href="https://instagram.com/swim.sight" rel="noreferrer" target="_blank">@swim.sight</a>
        </footer>
      </aside>
    </div>,
    document.body
  ) : null;

  return <>{trigger}{menu}</>;
}
