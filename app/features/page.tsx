"use client";

import { BarChart3, CalendarDays, LineChart } from "lucide-react";
import { SitePage } from "@/components/landing/site-page";

export default function FeaturesPage() {
  return (
    <SitePage
      accent="from-[#dff8ff] to-[#f5f5f7]"
      body="SwimSight gives every swimmer a clean workspace for race history, goals, predictions, personal bests, meets, and private comparison."
      eyebrow="Product features"
      sections={[
        {
          eyebrow: "Race entry",
          title: "Manual times and spreadsheet imports.",
          body: "Add one race by typing it in, or upload a meet file when you have a full set of results.",
          icon: CalendarDays
        },
        {
          eyebrow: "Analytics",
          title: "Trends that explain the season.",
          body: "Personal bests, improvement rates, consistency, rankings, and predictions update from your real data.",
          icon: LineChart
        },
        {
          eyebrow: "Goals",
          title: "A clearer path to the next standard.",
          body: "Set a target time and SwimSight calculates the pace, likelihood, and work required to get there.",
          icon: BarChart3
        }
      ]}
      title="Everything your swim season needs."
    />
  );
}
