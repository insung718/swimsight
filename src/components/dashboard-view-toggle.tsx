"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Waves } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import type { DashboardViewMode } from "@/lib/dashboard-view-mode";
import { cn } from "@/lib/utils";

interface DashboardViewToggleProps {
  mode: DashboardViewMode;
}

const options: Array<{ mode: DashboardViewMode; label: string; shortLabel: string; icon: typeof Waves }> = [
  { mode: "swimmer", label: "Swimmer", shortLabel: "Swimmer", icon: Waves },
  { mode: "coach", label: "Coach", shortLabel: "Coach", icon: GraduationCap }
];

export function DashboardViewToggle({ mode }: DashboardViewToggleProps) {
  const router = useRouter();
  const { t } = useTranslator();
  const [pendingMode, setPendingMode] = useState<DashboardViewMode | null>(null);

  async function switchMode(nextMode: DashboardViewMode) {
    if (nextMode === mode || pendingMode) return;

    setPendingMode(nextMode);

    try {
      const response = await fetch("/api/me/view-mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewMode: nextMode })
      });

      if (!response.ok) throw new Error("Could not switch workspace.");
      router.refresh();
    } finally {
      setPendingMode(null);
    }
  }

  return (
    <div
      className="flex shrink-0 rounded-full border border-stitch-abyss/10 bg-white/70 p-1 text-xs font-semibold text-stitch-abyss shadow-[0_12px_35px_rgba(4,17,29,0.08)] backdrop-blur-xl"
      role="tablist"
      aria-label={t("Switch dashboard view")}
    >
      {options.map((option) => {
        const active = option.mode === mode;
        const pending = option.mode === pendingMode;
        const Icon = option.icon;

        return (
          <button
            aria-selected={active}
            className={cn(
              "ui-press inline-flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-2 transition-colors duration-150 sm:min-w-20 sm:px-3",
              active ? "bg-stitch-abyss text-white shadow-glow" : "text-stitch-abyss/62 hover:bg-white hover:text-stitch-abyss",
              pending && "cursor-wait opacity-70"
            )}
            disabled={Boolean(pendingMode)}
            key={option.mode}
            role="tab"
            type="button"
            onClick={() => switchMode(option.mode)}
          >
            <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span className="sm:hidden">{pending ? "..." : t(option.shortLabel)}</span>
            <span className="hidden sm:inline">{pending ? t("Switching") : t(option.label)}</span>
          </button>
        );
      })}
    </div>
  );
}
