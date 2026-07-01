"use client";

import { Database, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import { formatTime } from "@/lib/utils";
import type { SwimResult } from "@/types/swim";

type MeetEntry = {
  name: string;
  firstDate: string;
  lastDate: string;
  results: SwimResult[];
  best?: SwimResult;
};

export function MeetDatabasePanel({ swims }: { swims: SwimResult[] }) {
  const { t } = useTranslator();
  const [query, setQuery] = useState("");
  const officialSwims = useMemo(() => swims.filter((swim) => (swim.resultKind ?? "OFFICIAL") === "OFFICIAL"), [swims]);
  const meets = useMemo(() => {
    const grouped = officialSwims.reduce<Map<string, SwimResult[]>>((map, swim) => {
      const key = swim.meetName.trim() || "Unnamed meet";
      map.set(key, [...(map.get(key) ?? []), swim]);
      return map;
    }, new Map());

    return Array.from(grouped.entries()).map(([name, results]): MeetEntry => {
      const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date));
      const best = sorted.reduce<SwimResult | undefined>((fastest, swim) => (!fastest || swim.timeSeconds < fastest.timeSeconds ? swim : fastest), undefined);
      return {
        name,
        firstDate: sorted[0]?.date ?? "",
        lastDate: sorted[sorted.length - 1]?.date ?? "",
        results: sorted,
        best
      };
    }).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [officialSwims]);

  const filtered = meets.filter((meet) => {
    const haystack = `${meet.name} ${meet.results.map((swim) => `${swim.event} ${swim.course}`).join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-stitch-cyan">
            <Database aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-white">{t("Meet database")}</h2>
            <p className="text-sm text-white/64">{t("Search official meet history saved to your account.")}</p>
          </div>
        </div>
        <label className="relative block min-w-0 sm:w-72">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
          <input
            className="h-10 w-full rounded-md border border-white/10 bg-stitch-abyss pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-stitch-cyan"
            placeholder={t("Search meet or event")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && <div className="rounded-lg border border-dashed border-white/12 p-5 text-center text-sm text-white/58 md:col-span-2 xl:col-span-3">{t("No official meets found yet.")}</div>}
        {filtered.slice(0, 9).map((meet) => (
          <article className="ui-lift rounded-lg border border-white/10 bg-white/[0.07] p-4 hover:border-stitch-cyan/45 hover:bg-white/[0.10]" key={`${meet.name}-${meet.firstDate}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-white">{meet.name}</h3>
                <p className="mt-1 text-xs text-white/48">{meet.firstDate === meet.lastDate ? meet.firstDate : `${meet.firstDate} - ${meet.lastDate}`}</p>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 font-mono text-xs text-aqua-100">{meet.results.length}</span>
            </div>
            {meet.best && (
              <div className="mt-5 rounded-md border border-white/10 bg-stitch-abyss/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/38">{t("Fastest saved result")}</p>
                <p className="mt-2 font-mono text-xl font-semibold text-stitch-cyan">{formatTime(meet.best.timeSeconds)}</p>
                <p className="mt-1 text-sm text-white/58">{t(meet.best.event)} · {meet.best.course}</p>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
