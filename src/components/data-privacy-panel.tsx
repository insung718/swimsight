"use client";

import { DatabaseZap, Download, FlaskConical, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslator } from "@/components/i18n/use-language";
import { KineticLoader } from "@/components/ui/kinetic-loader";

type ConsentEntry = { active: boolean; version: string | null; grantedAt: string | null; withdrawnAt: string | null };
type ConsentState = {
  policyVersions: Record<"PERSONAL_ANALYTICS" | "MODEL_TRAINING" | "PUBLIC_RESEARCH" | "GUARDIAN", string>;
  personalAnalytics: ConsentEntry;
  modelTraining: ConsentEntry & { excludedAt: string | null };
  publicResearch: ConsentEntry;
  guardian: ConsentEntry & { required: boolean };
};
type PilotEnrollment = {
  id: string;
  status: "ACTIVE" | "WITHDRAWN" | "COMPLETED";
  enrolledAt: string;
  withdrawnAt: string | null;
  cohort: { id: string; name: string; label: string; endsAt: string | null };
};

const consentOptions = [
  {
    purpose: "MODEL_TRAINING" as const,
    key: "modelTraining" as const,
    title: "Model-training contribution",
    body: "Allow eligible official results to enter a future versioned training cohort. Personal analytics work without this permission."
  },
  {
    purpose: "PUBLIC_RESEARCH" as const,
    key: "publicResearch" as const,
    title: "Public-research contribution",
    body: "Allow privacy-suppressed aggregate validation. SwimSight never publishes your name, raw times, or individual profile."
  }
] as const;

export function DataPrivacyPanel() {
  const { language, t } = useTranslator();
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [enrollments, setEnrollments] = useState<PilotEnrollment[]>([]);
  const [busy, setBusy] = useState("");
  const [status, setStatus] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const deletePhrase = language === "ko" ? "계정 삭제" : language === "vi" ? "XÓA TÀI KHOẢN" : "DELETE";

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/me/privacy", { cache: "no-store" }).then(async (response) => ({ response, data: await response.json() })),
      fetch("/api/pilots/enroll", { cache: "no-store" }).then(async (response) => ({ response, data: await response.json() }))
    ])
      .then(([privacyResult, pilotResult]) => {
        if (!active) return;
        if (!privacyResult.response.ok) throw new Error(privacyResult.data.error ?? "Could not load privacy settings.");
        setConsent(privacyResult.data.consent);
        if (pilotResult.response.ok) setEnrollments(pilotResult.data.enrollments ?? []);
      })
      .catch((error) => active && setStatus(t(error instanceof Error ? error.message : "Could not load privacy settings.")));
    return () => { active = false; };
  }, [t]);

  async function updateConsent(purpose: "MODEL_TRAINING" | "PUBLIC_RESEARCH", action: "GRANTED" | "WITHDRAWN") {
    if (!consent) return;
    setBusy(purpose);
    setStatus("");
    try {
      const response = await fetch("/api/me/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, action, policyVersion: consent.policyVersions[purpose] })
      });
      const data = await response.json();
      if (!response.ok) return setStatus(t(data.error ?? "Consent could not be updated."));
      setConsent(data.consent);
      setStatus(action === "GRANTED" ? t("Consent granted.") : t("Consent withdrawn."));
    } finally {
      setBusy("");
    }
  }

  async function withdrawPilot(enrollmentId: string) {
    if (!window.confirm(t("Withdraw from this pilot cohort? Club analytics sharing connected to this enrollment will also stop."))) return;
    setBusy(`pilot-${enrollmentId}`);
    try {
      const response = await fetch("/api/pilots/enroll", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId })
      });
      const data = await response.json();
      if (!response.ok) return setStatus(t(data.error ?? "Pilot withdrawal could not be completed."));
      setEnrollments((current) => current.map((entry) => entry.id === enrollmentId
        ? { ...entry, status: "WITHDRAWN", withdrawnAt: data.enrollment.withdrawnAt }
        : entry));
      setStatus(t("Pilot participation withdrawn."));
    } finally {
      setBusy("");
    }
  }

  async function excludeTrainingData() {
    if (!window.confirm(t("Exclude your data from model training and invalidate affected research cohorts? Your private dashboard data will remain."))) return;
    setBusy("training-data");
    try {
      const response = await fetch("/api/me/privacy", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "TRAINING_DATA", confirmation: "DELETE" })
      });
      const data = await response.json();
      if (!response.ok) return setStatus(t(data.error ?? "Training-data exclusion could not be completed."));
      setConsent(data.consent);
      setStatus(t("Your records are excluded from model training. Private personal analytics remain available."));
    } finally {
      setBusy("");
    }
  }

  async function deleteAccount() {
    if (deleteConfirmation !== deletePhrase) return;
    setBusy("account");
    try {
      const response = await fetch("/api/me/privacy", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "ACCOUNT", confirmation: "DELETE" })
      });
      const data = await response.json();
      if (!response.ok && response.status !== 202) return setStatus(t(data.error ?? "Account deletion could not be completed."));
      window.location.assign("/");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="dashboard-glass p-5 text-white">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-stitch-cyan/10 text-stitch-cyan"><ShieldCheck aria-hidden className="h-5 w-5" /></span>
        <div><h2 className="text-xl font-semibold">{t("Data & privacy controls")}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-white/62">{t("Personal analytics, model training, public research, club sharing, and pilot participation are separate permissions.")}</p></div>
      </div>

      {!consent ? <div className="mt-6 flex min-h-24 items-center justify-center"><KineticLoader className="h-7 text-stitch-cyan" label={t("Loading privacy settings")} /></div> : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {consentOptions.map((option) => {
            const entry = consent[option.key];
            const blockedByGuardian = consent.guardian.required && !consent.guardian.active;
            return (
              <article className="rounded-lg border border-white/12 bg-white/[0.07] p-4" key={option.purpose}>
                <div className="flex items-start justify-between gap-3">
                  <div><h3 className="font-semibold text-white">{t(option.title)}</h3><p className="mt-2 text-sm leading-6 text-white/58">{t(option.body)}</p></div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${entry.active ? "border-mint-200/25 bg-mint-300/10 text-mint-100" : "border-white/12 bg-white/[0.06] text-white/48"}`}>{entry.active ? t("Active") : t("Off")}</span>
                </div>
                {blockedByGuardian && <p className="mt-3 text-xs leading-5 text-amber-100">{t("Verified guardian consent is required for minors before this permission can be enabled.")}</p>}
                <button
                  className="ui-press mt-4 h-9 rounded-md border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={busy === option.purpose || (blockedByGuardian && !entry.active)}
                  type="button"
                  onClick={() => void updateConsent(option.purpose, entry.active ? "WITHDRAWN" : "GRANTED")}
                >
                  {busy === option.purpose ? t("Saving") : entry.active ? t("Withdraw consent") : t("Grant consent")}
                </button>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-white/12 bg-white/[0.06] p-4">
        <div className="flex items-center gap-2"><UsersRound aria-hidden className="h-4 w-4 text-aqua-100" /><h3 className="font-semibold">{t("Pilot participation")}</h3></div>
        <div className="mt-3 space-y-2">
          {enrollments.length === 0 && <p className="text-sm text-white/52">{t("You are not enrolled in a controlled pilot cohort.")}</p>}
          {enrollments.map((entry) => <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-black/15 p-3 sm:flex-row sm:items-center sm:justify-between" key={entry.id}><div><p className="text-sm font-semibold text-white">{entry.cohort.name}</p><p className="mt-1 text-xs text-white/45">{entry.cohort.label} · {t(entry.status)}</p></div>{entry.status === "ACTIVE" && <button className="ui-press h-8 rounded-md border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white disabled:opacity-45" disabled={busy === `pilot-${entry.id}`} type="button" onClick={() => void withdrawPilot(entry.id)}>{busy === `pilot-${entry.id}` ? t("Withdrawing") : t("Withdraw from pilot")}</button>}</div>)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <a className="ui-press flex min-h-20 items-center gap-3 rounded-lg border border-white/12 bg-white/[0.07] p-4 hover:border-stitch-cyan/50" href="/api/me/export"><Download aria-hidden className="h-5 w-5 text-stitch-cyan" /><span><strong className="block text-sm">{t("Export my data")}</strong><span className="mt-1 block text-xs text-white/48">{t("Download a private account archive.")}</span></span></a>
        <button className="ui-press flex min-h-20 items-center gap-3 rounded-lg border border-white/12 bg-white/[0.07] p-4 text-left hover:border-amber-200/40 disabled:opacity-45" disabled={busy === "training-data"} type="button" onClick={() => void excludeTrainingData()}><DatabaseZap aria-hidden className="h-5 w-5 text-amber-100" /><span><strong className="block text-sm">{t("Exclude training data")}</strong><span className="mt-1 block text-xs text-white/48">{t("Keep the dashboard; leave training cohorts.")}</span></span></button>
        <div className="rounded-lg border border-rose-200/15 bg-rose-300/[0.05] p-4 lg:col-span-2"><div className="flex items-center gap-2"><Trash2 aria-hidden className="h-4 w-4 text-rose-200" /><strong className="text-sm">{t("Delete account")}</strong></div><label className="mt-3 block text-xs text-white/48" htmlFor="delete-confirmation">{t("Type the phrase shown to confirm")}: <span className="font-semibold text-rose-100">{deletePhrase}</span></label><div className="mt-2 flex gap-2"><input id="delete-confirmation" autoComplete="off" className="h-9 min-w-0 flex-1 rounded-md border border-white/12 bg-black/20 px-3 font-mono text-xs text-white outline-none focus:border-rose-200" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /><button className="h-9 rounded-md bg-rose-200 px-3 text-xs font-semibold text-rose-950 disabled:opacity-40" disabled={busy === "account" || deleteConfirmation !== deletePhrase} type="button" onClick={() => void deleteAccount()}>{t("Delete")}</button></div></div>
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-white/48"><FlaskConical aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t("Imported results never enter research or model training solely because they were uploaded. The matching consent must also be active.")}</div>
      {status && <p aria-live="polite" className="mt-3 text-sm text-white/68">{status}</p>}
    </section>
  );
}
