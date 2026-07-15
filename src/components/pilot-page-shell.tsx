"use client";

import Link from "next/link";
import { UserActions } from "@/components/auth/user-actions";
import { LanguageToggle } from "@/components/landing/language-toggle";
import { PilotEnrollmentPanel } from "@/components/pilot-enrollment-panel";
import { useTranslator } from "@/components/i18n/use-language";

export function PilotPageShell({ initialToken, signedIn }: { initialToken: string; signedIn: boolean }) {
  const { t } = useTranslator();
  return (
    <main className="dark min-h-screen bg-[#050b14] text-white">
      <header className="border-b border-white/10 bg-[#050b14]/85 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-16 max-w-[1080px] items-center justify-between gap-3 px-5">
          <Link className="font-semibold" href="/">{t("SwimSight")}</Link>
          <div className="flex items-center gap-2"><LanguageToggle compact /><UserActions /></div>
        </div>
      </header>
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1080px] gap-10 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-stitch-cyan">{t("SwimSight Pilot")}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal sm:text-6xl">{t("Clean data. Real meets. Honest validation.")}</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">{t("Pilot participants help evaluate SwimSight prospectively. You remain in control of club sharing, research consent, exports, and deletion.")}</p>
        </div>
        <PilotEnrollmentPanel initialToken={initialToken} signedIn={signedIn} />
      </section>
    </main>
  );
}
