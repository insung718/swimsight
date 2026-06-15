import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "aqua" | "mint" | "coral" | "navy";
}

const toneClasses = {
  aqua: "bg-aqua-50 text-aqua-600 dark:bg-aqua-400/10 dark:text-aqua-100",
  mint: "bg-mint-400/10 text-mint-500 dark:text-mint-400",
  coral: "bg-coral-400/10 text-coral-500 dark:text-coral-400",
  navy: "bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-white"
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "aqua" }: MetricCardProps) {
  return (
    <article className="rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-navy-500 dark:text-navy-100">{label}</span>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md", toneClasses[tone])}>
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 text-3xl font-bold text-navy-950 dark:text-white">{value}</div>
      <p className="mt-1 text-sm text-navy-500 dark:text-navy-100">{detail}</p>
    </article>
  );
}
