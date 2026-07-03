"use client";

import { Activity, Gauge, TrendingUp } from "lucide-react";
import { SitePage } from "@/components/landing/site-page";

export default function PerformancePage() {
  return (
    <SitePage
      accent="from-white to-[#dff8ff]"
      body="Performance pages are built for competitive swimmers who want to understand what is actually improving, what is stable, and what needs attention."
      eyebrow="Performance analytics"
      sections={[
        {
          eyebrow: "Progression",
          title: "Every event gets a trendline.",
          body: "See how race times change across the season, filter by event, and spot momentum before the next meet.",
          icon: TrendingUp
        },
        {
          eyebrow: "Consistency",
          title: "Fast is good. Repeatable is better.",
          body: "SwimSight turns recent performances into a consistency score so your training feels measurable.",
          icon: Gauge
        },
        {
          eyebrow: "SPI",
          title: "One score for the full picture.",
          body: "The Swim Power Index combines improvement, consistency, and trend direction into a simple 0-100 readout.",
          icon: Activity
        }
      ]}
      title="Know what your times are saying."
    />
  );
}
