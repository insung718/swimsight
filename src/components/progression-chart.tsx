"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import { supportedEvents } from "@/lib/events";
import { formatShortDate, formatTime } from "@/lib/utils";
import type { Course, SwimEvent, SwimResult } from "@/types/swim";

interface ProgressionChartProps {
  swims: SwimResult[];
}

export function ProgressionChart({ swims }: ProgressionChartProps) {
  const { language, t } = useTranslator();
  const reducedMotion = useReducedMotion();
  const availableEvents = useMemo(
    () => supportedEvents.filter((event) => swims.some((swim) => swim.event === event)),
    [swims]
  );
  const [selectedEvent, setSelectedEvent] = useState<SwimEvent>(availableEvents[0]);
  const years = useMemo(
    () => Array.from(new Set(swims.map((swim) => new Date(swim.date).getFullYear()))).sort(),
    [swims]
  );
  const [selectedYear, setSelectedYear] = useState("All");
  const [selectedRange, setSelectedRange] = useState<"90d" | "180d" | "365d" | "All">("All");
  const availableCourses = useMemo(
    () => Array.from(new Set(swims.filter((swim) => swim.event === selectedEvent).map((swim) => swim.course))).sort() as Course[],
    [selectedEvent, swims]
  );
  const [selectedCourse, setSelectedCourse] = useState<Course | "All">("All");

  useEffect(() => {
    if (availableEvents.length && !availableEvents.includes(selectedEvent)) {
      setSelectedEvent(availableEvents[0]);
    }
  }, [availableEvents, selectedEvent]);

  useEffect(() => {
    if (selectedCourse !== "All" && !availableCourses.includes(selectedCourse)) {
      setSelectedCourse("All");
    }
  }, [availableCourses, selectedCourse]);

  const chartData = useMemo(() => {
    const rows = new Map<string, {
      date: string;
      dateLabel: string;
      LCM?: number;
      SCM?: number;
      SCY?: number;
    }>();

    swims
      .filter((swim) => swim.event === selectedEvent)
      .filter((swim) => selectedCourse === "All" || swim.course === selectedCourse)
      .filter((swim) => selectedYear === "All" || new Date(swim.date).getFullYear().toString() === selectedYear)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((swim) => {
        const row = rows.get(swim.date) ?? {
          date: swim.date,
          dateLabel: formatShortDate(swim.date, language)
        };
        const existing = row[swim.course];
        row[swim.course] = existing ? Math.min(existing, swim.timeSeconds) : swim.timeSeconds;
        rows.set(swim.date, row);
      });

    return Array.from(rows.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [language, selectedCourse, selectedEvent, selectedYear, swims]);

  const visibleChartData = useMemo(() => {
    if (selectedRange === "All" || chartData.length < 2) return chartData;
    const latest = Math.max(...chartData.map((row) => new Date(row.date).getTime()));
    const days = Number.parseInt(selectedRange, 10);
    const cutoff = latest - days * 24 * 60 * 60 * 1000;
    return chartData.filter((row) => new Date(row.date).getTime() >= cutoff);
  }, [chartData, selectedRange]);

  const visibleCourses = selectedCourse === "All" ? availableCourses : [selectedCourse];
  const courseColors: Record<Course, string> = {
    LCM: "#4ee8ff",
    SCM: "#8cffd2",
    SCY: "#ffcf70"
  };

  return (
    <section className="dashboard-glass p-4 lg:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{t("Progression")}</h2>
          <p className="text-sm text-white/74">{t("Date vs time by event")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <label className="sr-only" htmlFor="event-filter">
            {t("Event")}
          </label>
          <select
            id="event-filter"
            className="h-10 rounded-md border border-white/15 bg-[#0a2537] px-3 text-sm font-medium text-white outline-none transition focus:border-stitch-cyan"
            value={selectedEvent}
            onChange={(event) => setSelectedEvent(event.target.value as SwimEvent)}
          >
            {availableEvents.map((event) => (
              <option key={event} value={event}>
                {t(event)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="course-filter">
            {t("Course")}
          </label>
          <select
            id="course-filter"
            className="h-10 rounded-md border border-white/15 bg-[#0a2537] px-3 text-sm font-medium text-white outline-none transition focus:border-stitch-cyan"
            value={selectedCourse}
            onChange={(event) => setSelectedCourse(event.target.value as Course | "All")}
          >
            <option value="All">{t("All courses")}</option>
            {availableCourses.map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="year-filter">
            {t("Year")}
          </label>
          <select
            id="year-filter"
            className="h-10 rounded-md border border-white/15 bg-[#0a2537] px-3 text-sm font-medium text-white outline-none transition focus:border-stitch-cyan"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
          >
            <option value="All">{t("All years")}</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 h-[300px] min-h-[300px] text-white/62 sm:h-[340px] sm:min-h-[340px]">
        {visibleChartData.length ? (
          <ResponsiveContainer height="100%" width="100%">
          <LineChart data={visibleChartData} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
            <XAxis
              dataKey="dateLabel"
              minTickGap={18}
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatTime(Number(value))}
              tickLine={false}
              axisLine={false}
              domain={["dataMin - 1", "dataMax + 1"]}
              width={58}
            />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.28)", background: "rgba(4,14,30,0.88)", color: "#ffffff", backdropFilter: "blur(20px)" }}
              formatter={(value, name) => [formatTime(Number(value)), String(name)]}
              labelFormatter={(label) => `${t(selectedEvent)} · ${label}`}
            />
            <Legend
              formatter={(value) => <span className="font-mono text-xs text-white/78">{String(value)}</span>}
              iconType="circle"
              verticalAlign="top"
            />
            {visibleCourses.map((course) => (
              <Line
                activeDot={{ r: 6 }}
                connectNulls
                dataKey={course}
                dot={{ r: 4, strokeWidth: 2 }}
                key={course}
                name={course}
                isAnimationActive={!reducedMotion}
                stroke={courseColors[course]}
                strokeWidth={3}
                type="monotone"
              />
            ))}
          </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/8 text-sm text-white/72">
            {t("No swims match this filter yet.")}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-white/10 pr-12 pt-4 sm:flex-row sm:items-center sm:justify-between sm:pr-36">
        <span className="text-xs font-semibold text-white/52">{t("Display range")}</span>
        <div aria-label={t("Progression date range")} className="grid grid-cols-4 rounded-md border border-white/12 bg-[#04111d] p-1" role="group">
          {(["90d", "180d", "365d", "All"] as const).map((range) => (
            <button
              aria-pressed={selectedRange === range}
              className={`ui-press min-h-9 rounded px-3 font-mono text-xs font-semibold transition-colors ${selectedRange === range ? "bg-stitch-cyan text-stitch-abyss shadow-[0_4px_14px_rgba(78,232,255,0.18)]" : "text-white/58 hover:text-white"}`}
              key={range}
              type="button"
              onClick={() => setSelectedRange(range)}
            >
              {t(range === "All" ? "All time" : range)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
