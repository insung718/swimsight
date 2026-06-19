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
    <section className="min-w-0 rounded-lg border border-navy-100 bg-white p-4 shadow-panel dark:border-white/10 dark:bg-white/[0.04] lg:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy-950 dark:text-white">CSV Import</h2>
          <p className="text-sm text-navy-500 dark:text-navy-100">Date, Event, Time</p>
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
            className="inline-flex h-10 items-center gap-2 rounded-md border border-navy-100 bg-white px-3 text-sm font-semibold text-navy-700 transition hover:border-aqua-400 hover:text-aqua-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <Upload aria-hidden className="h-4 w-4" />
            Upload CSV
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-navy-900 px-3 text-sm font-semibold text-white transition hover:bg-navy-700 dark:bg-aqua-400 dark:text-navy-950"
            type="button"
            onClick={validate}
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" />
            Validate
          </button>
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-aqua-400 px-3 text-sm font-semibold text-navy-950 transition hover:bg-white" type="button" onClick={importRows}>Import</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <textarea
          className="min-h-[180px] w-full resize-y rounded-lg border border-navy-100 bg-navy-50 p-3 font-mono text-sm text-navy-950 outline-none transition focus:border-aqua-400 dark:border-white/10 dark:bg-navy-950 dark:text-white"
          value={csv}
          placeholder={'Date,Event,Time\n2026-03-16,50 Free,25.56'}
          onChange={(event) => setCsv(event.target.value)}
        />
        <div className="rounded-lg border border-navy-50 p-3 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-navy-950 dark:text-white">
                {result.validRows.length} valid rows
              </p>
              <p className="text-sm text-navy-500 dark:text-navy-100">{result.errors.length} errors</p>
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
                className="flex items-center justify-between gap-3 rounded-md bg-navy-50 px-3 py-2 text-sm dark:bg-white/[0.08]"
                key={`${row.date}-${row.event}-${row.timeSeconds}`}
              >
                <span className="font-medium text-navy-950 dark:text-white">{row.event}</span>
                <span className="text-navy-600 dark:text-navy-100">{formatTime(row.timeSeconds)}</span>
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
      {status && <p className="mt-3 text-sm text-white/48">{status}</p>}
    </section>
  );
}
