"use client";

import { useEffect, useMemo, useState } from "react";
import { FileLock2, NotebookPen, Save, ShieldAlert } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { formatDate } from "@/lib/utils";
import type { CoachClubSummary } from "@/types/swim";

type CoachNote = { id: string; content: string; createdAt: string };

export function CoachOperationsPanel({ clubs }: { clubs: CoachClubSummary[] }) {
  const { language, t } = useTranslator();
  const athletes = useMemo(() => clubs.flatMap((club) => club.swimmers.map((swimmer) => ({ club, swimmer }))), [clubs]);
  const [selection, setSelection] = useState(athletes[0] ? `${athletes[0].club.id}:${athletes[0].swimmer.id}` : "");
  const [content, setContent] = useState("");
  const [notes, setNotes] = useState<CoachNote[]>([]);
  const [status, setStatus] = useState("");
  const selected = athletes.find(({ club, swimmer }) => `${club.id}:${swimmer.id}` === selection);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    fetch(`/api/coach/notes?teamId=${encodeURIComponent(selected.club.id)}&athleteId=${encodeURIComponent(selected.swimmer.id)}`)
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.ok) setNotes(data.notes);
        else setStatus(t(data.error ?? "Could not load private notes."));
      })
      .catch(() => { if (active) setStatus(t("Could not load private notes.")); });
    return () => { active = false; };
  }, [selected?.club.id, selected?.swimmer.id, t]);

  async function saveNote() {
    if (!selected || !content.trim()) return;
    const response = await fetch("/api/coach/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId: selected.club.id, athleteId: selected.swimmer.id, content })
    });
    const data = await response.json();
    if (!response.ok) return setStatus(t(data.error ?? "Could not save private note."));
    setNotes((current) => [data.note, ...current]);
    setContent("");
    setStatus(t("Private coach note saved outside official race and model data."));
  }

  const pendingPermissions = clubs.reduce((sum, club) => sum + club.permissionPendingCount, 0);
  const dataReady = clubs.reduce((sum, club) => sum + club.dataReadyCount, 0);

  return (
    <section className="dashboard-glass p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2"><FileLock2 aria-hidden className="h-5 w-5 text-aqua-100" /><h2 className="text-lg font-semibold text-white">{t("Roster readiness & private notes")}</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">{t("Athlete analytics only appear after an active share grant. Notes stay separate from official results and model labels.")}</p></div>
        <div className="flex gap-2"><StatusChip label="Ready" value={dataReady} /><StatusChip label="Permission pending" value={pendingPermissions} warning /></div>
      </div>

      {selected ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-lg border border-white/12 bg-white/[0.07] p-4">
            <label className="text-xs font-semibold uppercase text-white/48" htmlFor="coach-athlete">{t("Athlete")}</label>
            <select id="coach-athlete" className="mt-2 h-10 w-full rounded-md border border-white/12 bg-[#0b1725] px-3 text-sm text-white" value={selection} onChange={(event) => setSelection(event.target.value)}>
              {athletes.map(({ club, swimmer }) => <option data-no-translate key={`${club.id}:${swimmer.id}`} value={`${club.id}:${swimmer.id}`}>{swimmer.name} · {club.name}</option>)}
            </select>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <ReadinessMetric label="Data quality" value={t(selected.swimmer.dataQualityStatus)} />
              <ReadinessMetric label="Import" value={t(selected.swimmer.importStatus)} />
              <ReadinessMetric label="Prediction" value={selected.swimmer.predictionEligible ? t("Eligible") : t("Not yet eligible")} />
              <ReadinessMetric label="Post-meet reviews" value={selected.swimmer.postMeetEvaluationCount.toString()} />
            </div>
          </div>
          <div className="rounded-lg border border-white/12 bg-white/[0.07] p-4">
            <div className="flex items-center gap-2"><NotebookPen aria-hidden className="h-4 w-4 text-stitch-cyan" /><h3 className="font-semibold text-white">{t("Private coach notes")}</h3></div>
            <textarea className="mt-3 min-h-24 w-full resize-y rounded-md border border-white/12 bg-black/20 p-3 text-sm text-white outline-none placeholder:text-white/36 focus:border-stitch-cyan" maxLength={2000} placeholder={t("Observation for the coaching workspace only") as string} value={content} onChange={(event) => setContent(event.target.value)} />
            <button className="ui-press mt-2 inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-xs font-semibold text-stitch-abyss disabled:opacity-45" disabled={!content.trim()} type="button" onClick={() => void saveNote()}><Save aria-hidden className="h-4 w-4" />{t("Save note")}</button>
            <div className="mt-4 max-h-36 space-y-2 overflow-y-auto">{notes.map((note) => <div className="rounded-md bg-white/[0.06] p-3 text-sm leading-6 text-white/68" key={note.id}><p data-no-translate>{note.content}</p><p className="mt-1 text-xs text-white/38">{formatDate(note.createdAt, language)}</p></div>)}</div>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 rounded-lg border border-dashed border-white/14 p-5 text-sm leading-6 text-white/62"><ShieldAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />{t("No athlete has granted analytics access yet. Share grants are controlled by each athlete.")}</div>
      )}
      {status && <p className="mt-3 text-sm text-white/64">{status}</p>}
    </section>
  );
}

function StatusChip({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  const { t } = useTranslator();
  return <div className={`rounded-md border px-3 py-2 text-center ${warning ? "border-amber-200/20 bg-amber-200/10" : "border-aqua-200/20 bg-aqua-200/10"}`}><div className="font-mono text-lg font-semibold text-white">{value}</div><div className="text-[0.62rem] uppercase text-white/48">{t(label)}</div></div>;
}

function ReadinessMetric({ label, value }: { label: string; value: string }) {
  const { t } = useTranslator();
  return <div className="rounded-md bg-white/[0.06] p-2"><span className="block text-xs text-white/40">{t(label)}</span><strong className="mt-1 block text-white/78">{value}</strong></div>;
}
