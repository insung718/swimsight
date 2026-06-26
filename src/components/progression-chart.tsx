"use client";

import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useMemo, useState } from "react";
import { supportedEvents } from "@/lib/events";
import { formatShortDate, formatTime } from "@/lib/utils";
import type { SwimEvent, SwimResult } from "@/types/swim";

interface ProgressionChartProps {
  swims: SwimResult[];
}

export function ProgressionChart({ swims }: ProgressionChartProps) {
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
  const chartData = useMemo(() => {
    return swims
      .filter((swim) => swim.event === selectedEvent)
      .filter((swim) => selectedYear === "All" || new Date(swim.date).getFullYear().toString() === selectedYear)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((swim) => ({
        date: swim.date,
        dateLabel: formatShortDate(swim.date),
        time: swim.timeSeconds,
        meetName: swim.meetName
      }));
  }, [selectedEvent, selectedYear, swims]);

  return (
    <section className="dashboard-glass p-4 lg:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Progression</h2>
          <p className="text-sm text-white/55">Date vs time by event</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <label className="sr-only" htmlFor="event-filter">
            Event
          </label>
          <select
            id="event-filter"
            className="h-10 rounded-md border border-white/20 bg-white/20 px-3 text-sm font-medium text-white outline-none transition focus:border-stitch-cyan"
            value={selectedEvent}
            onChange={(event) => setSelectedEvent(event.target.value as SwimEvent)}
          >
            {availableEvents.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="year-filter">
            Year
          </label>
          <select
            id="year-filter"
            className="h-10 rounded-md border border-white/20 bg-white/20 px-3 text-sm font-medium text-white outline-none transition focus:border-stitch-cyan"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
          >
            <option value="All">All years</option>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 h-[320px] min-h-[320px]">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={chartData} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
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
              formatter={(value) => [formatTime(Number(value)), "Time"]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.meetName ?? selectedEvent}
            />
            <Line
              type="monotone"
              dataKey="time"
              stroke="#09aeca"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2 }}
              activeDot={{ r: 6 }}
            />
            <Brush dataKey="dateLabel" height={24} stroke="#09aeca" travellerWidth={10} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
