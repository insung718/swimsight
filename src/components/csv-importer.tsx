"use client";

import { CheckCircle2, Upload, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { validateSwimCsv, type CsvImportResult } from "@/lib/csv";
import { formatTime } from "@/lib/utils";

export function CsvImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<CsvImportResult>({ validRows: [], errors: [] });
  const [status, setStatus] = useState("");

  function validate() {
    setResult(validateSwimCsv(csv));
  }

  async function importRows() {
    const response = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv, persist: true }) });
    const data = await response.json();
    if (!response.ok) { setStatus(data.error ?? "Could not import CSV."); return; }
    setResult(data);
    setStatus(`${data.swims?.length ?? 0} results imported.`);
    window.location.reload();
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setCsv(text);
    setResult(validateSwimCsv(text));
  }

  return (
    <section className="stitch-panel min-w-0 p-4 lg:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">CSV Import</h2>
          <p className="text-sm text-white/70">Date, Event, Time</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 text-sm font-semibold text-white transition hover:border-stitch-cyan hover:text-stitch-cyan"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden className="h-4 w-4" />
            Upload CSV
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-stitch-abyss transition hover:bg-stitch-cyan"
            type="button"
            onClick={validate}
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" />
            Validate
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-stitch-cyan px-3 text-sm font-semibold text-stitch-abyss transition hover:bg-white" type="button" onClick={importRows}>Import</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <textarea
          className="min-h-[180px] w-full resize-y rounded-lg border border-white/10 bg-stitch-abyss p-3 font-mono text-sm text-white outline-none transition placeholder:text-white/45 focus:border-stitch-cyan"
          value={csv}
          placeholder={'Date,Event,Time\n2026-03-16,50 Free,25.56'}
          onChange={(event) => setCsv(event.target.value)}
        />
        <div className="rounded-lg border border-white/10 bg-white/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">
                {result.validRows.length} valid rows
              </p>
              <p className="text-sm text-white/70">{result.errors.length} errors</p>
            </div>
            {result.errors.length ? (
              <XCircle aria-hidden className="h-6 w-6 text-coral-500" />
            ) : (
              <CheckCircle2 aria-hidden className="h-6 w-6 text-mint-500" />
            )}
          </div>

          <div className="mt-4 space-y-2">
            {result.validRows.slice(0, 4).map((row) => (
              <div
                className="flex items-center justify-between gap-3 rounded-md bg-white/10 px-3 py-2 text-sm"
                key={`${row.date}-${row.event}-${row.timeSeconds}`}
              >
                <span className="font-medium text-white">{row.event}</span>
                <span className="text-white/76">{formatTime(row.timeSeconds)}</span>
              </div>
            ))}
            {result.errors.map((error) => (
              <div className="rounded-md bg-coral-400/10 px-3 py-2 text-sm text-coral-500" key={error.row}>
                Row {error.row}: {error.message}
              </div>
            ))}
          </div>
        </div>
      </div>
      {status && <p className="mt-3 text-sm text-white/72">{status}</p>}
    </section>
  );
}
