"use client";

import { Database, Waves } from "lucide-react";
import { UserActions } from "@/components/auth/user-actions";
import { useTranslator } from "@/components/i18n/use-language";
import { LanguageToggle } from "@/components/landing/language-toggle";

export type DashboardUnavailableReason =
  | "account-bootstrap"
  | "account-removed"
  | "database-config"
  | "database-unreachable";

export function DashboardUnavailable({ reason }: { reason: DashboardUnavailableReason }) {
  const { t } = useTranslator();
  const reasonText = reason === "account-removed"
    ? t("Your account data has been removed. Identity deletion is still being finalized, so this session cannot recreate the account.")
    : reason === "account-bootstrap"
      ? t("Sign-in worked, but your account record could not be created in the database yet.")
      : reason === "database-config"
        ? t("A production database is required before accounts can save data.")
        : t("You are signed in, but the dashboard database cannot be reached right now.");

  return (
    <main className="dark min-h-screen bg-[#050b14] text-white">
      <header className="border-b border-white/10 bg-[#050b14]/88 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-5">
          <a className="ui-press flex items-center gap-2 rounded-md text-sm font-semibold" href="/">
            <Waves aria-hidden className="h-5 w-5 text-stitch-cyan" />
            {t("SwimSight")}
          </a>
          <div className="flex items-center gap-2">
            <LanguageToggle compact />
            <UserActions />
          </div>
        </div>
      </header>
      <section className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-[1180px] items-center px-5 py-16">
        <div className="max-w-2xl">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-stitch-cyan/25 bg-stitch-cyan/10 text-stitch-cyan">
            <Database aria-hidden className="h-5 w-5" />
          </span>
          <p className="mt-6 text-sm font-semibold text-stitch-cyan">{t("Signed in successfully")}</p>
          <h1 className="mt-4 text-balance text-4xl font-semibold tracking-normal text-white sm:text-6xl">
            {t("The dashboard connection needs one last backend step.")}
          </h1>
          <p className="mt-6 text-lg leading-8 text-white/78">{reasonText}</p>
          <div className="mt-8 rounded-lg border border-white/18 bg-white/[0.08] p-5 text-sm leading-7 text-white/78 backdrop-blur-xl">
            <p>{t("Add the production database variable in Vercel, then redeploy so database migrations run.")}</p>
            <code className="mt-3 inline-flex rounded bg-black/35 px-2 py-1 font-mono text-xs text-cyan-100" data-no-translate>
              DATABASE_URL
            </code>
            <p className="mt-3">
              {t("When the database is ready, your empty personal dashboard will open with results, imports, goals, meets, communities, and analytics.")}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
