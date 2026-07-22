"use client";

import { Activity } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import type { StrokeSpecialty } from "@/types/swim";

const center = 150;
const maxRadius = 104;
const labelRadius = 128;

function pointFor(index: number, radius: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius
  };
}

function polygon(points: { x: number; y: number }[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function StrokeSpecialtyPentagon({ profile }: { profile: StrokeSpecialty[] }) {
  const { t } = useTranslator();
  const completeEnough = profile.filter((item) => item.eventCount > 0).length >= 3;
  const shapePoints = profile.map((item, index) => pointFor(index, maxRadius * (item.score / 100)));
  const axisPoints = profile.map((_, index) => pointFor(index, maxRadius));

  return (
    <section className="dashboard-glass overflow-hidden p-4 lg:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-stitch-abyss text-stitch-cyan shadow-glow">
            <Activity aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">{t("Stroke specialty pentagon")}</h2>
            <p className="text-sm text-white/72">{t("Freestyle, fly, back, breast, and IM scored from your event rankings.")}</p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-aqua-100">
          {completeEnough ? t("Profile active") : t("Log 3 stroke groups")}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="mx-auto aspect-square w-full max-w-[360px]">
          <svg aria-label={t("Stroke specialty pentagon")} className="h-full w-full" role="img" viewBox="0 0 300 300">
            {[0.25, 0.5, 0.75, 1].map((scale) => (
              <polygon
                fill="none"
                key={scale}
                points={polygon(profile.map((_, index) => pointFor(index, maxRadius * scale)))}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
              />
            ))}
            {axisPoints.map((point, index) => (
              <line key={profile[index]?.stroke ?? index} stroke="rgba(78,232,255,0.20)" strokeWidth="1" x1={center} x2={point.x} y1={center} y2={point.y} />
            ))}
            <polygon fill="rgba(78,232,255,0.22)" points={polygon(shapePoints)} stroke="#4ee8ff" strokeLinejoin="round" strokeWidth="3" />
            {shapePoints.map((point, index) => (
              <circle cx={point.x} cy={point.y} fill="#d5fbff" key={profile[index]?.stroke ?? index} r="4.5" />
            ))}
            {profile.map((item, index) => {
              const labelPoint = pointFor(index, labelRadius);
              return (
                <text
                  fill="rgba(255,255,255,0.82)"
                  fontSize="11"
                  fontWeight="700"
                  key={item.stroke}
                  textAnchor={labelPoint.x < center - 8 ? "end" : labelPoint.x > center + 8 ? "start" : "middle"}
                  x={labelPoint.x}
                  y={labelPoint.y}
                >
                  {t(item.stroke)}
                </text>
              );
            })}
          </svg>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {profile.map((item) => (
            <div className="rounded-lg border border-white/12 bg-white/[0.08] p-3 sm:last:col-span-2" key={item.stroke}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-white">{t(item.stroke)}</span>
                <span className="font-mono text-sm text-aqua-100">{item.score}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="ui-progress-fill h-full w-full rounded-full bg-stitch-cyan shadow-glow" style={{ transform: `scaleX(${Math.min(item.score, 100) / 100})` }} />
              </div>
              <p className="mt-2 text-xs text-white/58">{item.eventCount} {t(item.eventCount === 1 ? "course-specific event logged" : "course-specific events logged")}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
