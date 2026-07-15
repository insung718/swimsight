"use client";

import { CheckCircle2, Clipboard, FileSpreadsheet, ShieldCheck, Upload, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import type { CoachClubSummary } from "@/types/swim";

type PilotCohort = { id: string; name: string; label: string };
type PreviewRow = { rowNumber: number; name: string; email: string; status: string; errors: string[] };
type RosterPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: PreviewRow[];
  previewToken: string;
  permissionReview: { scopes: string[]; athleteAcceptanceRequired: boolean; accountsCreated: boolean };
};
type Invitation = { rowNumber: number; name: string; email: string; joinPath: string; expiresAt: string };
type IssuedInvitation = { id: string; label: string; audience: string; maxUses: number; useCount: number; expiresAt: string; revokedAt: string | null; cohort: { name: string; label: string } };

export function CoachRosterImport({ clubs }: { clubs: CoachClubSummary[] }) {
  const { t } = useTranslator();
  const [cohorts, setCohorts] = useState<PilotCohort[]>([]);
  const [teamId, setTeamId] = useState(clubs[0]?.id ?? "");
  const [cohortId, setCohortId] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [issuedInvitations, setIssuedInvitations] = useState<IssuedInvitation[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/pilots/cohorts").then(async (response) => ({ response, data: await response.json() })),
      fetch("/api/pilots/invitations").then(async (response) => ({ response, data: await response.json() }))
    ])
      .then(([cohortResult, invitationResult]) => {
        if (!cohortResult.response.ok) return setStatus(t(cohortResult.data.error ?? "Could not load pilot cohorts."));
        setCohorts(cohortResult.data.cohorts ?? []);
        setCohortId(cohortResult.data.cohorts?.[0]?.id ?? "");
        if (invitationResult.response.ok) setIssuedInvitations(invitationResult.data.invitations ?? []);
      })
      .catch(() => setStatus(t("Could not load pilot cohorts.")));
  }, [t]);

  async function readFile(file?: File) {
    setPreview(null);
    setInvitations([]);
    if (!file) return setCsv("");
    if (file.size > 200_000) return setStatus(t("Roster spreadsheet must be smaller than 200 KB."));
    setCsv(await file.text());
    setStatus("");
  }

  async function revokeInvitation(invitationId: string) {
    const response = await fetch("/api/pilots/invitations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId })
    });
    const data = await response.json();
    if (!response.ok) return setStatus(t(data.error ?? "Pilot invitation could not be revoked."));
    setIssuedInvitations((current) => current.map((entry) => entry.id === invitationId ? { ...entry, revokedAt: data.invitation.revokedAt } : entry));
    setStatus(t("Pilot invitation revoked."));
  }

  async function submit(mode: "PREVIEW" | "COMMIT") {
    if (!teamId || !cohortId || !csv || (mode === "COMMIT" && !preview)) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/coach/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, teamId, cohortId, csv, ...(mode === "COMMIT" ? { previewToken: preview!.previewToken } : {}) })
      });
      const data = await response.json();
      if (!response.ok) return setStatus(t(data.error ?? "Roster import could not be completed."));
      if (mode === "PREVIEW") {
        setPreview(data);
        setStatus(t("Review every row and permission scope before creating invitation links."));
      } else {
        setInvitations(data.invitations ?? []);
        setPreview(null);
        setStatus(t("One-use invitation links created. No athlete account was created automatically."));
      }
    } finally {
      setBusy(false);
    }
  }

  if (!clubs.length) return null;

  return (
    <section className="dashboard-glass p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stitch-cyan/10 text-stitch-cyan"><FileSpreadsheet aria-hidden className="h-5 w-5" /></span>
        <div><h2 className="text-lg font-semibold text-white">{t("Roster invitation import")}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-white/62">{t("Upload a Name,Email spreadsheet to create expiring pilot links. Athletes review and accept sharing themselves; this does not create accounts or reveal who is already registered.")}</p></div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold uppercase text-white/48">{t("Club")}<select className="mt-2 h-10 w-full rounded-md border border-white/12 bg-[#0b1725] px-3 text-sm text-white" value={teamId} onChange={(event) => { setTeamId(event.target.value); setPreview(null); }}>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label>
        <label className="text-xs font-semibold uppercase text-white/48">{t("Pilot cohort")}<select className="mt-2 h-10 w-full rounded-md border border-white/12 bg-[#0b1725] px-3 text-sm text-white" value={cohortId} onChange={(event) => { setCohortId(event.target.value); setPreview(null); }}><option value="">{t("Select cohort")}</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></label>
        <label className="flex cursor-pointer flex-col text-xs font-semibold uppercase text-white/48">{t("Roster spreadsheet")}<span className="mt-2 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-dashed border-white/20 bg-white/[0.06] px-3 text-sm normal-case text-white/72 hover:border-stitch-cyan"><Upload aria-hidden className="h-4 w-4" />{csv ? t("Spreadsheet ready") : t("Choose CSV file")}</span><input accept=".csv,text/csv" className="sr-only" type="file" onChange={(event) => void readFile(event.target.files?.[0])} /></label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="ui-press h-9 rounded-md bg-white px-4 text-xs font-semibold text-stitch-abyss disabled:opacity-45" disabled={busy || !csv || !cohortId} type="button" onClick={() => void submit("PREVIEW")}>{busy ? t("Checking") : t("Preview roster")}</button>
        {preview && <button className="ui-press h-9 rounded-md bg-stitch-cyan px-4 text-xs font-semibold text-stitch-abyss disabled:opacity-45" disabled={busy || preview.validRows === 0} type="button" onClick={() => void submit("COMMIT")}>{t("Create invitation links")}</button>}
        <span className="text-xs text-white/44">{t("Required headers")}: {t("Name,Email")} · {t("Maximum 500 rows")}</span>
      </div>

      {preview && (
        <div className="mt-5 rounded-lg border border-white/12 bg-white/[0.06] p-4">
          <div className="flex flex-wrap gap-2"><Metric label="Valid" value={preview.validRows} /><Metric label="Needs correction" value={preview.invalidRows} /><Metric label="Total" value={preview.totalRows} /></div>
          <div className="mt-4 flex items-start gap-2 rounded-md border border-aqua-200/15 bg-aqua-300/10 p-3 text-sm leading-6 text-white/68"><ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-aqua-100" />{t("On acceptance, the athlete shares results, goals, predictions, and upcoming meets with this club. They can withdraw access at any time.")}</div>
          <div className="mt-4 max-h-56 overflow-auto rounded-md border border-white/10">
            {preview.rows.map((row) => <div className="grid grid-cols-[3rem_1fr_auto] gap-3 border-b border-white/8 px-3 py-2 text-xs last:border-0" key={row.rowNumber}><span className="font-mono text-white/40">{row.rowNumber}</span><div><p className="text-white/76">{row.name} · {row.email}</p>{row.errors.length > 0 && <p className="mt-1 text-amber-200">{row.errors.map(t).join(", ")}</p>}</div><span className={row.status === "VALID" ? "text-mint-200" : "text-amber-200"}>{t(row.status)}</span></div>)}
          </div>
        </div>
      )}

      {invitations.length > 0 && <div className="mt-5 space-y-2">{invitations.map((invitation) => <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-white/[0.06] p-3 sm:flex-row sm:items-center sm:justify-between" key={invitation.rowNumber}><div><p className="flex items-center gap-2 text-sm font-semibold text-white"><CheckCircle2 aria-hidden className="h-4 w-4 text-mint-200" />{invitation.name}</p><p className="mt-1 text-xs text-white/48">{invitation.email} · {t("expires")} {new Date(invitation.expiresAt).toLocaleDateString()}</p></div><button className="ui-press inline-flex h-8 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white" type="button" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${invitation.joinPath}`)}><Clipboard aria-hidden className="h-3.5 w-3.5" />{t("Copy invite")}</button></div>)}</div>}
      {issuedInvitations.length > 0 && <div className="mt-5 rounded-lg border border-white/12 bg-white/[0.05] p-4"><h3 className="text-sm font-semibold text-white">{t("Issued pilot invitations")}</h3><div className="mt-3 space-y-2">{issuedInvitations.slice(0, 20).map((invitation) => { const unavailable = Boolean(invitation.revokedAt) || new Date(invitation.expiresAt) <= new Date() || invitation.useCount >= invitation.maxUses; return <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-black/15 p-3 sm:flex-row sm:items-center sm:justify-between" key={invitation.id}><div><p className="text-sm font-semibold text-white">{invitation.label} · {invitation.cohort.name}</p><p className="mt-1 text-xs text-white/45">{invitation.useCount}/{invitation.maxUses} {t("used")} · {unavailable ? t("Unavailable") : `${t("expires")} ${new Date(invitation.expiresAt).toLocaleDateString()}`}</p></div>{!invitation.revokedAt && <button className="ui-press inline-flex h-8 items-center gap-2 rounded-md border border-rose-200/20 bg-rose-200/10 px-3 text-xs font-semibold text-rose-100" type="button" onClick={() => void revokeInvitation(invitation.id)}><XCircle aria-hidden className="h-3.5 w-3.5" />{t("Revoke")}</button>}</div>; })}</div></div>}
      {status && <p className="mt-3 text-sm text-white/64">{status}</p>}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const { t } = useTranslator();
  return <div className="rounded-md border border-white/10 bg-black/15 px-3 py-2"><span className="text-xs text-white/42">{t(label)}</span><strong className="ml-2 font-mono text-white">{value}</strong></div>;
}
