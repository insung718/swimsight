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
  aqua: "bg-stitch-abyss text-stitch-cyan",
  mint: "bg-mint-400/15 text-mint-400",
  coral: "bg-coral-400/15 text-coral-400",
  navy: "bg-white/35 text-white"
};

export function MetricCard({ label, value, detail, icon: Icon, tone = "aqua" }: MetricCardProps) {
  return (
    <article className="dashboard-glass premium-hover p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-white/68">{label}</span>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md", toneClasses[tone])}>
          <Icon aria-hidden className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-4 text-3xl font-bold text-white">{value}</div>
      <p className="mt-1 text-sm text-white/58">{detail}</p>
    </article>
  );
}
