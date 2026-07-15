"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { useTranslator } from "@/components/i18n/use-language";
import { KineticLoader } from "@/components/ui/kinetic-loader";

export function PilotEnrollmentPanel({ initialToken, signedIn }: { initialToken: string; signedIn: boolean }) {
  const { t } = useTranslator();
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState("");
  const [invitation, setInvitation] = useState<null | {
    cohortName: string;
    cohortLabel: string;
    clubName: string | null;
    expiresAt: string;
    alreadyEnrolled: boolean;
    coachAccessScopes: string[];
  }>(null);

  useEffect(() => {
    if (!signedIn || token.length < 24) {
      setInvitation(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/pilots/enroll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "PREVIEW", token }),
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) {
          setInvitation(null);
          setStatus(t(data.error ?? "Could not review pilot invitation."));
          return;
        }
        setInvitation(data.invitation);
        setJoined(Boolean(data.invitation.alreadyEnrolled));
        setStatus("");
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setStatus(t("Could not review pilot invitation."));
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [signedIn, t, token]);

  async function join() {
    if (!signedIn) return setStatus(t("Sign in first, then return to this invitation to join the pilot."));
    setBusy(true);
    try {
      const response = await fetch("/api/pilots/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ACCEPT", token })
      });
      const data = await response.json();
      if (!response.ok) return setStatus(t(data.error ?? "Could not join pilot."));
      setJoined(true);
      setStatus(t("Pilot joined. Model-training and public-research consent remain separate choices in Privacy."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-white/16 bg-white/[0.08] p-5 shadow-[0_30px_100px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-7">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-stitch-cyan text-stitch-abyss"><ShieldCheck aria-hidden className="h-5 w-5" /></span>
        <div><h2 className="text-xl font-semibold text-white">{t("Controlled pilot invitation")}</h2><p className="mt-2 text-sm leading-6 text-white/66">{t("Joining connects you to the named pilot cohort. It does not automatically grant model-training or public-research consent.")}</p></div>
      </div>
      <label className="mt-6 block text-xs font-semibold uppercase text-white/48" htmlFor="pilot-token">{t("Invitation token")}</label>
      <input id="pilot-token" className="mt-2 h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 font-mono text-sm text-white outline-none focus:border-stitch-cyan" value={token} onChange={(event) => setToken(event.target.value)} />
      {invitation && (
        <div className="mt-4 rounded-md border border-white/12 bg-black/20 p-4 text-sm text-white/72">
          <p className="font-semibold text-white">{invitation.cohortName}</p>
          <p className="mt-1">{t("Pilot cohort")}: {invitation.cohortLabel}</p>
          {invitation.clubName && <p className="mt-1">{t("Club")}: {invitation.clubName}</p>}
          {invitation.coachAccessScopes.length > 0 && (
            <p className="mt-3 leading-6">
              {t("Authorized coaches will be able to view your results, goals, predictions, and upcoming meets, and keep private coaching notes. You can withdraw access at any time.")}
            </p>
          )}
        </div>
      )}
      <button className="ui-press mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-stitch-abyss disabled:opacity-55" disabled={busy || joined || token.length < 24} type="button" onClick={() => void join()}>
        {busy ? <KineticLoader className="h-4 text-stitch-abyss" label={t("Joining pilot")} /> : <CheckCircle2 aria-hidden className="h-4 w-4" />}{joined ? t("Pilot joined") : t("Join pilot")}
      </button>
      {status && <p className="mt-4 text-sm leading-6 text-white/70">{status}</p>}
    </section>
  );
}
