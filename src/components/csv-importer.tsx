"use client";

import { AlertTriangle, CheckCircle2, Pencil, RotateCcw, ShieldCheck, Upload, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import { KineticLoader } from "@/components/ui/kinetic-loader";
import { supportedEvents } from "@/lib/events";
import { formatTime, parseTimeInput } from "@/lib/utils";
import type { SwimResultKind } from "@/types/swim";

const mappingFields = [
  ["date", "Date"], ["event", "Event"], ["time", "Time"], ["course", "Course"],
  ["meetName", "Meet name"], ["resultKind", "Result kind"], ["raceType", "Race type"],
  ["athleteName", "Athlete name"], ["athleteBirthYear", "Athlete birth year"],
  ["externalAthleteId", "External athlete ID"], ["externalMeetId", "External meet ID"],
  ["externalResultId", "External result ID"], ["sourceStatus", "Source status"]
] as const;

type ColumnMapping = Partial<Record<(typeof mappingFields)[number][0], string>>;
type NormalizedRow = {
  event: string;
  course: "LCM" | "SCM" | "SCY";
  timeSeconds: number;
  date: string;
  meetName: string;
  resultKind: "OFFICIAL" | "TRAINING";
  raceType: "INDIVIDUAL" | "RELAY_SPLIT" | "TIME_TRIAL" | "CONVERTED";
};

type ImportBatch = {
  id: string;
  adapter: string;
  adapterVersion: string;
  sourceName: string;
  sourceHeaders: string[];
  columnMapping: ColumnMapping;
  status: "PREVIEWED" | "PARTIALLY_COMMITTED" | "COMMITTED" | "ROLLED_BACK" | "FAILED";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  reviewRows: number;
  importedRows: number;
  rowsTruncated: boolean;
  rows: {
    id: string;
    rowNumber: number;
    status: string;
    normalized?: NormalizedRow;
    errors: { code: string; message: string }[];
    warnings: { code: string; message: string }[];
  }[];
  identities: {
    id: string;
    sourceName?: string;
    externalAthleteId?: string;
    confidence: string;
    status: string;
    reasonCodes: string[];
  }[];
};

async function importRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Import request failed.");
  return data as { batch: ImportBatch; duplicateUpload?: boolean };
}

export function CsvImporter() {
  const { t } = useTranslator();
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [sourceName, setSourceName] = useState("upload.csv");
  const [batch, setBatch] = useState<ImportBatch>();
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>();
  const [editingRowId, setEditingRowId] = useState<string>();
  const [correction, setCorrection] = useState<(Omit<NormalizedRow, "timeSeconds"> & { time: string })>();
  const [resultKind, setResultKind] = useState<SwimResultKind>("OFFICIAL");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function preview(mappingOverride = columnMapping) {
    if (!csv.trim()) return setStatus(t("Choose a CSV file or paste spreadsheet data first."));
    setBusy(true);
    setStatus("");
    try {
      const data = await importRequest({ mode: "PREVIEW", csv, sourceName, defaultResultKind: resultKind, ...(mappingOverride ? { columnMapping: mappingOverride } : {}) });
      setBatch(data.batch);
      setColumnMapping(data.batch.columnMapping);
      setEditingRowId(undefined);
      setCorrection(undefined);
      setStatus(data.duplicateUpload ? t("This exact file was already reviewed. The existing import batch is shown.") : t("Preview ready. Nothing has been added yet."));
    } catch (error) {
      setStatus(error instanceof Error ? t(error.message) : t("Could not validate spreadsheet."));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!batch) return preview();
    setBusy(true);
    try {
      const data = await importRequest({ mode: "COMMIT", batchId: batch.id });
      setBatch(data.batch);
      setStatus(`${data.batch.importedRows} ${t("results imported.")}`);
      if (data.batch.importedRows > 0) window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(error instanceof Error ? t(error.message) : t("Could not import spreadsheet."));
    } finally {
      setBusy(false);
    }
  }

  async function rollback() {
    if (!batch) return;
    setBusy(true);
    try {
      const data = await importRequest({ mode: "ROLLBACK", batchId: batch.id });
      setBatch(data.batch);
      setStatus(t("Import rolled back. Imported results and derived evaluation labels were removed."));
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setStatus(error instanceof Error ? t(error.message) : t("Could not roll back import."));
    } finally {
      setBusy(false);
    }
  }

  async function resolveIdentity(candidateId: string, action: "CONFIRM_SELF" | "REJECT") {
    if (!batch) return;
    setBusy(true);
    try {
      const data = await importRequest({ mode: "RESOLVE_IDENTITY", batchId: batch.id, candidateId, action });
      setBatch(data.batch);
      setStatus(action === "CONFIRM_SELF" ? t("Imported athlete identity confirmed.") : t("Imported athlete identity rejected."));
    } catch (error) {
      setStatus(error instanceof Error ? t(error.message) : t("Could not update identity review."));
    } finally {
      setBusy(false);
    }
  }

  function beginCorrection(rowId: string, normalized: NormalizedRow) {
    setEditingRowId(rowId);
    setCorrection({
      date: normalized.date,
      event: normalized.event,
      course: normalized.course,
      time: formatTime(normalized.timeSeconds),
      meetName: normalized.meetName,
      resultKind: normalized.resultKind,
      raceType: normalized.raceType
    });
  }

  async function saveCorrection() {
    if (!batch || !editingRowId || !correction) return;
    const timeSeconds = parseTimeInput(correction.time);
    if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) return setStatus(t("Enter a valid corrected time."));
    const correctedResult = {
      date: correction.date,
      event: correction.event,
      course: correction.course,
      meetName: correction.meetName,
      resultKind: correction.resultKind,
      raceType: correction.raceType
    };
    setBusy(true);
    try {
      const data = await importRequest({
        mode: "CORRECT_ROW",
        batchId: batch.id,
        rowId: editingRowId,
        result: { ...correctedResult, timeSeconds }
      });
      setBatch(data.batch);
      setEditingRowId(undefined);
      setCorrection(undefined);
      setStatus(t("Row correction saved and duplicate checks were run again."));
    } catch (error) {
      setStatus(error instanceof Error ? t(error.message) : t("Could not save row correction."));
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    if (file.size > 1_500_000) {
      setStatus(t("Spreadsheet exceeds the 1.5 MB import limit."));
      return;
    }
    setSourceName(file.name.slice(0, 160));
    setCsv(await file.text());
    setBatch(undefined);
    setColumnMapping(undefined);
    setStatus(t("File loaded. Review the result type, then create a preview."));
  }

  const canCommit = batch && batch.validRows > 0 && ["PREVIEWED", "PARTIALLY_COMMITTED"].includes(batch.status);
  const canRollback = batch && batch.importedRows > 0 && batch.status !== "ROLLED_BACK";

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-lg font-semibold text-white">{t("Import spreadsheet")}</h2>
          <p className="mt-1 text-sm leading-6 text-white/70">{t("Preview a SwimSight, generic race, or SwimCloud-compatible user export before committing any result.")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
          <button className="ui-press inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white hover:border-stitch-cyan hover:text-stitch-cyan" type="button" onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden className="h-4 w-4" />{t("Upload CSV")}
          </button>
          <button className="ui-press inline-flex h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-stitch-abyss hover:bg-stitch-cyan disabled:opacity-60" disabled={busy} type="button" onClick={() => void preview()}>
            {busy ? <KineticLoader className="h-4 text-stitch-abyss" label={t("Validating spreadsheet")} /> : <CheckCircle2 aria-hidden className="h-4 w-4" />}{t("Create preview")}
          </button>
          <button className="ui-press inline-flex h-10 items-center gap-2 rounded-md bg-stitch-cyan px-3 text-sm font-semibold text-stitch-abyss hover:bg-white disabled:cursor-not-allowed disabled:opacity-45" disabled={busy || !canCommit} type="button" onClick={() => void commit()}>
            {busy ? <KineticLoader className="h-4 text-stitch-abyss" label={t("Importing spreadsheet")} /> : <ShieldCheck aria-hidden className="h-4 w-4" />}{t("Commit valid rows")}
          </button>
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-md border border-white/10 bg-stitch-abyss p-1">
        {[["OFFICIAL", "Official meet import"], ["TRAINING", "Training import"]].map(([value, label]) => (
          <button className={`h-9 rounded px-3 text-xs font-semibold transition ${resultKind === value ? "bg-white text-stitch-abyss" : "text-white/64 hover:text-white"}`} key={value} disabled={Boolean(batch)} type="button" onClick={() => setResultKind(value as SwimResultKind)}>{t(label)}</button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.95fr]">
        <textarea className="min-h-[200px] w-full resize-y rounded-lg border border-white/10 bg-stitch-abyss p-3 font-mono text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan" value={csv} placeholder={t("Date,Event,Time,Course,Meet Name,Result Kind\n2026-03-16,50 Free,25.56,LCM,Spring Meet,OFFICIAL")} onChange={(event) => { setCsv(event.target.value); setBatch(undefined); setColumnMapping(undefined); }} />
        <div className="rounded-lg border border-white/10 bg-white/10 p-3">
          {!batch ? (
            <div className="flex min-h-[180px] items-center justify-center text-center text-sm leading-6 text-white/62">{t("A server-side preview will detect the format, validate every row, and check duplicates without saving race results.")}</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-sm font-semibold text-white">{t(batch.adapter.replaceAll("_", " "))}</p><p className="mt-1 font-mono text-xs text-white/52">{batch.adapterVersion}</p></div>
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/72">{t(batch.status.replaceAll("_", " "))}</span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <ImportCount label="Valid" value={batch.validRows} tone="good" />
                <ImportCount label="Review" value={batch.reviewRows} tone="warn" />
                <ImportCount label="Duplicate" value={batch.duplicateRows} />
                <ImportCount label="Invalid" value={batch.invalidRows} tone="bad" />
              </div>
              {batch.sourceHeaders.length > 0 && (
                <details className="mt-4 rounded-md border border-white/10 bg-black/10 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-white">{t("Review column mapping")}</summary>
                  <p className="mt-2 text-xs leading-5 text-white/52">{t("Required fields are date, event, and time. Change a mapping and run the preview again before committing.")}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {mappingFields.map(([field, label]) => (
                      <label className="grid gap-1 text-xs text-white/58" key={field}>
                        <span>{t(label)}{["date", "event", "time"].includes(field) ? " *" : ""}</span>
                        <select
                          className="h-9 rounded-md border border-white/12 bg-stitch-abyss px-2 text-sm text-white outline-none focus:border-stitch-cyan"
                          value={columnMapping?.[field] ?? ""}
                          onChange={(event) => setColumnMapping((current) => ({ ...(current ?? {}), [field]: event.target.value || undefined }))}
                        >
                          <option value="">{t("Not mapped")}</option>
                          {batch.sourceHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <button className="ui-press mt-3 h-9 rounded-md border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:border-stitch-cyan" disabled={busy} type="button" onClick={() => void preview(columnMapping)}>{t("Run preview with this mapping")}</button>
                </details>
              )}
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                {batch.rows.slice(0, 12).map((row) => (
                  <div className="rounded-md border border-white/10 bg-white/[0.07] px-3 py-2 text-sm" key={row.id}>
                    <div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate font-medium text-white">{row.normalized?.event ?? `${t("Row")} ${row.rowNumber}`}</span><div className="flex shrink-0 items-center gap-2"><span className="font-mono text-white/72">{row.normalized ? formatTime(row.normalized.timeSeconds) : t(row.status)}</span>{row.normalized && !["IMPORTED", "ROLLED_BACK"].includes(row.status) && <button aria-label={t("Edit row")} className="ui-press inline-flex h-7 w-7 items-center justify-center rounded border border-white/12 text-white/60 hover:text-stitch-cyan" type="button" onClick={() => beginCorrection(row.id, row.normalized!)}><Pencil aria-hidden className="h-3.5 w-3.5" /></button>}</div></div>
                    {[...row.errors, ...row.warnings].slice(0, 2).map((issue) => <p className={`mt-1 text-xs ${row.errors.includes(issue) ? "text-coral-300" : "text-amber-200"}`} key={`${row.id}-${issue.code}`}>{t(issue.message)}</p>)}
                    {!row.normalized && <p className="mt-1 text-xs text-white/46">{t("Correct this row in the source spreadsheet, then create a new preview.")}</p>}
                  </div>
                ))}
              </div>
              {batch.rowsTruncated && <p className="mt-3 text-xs text-white/50">{t("The preview is truncated on screen; all validated rows remain in the durable import batch.")}</p>}
            </>
          )}
        </div>
      </div>

      {editingRowId && correction && (
        <div className="mt-4 rounded-lg border border-stitch-cyan/25 bg-stitch-cyan/[0.08] p-4">
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-white">{t("Correct import row")}</h3><button className="text-xs text-white/58 hover:text-white" type="button" onClick={() => { setEditingRowId(undefined); setCorrection(undefined); }}>{t("Cancel")}</button></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <CorrectionInput label={t("Date")} type="date" value={correction.date} onChange={(value) => setCorrection({ ...correction, date: value })} />
            <label className="grid gap-1 text-xs text-white/58"><span>{t("Event")}</span><select className="h-10 rounded-md border border-white/12 bg-stitch-abyss px-2 text-sm text-white" value={correction.event} onChange={(event) => setCorrection({ ...correction, event: event.target.value })}>{supportedEvents.map((event) => <option key={event} value={event}>{t(event)}</option>)}</select></label>
            <label className="grid gap-1 text-xs text-white/58"><span>{t("Course")}</span><select className="h-10 rounded-md border border-white/12 bg-stitch-abyss px-2 text-sm text-white" value={correction.course} onChange={(event) => setCorrection({ ...correction, course: event.target.value as NormalizedRow["course"] })}>{["LCM", "SCM", "SCY"].map((course) => <option key={course}>{course}</option>)}</select></label>
            <CorrectionInput label={t("Time")} value={correction.time} onChange={(value) => setCorrection({ ...correction, time: value })} />
            <CorrectionInput label={t("Meet name")} value={correction.meetName} onChange={(value) => setCorrection({ ...correction, meetName: value })} />
            <label className="grid gap-1 text-xs text-white/58"><span>{t("Result kind")}</span><select className="h-10 rounded-md border border-white/12 bg-stitch-abyss px-2 text-sm text-white" value={correction.resultKind} onChange={(event) => setCorrection({ ...correction, resultKind: event.target.value as NormalizedRow["resultKind"] })}><option value="OFFICIAL">{t("Official")}</option><option value="TRAINING">{t("Training")}</option></select></label>
            <label className="grid gap-1 text-xs text-white/58"><span>{t("Race type")}</span><select className="h-10 rounded-md border border-white/12 bg-stitch-abyss px-2 text-sm text-white" value={correction.raceType} onChange={(event) => setCorrection({ ...correction, raceType: event.target.value as NormalizedRow["raceType"] })}>{["INDIVIDUAL", "RELAY_SPLIT", "TIME_TRIAL", "CONVERTED"].map((raceType) => <option key={raceType} value={raceType}>{t(raceType.replaceAll("_", " "))}</option>)}</select></label>
          </div>
          <button className="ui-press mt-3 h-10 rounded-md bg-white px-4 text-sm font-semibold text-stitch-abyss disabled:opacity-50" disabled={busy} type="button" onClick={() => void saveCorrection()}>{t("Save correction")}</button>
        </div>
      )}

      {batch?.identities.filter((identity) => identity.status === "REVIEW_REQUIRED" || identity.status === "UNMERGED").map((identity) => (
        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-200/25 bg-amber-200/10 p-4 sm:flex-row sm:items-center sm:justify-between" key={identity.id}>
          <div className="flex gap-3"><AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div><p className="font-semibold text-white">{t("Confirm imported athlete identity")}</p><p className="mt-1 text-sm text-white/64">{identity.sourceName || identity.externalAthleteId || t("Unnamed source athlete")} · {t(identity.confidence)} {t("confidence")}</p></div></div>
          <div className="flex gap-2"><button className="ui-press rounded-md bg-white px-3 py-2 text-xs font-semibold text-stitch-abyss" disabled={busy} type="button" onClick={() => void resolveIdentity(identity.id, "CONFIRM_SELF")}>{t("This is me")}</button><button className="ui-press rounded-md border border-white/15 px-3 py-2 text-xs font-semibold text-white" disabled={busy} type="button" onClick={() => void resolveIdentity(identity.id, "REJECT")}>{t("Reject")}</button></div>
        </div>
      ))}

      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/68">{status}</p>
        {canRollback && <button className="ui-press inline-flex h-9 items-center gap-2 self-start rounded-md border border-coral-300/25 bg-coral-300/10 px-3 text-xs font-semibold text-coral-200" disabled={busy} type="button" onClick={() => void rollback()}><RotateCcw aria-hidden className="h-4 w-4" />{t("Roll back import")}</button>}
      </div>
    </section>
  );
}

function CorrectionInput({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="grid gap-1 text-xs text-white/58"><span>{label}</span><input className="h-10 rounded-md border border-white/12 bg-stitch-abyss px-3 text-sm text-white outline-none focus:border-stitch-cyan" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ImportCount({ label, tone, value }: { label: string; value: number; tone?: "good" | "warn" | "bad" }) {
  const { t } = useTranslator();
  const Icon = tone === "bad" ? XCircle : tone === "warn" ? AlertTriangle : CheckCircle2;
  return <div className="rounded-md bg-white/[0.07] p-2"><Icon aria-hidden className={`mx-auto h-4 w-4 ${tone === "good" ? "text-mint-300" : tone === "warn" ? "text-amber-200" : tone === "bad" ? "text-coral-300" : "text-white/44"}`} /><div className="mt-1 font-mono text-lg font-semibold text-white">{value}</div><div className="truncate text-[0.65rem] uppercase text-white/46">{t(label)}</div></div>;
}
